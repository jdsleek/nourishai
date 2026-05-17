#!/usr/bin/env node
/**
 * Inserts or refreshes ONE facilitator assessment row by facilitator email + slug (Postgres).
 *
 * From food-app/ with DATABASE_URL (e.g. railway run or .env.local):
 *
 *   TARGET_FACILITATOR_EMAIL=fredaanyanwu.k@gmail.com \
 *   TEST_ASSESSMENT_SLUG=freda-foundry-test \
 *   TEST_ASSESSMENT_TITLE="Foundry test cohort" \
 *   node scripts/training-create-test-assessment.mjs
 *
 * Prefer production Postgres hosted on Railway (ignores DATABASE_URL):
 *
 *   node scripts/training-create-test-assessment.mjs --railway-db
 *
 * Expects `RAILWAY_TOKEN` + `RAILWAY_PROJECT_ID` in the environment or in
 * `../vault/.env` (credentials only merged when using --railway-db).
 *
 * Does not change facilitator password. Idempotent for same email+slug.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { resolveRailwayRenderedDatabaseUrl } from "./lib/railway-gql-vars.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function parseEnvLines(text) {
  const obj = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    obj[key] = val;
  }
  return obj;
}

/** Supabase pooler URLs (`*.pooler.supabase.com`) often use `postgres.<projectRef>` login; migrate to direct `db.<ref>.postgres` hostname for CLI scripts when pooler rejects the tenant. */
function normalizeDatabaseUrl(raw) {
  const s =
    typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
  if (!s) return "";
  try {
    const normalized = s.replace(/^postgres(ql)?:\/\//i, "http://");
    const u = new URL(normalized);
    const userDec = decodeURIComponent((u.username || "").replace(/\+/g, "%20"));
    const passDec = decodeURIComponent((u.password || "").replace(/\+/g, "%20"));
    const m = /^postgres\.([^:]+)$/i.exec(userDec);
    if (
      !m ||
      !/\.pooler\.supabase\.com$/i.test(u.hostname || "")
    ) {
      return s;
    }
    const ref = m[1];
    const qp = new URLSearchParams(
      String(u.search || "").replace(/^\?/, ""),
    );
    if (!qp.has("sslmode")) qp.set("sslmode", "require");
    const path = u.pathname && u.pathname !== "" ? u.pathname : "/postgres";
    return `postgresql://postgres:${encodeURIComponent(passDec)}@db.${ref}.supabase.co:5432${path}?${qp.toString()}`;
  } catch {
    return s;
  }
}

function loadProjectEnv() {
  const fragments = [];
  for (const name of [".env", ".env.local"]) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    fragments.push(parseEnvLines(fs.readFileSync(p, "utf8")));
  }
  const merged = fragments.reduce((a, b) => ({ ...a, ...b }), {});
  for (const [key, val] of Object.entries(merged)) {
    const cur = process.env[key];
    if (cur === undefined || cur === "") process.env[key] = val;
  }
}

/** Merge Railway API fields from ../vault/.env when flags need them */
function hydrateRailwayCredsFromVault() {
  const p = path.join(ROOT, "..", "vault", ".env");
  if (!fs.existsSync(p)) return;
  let parsed = {};
  try {
    parsed = parseEnvLines(fs.readFileSync(p, "utf8"));
  } catch {
    return;
  }
  for (const key of [
    "RAILWAY_TOKEN",
    "RAILWAY_PROJECT_ID",
    "NOURISHAI_RAILWAY_PROJECT_ID",
  ]) {
    const raw = parsed[key];
    const v =
      typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
    if (!v) continue;
    const cur = process.env[key];
    const curTrim = typeof cur === "string" ? cur.trim() : "";
    if (!curTrim) process.env[key] = v;
  }
}

