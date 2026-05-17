#!/usr/bin/env node
/**
 * Creates (or resets password for) a demo facilitator row in Postgres only.
 *
 * From food-app/:
 *   npm run facilitator:demo-seed
 *
 * Override email / password (≥10 chars) with env vars; never commits secrets.
 * Loads `.env` then `.env.local` when DATABASE_URL missing in shell.
 */

import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

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

function ssl(conn) {
  if (process.env.PG_SSL_DISABLE === "1") return false;
  if (/\?.*sslmode=require/i.test(conn))
    return { rejectUnauthorized: false };
  if (process.env.RAILWAY_ENVIRONMENT || /\.railway\.app/i.test(conn))
    return { rejectUnauthorized: false };
  return undefined;
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
    CREATE TABLE IF NOT EXISTS foundry_submissions (
      id UUID PRIMARY KEY,
      submitted_at TIMESTAMPTZ NOT NULL,
      fellow_name TEXT NOT NULL,
      subgroup TEXT NOT NULL,
      ide TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL,
      output TEXT NOT NULL,
      result JSONB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_foundry_submissions_submitted_at
      ON foundry_submissions (submitted_at DESC);
  `);

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
    `ALTER TABLE foundry_submissions ADD COLUMN assessment_id UUID REFERENCES training_assessments(id) ON DELETE SET NULL`,
  );

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_foundry_submissions_assessment_id
      ON foundry_submissions (assessment_id);
  `).catch(() => undefined);
}

const DEMO_DESK_ASSESSMENT_SLUG =
  process.env.DEMO_DESK_ASSESSMENT_SLUG?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") ||
  "demo-foundry-desk";

async function upsertDemoAssessment(pool, facilitatorId) {
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

  const assessmentIntro =
    process.env.DEMO_DESK_CLASS_TEXT?.trim() ||
    [
      "Demo class desk (sample cohort)",
      "",
      'This banner is saved in Postgres as your facilitator “class desk.” Learners at your deck URL see it above the shared Qubators Day 03 slides.',
      "",
      "Today:",
      "• Paste a five‑pillar architecture prompt (Role, Task, Context, Constraints, Format) verbatim.",
      "• Paste model output where Frontend, Backend/API, Database, and Data flow are all visible.",
      "• Subgroup must match your ideation intake form.",
    ].join("\n");

  const graderInstructions =
    process.env.DEMO_DESK_GRADER_INSTRUCTIONS?.trim() ||
    [
      "Follow standard Day 03 buckets (prompt_quality /10, architecture_viability /10) but:",
      "",
      '- cap architecture_viability at 6/10 if Frontend, Backend/API, Database, or Data flow is missing or waffle‑only;',
      '- name which section failed in breakdown feedback;',
      "- keep JSON-only response contract identical to baseline Foundry grader.",
    ].join("\n");

  try {
    const title =
      process.env.DEMO_DESK_TITLE?.trim() || "Demo class desk · sample cohort";

    const { rows } = await pool.query(
      `SELECT id, facilitator_id::text AS fid FROM training_assessments
       WHERE lower(slug) = lower($1) LIMIT 1`,
      [DEMO_DESK_ASSESSMENT_SLUG],
    );

    if (rows.length) {
      const owner = rows[0].fid;
      if (owner !== facilitatorId) {
        console.warn(
          `[demo-facilitator] Slug '${DEMO_DESK_ASSESSMENT_SLUG}' belongs to another facilitator — skipping demo desk seed.`,
        );
        return;
      }
      await pool.query(
        `UPDATE training_assessments SET title = $2, subgroup_options = $3::jsonb,
            min_prompt_chars = 40, min_output_chars = 80,
            assessment_intro = $4, grader_instructions = $5,
            submissions_open = TRUE, updated_at = NOW()
         WHERE id = $1::uuid`,
        [
          rows[0].id,
          title,
          JSON.stringify(subgroupList),
          assessmentIntro,
          graderInstructions,
        ],
      );
    } else {
      await pool.query(
        `INSERT INTO training_assessments (
           facilitator_id, title, slug, subgroup_options,
           min_prompt_chars, min_output_chars, assessment_intro, grader_instructions, submissions_open
         ) VALUES ($1, $2, $3, $4::jsonb, 40, 80, $5, $6, TRUE)`,
        [
          facilitatorId,
          title,
          DEMO_DESK_ASSESSMENT_SLUG,
          JSON.stringify(subgroupList),
          assessmentIntro,
          graderInstructions,
        ],
      );
    }

    console.log("[demo-facilitator] Sample class desk assessment ready:");
    console.log(`  Deck URL · /foundry/deck/${encodeURIComponent(DEMO_DESK_ASSESSMENT_SLUG)}`);
    console.log(`  Hub URL  · /learn/${encodeURIComponent(DEMO_DESK_ASSESSMENT_SLUG)}`);
  } catch (e) {
    console.warn(
      "[demo-facilitator] Could not upsert demo assessment (non-fatal):",
      e instanceof Error ? e.message : e,
    );
  }
}

async function main() {
  loadProjectEnv();

  const conn = process.env.DATABASE_URL?.trim();
  if (!conn) {
    console.error(
      "[demo-facilitator] Set DATABASE_URL (e.g. in food-app/.env.local)",
    );
    process.exitCode = 1;
    return;
  }

  const email = (
    process.env.DEMO_FACILITATOR_EMAIL?.trim().toLowerCase() ||
    "nourishai-demo-facilitator@example.local"
  ).toLowerCase();

  let password =
    process.env.DEMO_FACILITATOR_PASSWORD?.trim() || "DemoCoach2026!";
  if (password.length < 10) {
    console.error(
      "[demo-facilitator] Password must be ≥10 chars (set DEMO_FACILITATOR_PASSWORD).",
    );
    process.exitCode = 1;
    return;
  }

  const displayName =
    process.env.DEMO_FACILITATOR_DISPLAY?.trim() || "Demo facilitator";

  const pool = new pg.Pool({
    connectionString: conn,
    max: 3,
    ssl: ssl(conn),
  });

  try {
    await ensureSchema(pool);
    const hash = bcrypt.hashSync(password, 11);

    const { rows } = await pool.query(
      `INSERT INTO training_facilitators (email, password_hash, display_name)
       VALUES (lower(trim($1)), $2, trim($3))
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         display_name = EXCLUDED.display_name
       RETURNING id, email, display_name`,
      [email, hash, displayName],
    );

    const r = rows[0];
    const usingEnvPwd = Boolean(process.env.DEMO_FACILITATOR_PASSWORD?.trim());
    await upsertDemoAssessment(pool, r.id);

    console.log("");
    console.log("[demo-facilitator] OK — facilitator row upserted in THIS database.");
    console.log(
      "[demo-facilitator] Trainer login connects to DATABASE_URL above — production sign-in fails if that URL is NOT the Railway service Postgres.",
    );
    console.log("[demo-facilitator] Ready for trainer login:");
    console.log(`  Login URL : /training/facilitator/login`);
    console.log(`  Email     : ${r.email}`);
    console.log(
      usingEnvPwd
        ? `  Password  : (from DEMO_FACILITATOR_PASSWORD)`
        : `  Password  : DemoCoach2026!`,
    );
    console.log(`  Display   : ${r.display_name}`);
    console.log("");
    console.log("Rotate the password anywhere except local sandboxes.");
    console.log("");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[demo-facilitator]", e);
  process.exitCode = 1;
});