function ssl(conn) {
  if (process.env.PG_SSL_DISABLE === "1") return false;
  // Operational script: permissive TLS for Railway proxies / managed Postgres (matches common deploy setups).
  if (
    /\b(?:localhost|127\.0\.0\.1)\b(?=[:/?]|$)/i.test(conn.replace(/postgres(ql)?:\/\//i, ""))
  ) {
    return undefined;
  }
  return { rejectUnauthorized: false };
}

async function execIgnoreDuplicateColumn(pool, sql) {
  try {
    await pool.query(sql);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate_column|already exists/i.test(msg)) return;
    throw e;
  }
}

async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_facilitators (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_assessments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      facilitator_id UUID NOT NULL REFERENCES training_facilitators(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      subgroup_options JSONB NOT NULL DEFAULT '[]'::jsonb,
      min_prompt_chars INT NOT NULL DEFAULT 40,
      min_output_chars INT NOT NULL DEFAULT 80,
      assessment_intro TEXT NOT NULL DEFAULT '',
      grader_instructions TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_training_assessments_facilitator_id
      ON training_assessments (facilitator_id);
  `);

  await execIgnoreDuplicateColumn(
    pool,
    `ALTER TABLE training_assessments ADD COLUMN submissions_open BOOLEAN NOT NULL DEFAULT TRUE`,
  );
  await execIgnoreDuplicateColumn(
    pool,
    `ALTER TABLE training_assessments ADD COLUMN is_site_default BOOLEAN NOT NULL DEFAULT FALSE`,
  );
}

function sanitizeSlug(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  loadProjectEnv();

  const useRailway = process.argv.includes("--railway-db");
  let connRaw = "";
  if (useRailway) {
    hydrateRailwayCredsFromVault();
    const tok = process.env.RAILWAY_TOKEN?.trim();
    const pid =
      process.env.NOURISHAI_RAILWAY_PROJECT_ID?.trim() ||
      process.env.RAILWAY_PROJECT_ID?.trim();
    if (!tok || !pid) {
      console.error(
        "[create-test-assessment] --railway-db needs RAILWAY_TOKEN and NOURISHAI_RAILWAY_PROJECT_ID (or RAILWAY_PROJECT_ID pointing at nourishai Postgres + app). Prefer NOURISHAI_RAILWAY_PROJECT_ID in vault for the nourishai Railway project.",
      );
      process.exitCode = 1;
      return;
    }
    try {
      connRaw = await resolveRailwayRenderedDatabaseUrl({
        token: tok,
        projectId: pid,
      });
      console.log(
        "[create-test-assessment] Using DATABASE_URL rendered from Railway (not printed).",
      );
    } catch (e) {
      console.error(
        `[create-test-assessment] Railway URL resolve failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      process.exitCode = 1;
      return;
    }
  } else {
    connRaw =
      typeof process.env.DATABASE_URL === "string"
        ? process.env.DATABASE_URL.trim()
        : "";
  }

  const conn = normalizeDatabaseUrl(connRaw);
  if (!conn) {
    console.error(
      "[create-test-assessment] Missing database URL — pass --railway-db (Railway vars) or set DATABASE_URL.",
    );
    process.exitCode = 1;
    return;
  }

  const email = (
    process.env.TARGET_FACILITATOR_EMAIL?.trim() ||
    "fredaanyanwu.k@gmail.com"
  ).toLowerCase();

  const slug =
    sanitizeSlug(process.env.TEST_ASSESSMENT_SLUG) || "freda-foundry-test";
  const title =
    process.env.TEST_ASSESSMENT_TITLE?.trim() || "Foundry test cohort · Freda";

  const subgroupList = [
    "Bethel",
    "Carmel",
    "Eden",
    "Gilead",
    "Goshen",
    "Hebron",
    "Israel",
    "Zion",
    "Other / not listed",
  ];

  const assessmentIntro = [
    "Test cohort — Freda · Qubators Day 03",
    "",
    "Use this hub link for demos. Submit through the portal on the slides with this assessment slug.",
  ].join("\n");

  const graderInstructions = [
    "Standard Day 03 grading: prompt_quality /10, architecture_viability /10.",
    "Require Frontend, Backend/API, Database, Data flow visibility in pasted output.",
    "Respond with JSON-only as baseline Foundry grader.",
  ].join("\n");

  const pool = new pg.Pool({
    connectionString: conn,
    max: 3,
    ssl: ssl(conn),
  });

  try {
    await ensureSchema(pool);

    const fac = await pool.query(
      `SELECT id::text, email, display_name FROM training_facilitators
       WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1`,
      [email],
    );
    if (!fac.rows.length) {
      console.error(
        `[create-test-assessment] No facilitator row for "${email}". Create the trainer account first (admin or facilitator signup flow).`,
      );
      process.exitCode = 1;
      return;
    }

    const facilitatorId = fac.rows[0].id;

    const existing = await pool.query(
      `SELECT id::text AS id, facilitator_id::text AS fid FROM training_assessments
       WHERE lower(slug) = lower($1) LIMIT 1`,
      [slug],
    );

    if (existing.rows.length) {
      const row = existing.rows[0];
      if (String(row.fid) !== facilitatorId) {
        console.error(
          `[create-test-assessment] Slug "${slug}" belongs to another facilitator. Pick a different TEST_ASSESSMENT_SLUG.`,
        );
        process.exitCode = 1;
        return;
      }
      await pool.query(
        `UPDATE training_assessments SET
           title = $2,
           subgroup_options = $3::jsonb,
           min_prompt_chars = 40,
           min_output_chars = 80,
           assessment_intro = $4,
           grader_instructions = $5,
           submissions_open = TRUE,
           is_site_default = FALSE,
           updated_at = NOW()
         WHERE id = $1::uuid`,
        [
          row.id,
          title,
          JSON.stringify(subgroupList),
          assessmentIntro,
          graderInstructions,
        ],
      );
      console.log(`[create-test-assessment] Updated assessment slug="${slug}" for ${email}`);
    } else {
      await pool.query(
        `INSERT INTO training_assessments (
           facilitator_id, title, slug, subgroup_options,
           min_prompt_chars, min_output_chars,
           assessment_intro, grader_instructions,
           submissions_open, is_site_default
         ) VALUES (
           $1::uuid, $2, $3, $4::jsonb,
           40, 80, $5, $6, TRUE, FALSE
         )`,
        [
          facilitatorId,
          title,
          slug,
          JSON.stringify(subgroupList),
          assessmentIntro,
          graderInstructions,
        ],
      );
      console.log(`[create-test-assessment] Created assessment slug="${slug}" for ${email}`);
    }

    const originHint =
      process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") ||
      "https://aibuilders.up.railway.app";
    console.log("");
    console.log("[create-test-assessment] Learner URLs:");
    console.log(`  Class hub · ${originHint}/learn/${encodeURIComponent(slug)}`);
    console.log(
      `  Slides / portal · ${originHint}/foundry/deck/${encodeURIComponent(slug)} (legacy ?assessment= on /foundry/day03 still works)`,
    );
    console.log("");
    console.log(`Facilitator: ${fac.rows[0].email} (${fac.rows[0].display_name || "no display name"})`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[create-test-assessment]", e);
  process.exitCode = 1;
});
