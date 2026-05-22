#!/usr/bin/env node
/**
 * Seed Day 04 live assessment (Postgres). Idempotent for same email+slug.
 *
 *   cd food-app && node scripts/training-seed-day04-live.mjs
 *
 * Env: DATABASE_URL (or .env.local), optional TARGET_FACILITATOR_EMAIL
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { resolveRailwayRenderedDatabaseUrl } from "./lib/railway-gql-vars.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SLUG = "qaf-day04-idea-to-product";
const TITLE = "Day 04 · From Idea to Working Product";

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
  const files = [
    path.join(ROOT, ".env"),
    path.join(ROOT, ".env.local"),
    path.join(ROOT, "..", "vault", ".env"),
  ];
  for (const p of files) {
    if (!fs.existsSync(p)) continue;
    const parsed = parseEnvLines(fs.readFileSync(p, "utf8"));
    for (const [key, val] of Object.entries(parsed)) {
      if (!process.env[key]?.trim()) process.env[key] = val;
    }
  }
}

function ssl(conn) {
  if (process.env.PG_SSL_DISABLE === "1") return false;
  if (
    /\b(?:localhost|127\.0\.0\.1)\b(?=[:/?]|$)/i.test(
      conn.replace(/postgres(ql)?:\/\//i, ""),
    )
  ) {
    return undefined;
  }
  return { rejectUnauthorized: false };
}

const SUBGROUPS = [
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

const INTRO = [
  "Day 04 · From Idea to Working Product",
  "",
  "Today you ship a clickable MVP: UI (Part 1) + basic data logic (Part 2 with Deacon Gift).",
  "",
  "Slides (full class): /foundry/day04",
  "Part 2 only: /foundry/day04-backend",
  "",
  "Submit here when your demo passes the checklist on the last slide.",
].join("\n");

const GRADER = [
  "Grade Day 04 MVP submission. Return JSON only with keys: total_score (0-20), grade (GO|REVIEW|REBUILD), breakdown.prompt_quality (/10), breakdown.architecture_viability (/10), level_up_tip, verdict.",
  "",
  "Map categories:",
  "- prompt_quality (/10) = UI craft: mobile-readable layout, clear primary CTA, matches their product idea, not generic AI template slop.",
  "- architecture_viability (/10) = Backend logic: primary button saves data (localStorage or equivalent), list/panel updates, refresh persists, data-driven ideas show at least one computed insight.",
  "",
  "GO >= 15, REVIEW 10-14, REBUILD < 9.",
  "Cap architecture_viability at 4/10 if no persistence or button does nothing.",
  "Address student by first name in verdict.",
].join("\n");

const PORTAL_FORM = {
  prompt: {
    label: "03 · Frontend build prompt (5 pillars)",
    hint: "Paste the exact Cursor prompt used to generate index.html (Role, Task, Context, Constraints, Format).",
    placeholder:
      "Role: Senior product UI engineer...\nTask: One index.html + embedded CSS for...\nContext: [your QAF idea]...\nConstraints: mobile-first, single file, no frameworks...\nFormat: Hero / Main / Footer sections...",
    fieldError: "Paste your full frontend prompt.",
  },
  output: {
    label: "04 · app.js + data logic (paste key parts)",
    hint: "Paste your app.js (or the functions that save/load data and wire the primary button). Include how refresh still shows data.",
    placeholder:
      "// loadData / saveData / renderList / renderInsights\n// PRIMARY_ACTION: ...",
    fieldError: "Paste enough app.js logic to show persistence and the primary action.",
  },
  extra_answer_slots: [
    {
      id: "demo",
      label: "05 · Live demo checklist",
      hint: "Confirm each line: YES or NO, then one sentence on what your primary button does.",
      placeholder:
        "1. Primary button works without DevTools only: YES/NO\n2. Added 2+ items: YES/NO\n3. Refresh keeps data: YES/NO\n4. Insights panel shows a stat (data-driven): YES/NO or N/A\n5. One sentence: On click, I store ___ and update ___.",
      required: true,
    },
    {
      id: "handoff",
      label: "06 · HTML hooks (ids you used)",
      hint: "List ids: btn-primary, inputs, list-root, insights-panel — so graders can verify handoff.",
      placeholder: "btn-primary, input-member, list-root, insights-panel",
      required: false,
    },
  ],
};

const CHECKLIST = [
  "index.html opens in browser with your product name visible",
  "app.js linked; primary button saves and re-renders a list",
  "Refresh browser — data still visible",
  "Paste frontend prompt + app.js + demo checklist before you leave",
];

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
  `);
  for (const sql of [
    `ALTER TABLE training_assessments ADD COLUMN submissions_open BOOLEAN NOT NULL DEFAULT TRUE`,
    `ALTER TABLE training_assessments ADD COLUMN is_site_default BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE training_assessments ADD COLUMN level_up_url TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE training_assessments ADD COLUMN student_checklist JSONB NOT NULL DEFAULT '[]'::jsonb`,
    `ALTER TABLE training_assessments ADD COLUMN portal_form_copy JSONB NOT NULL DEFAULT '{}'::jsonb`,
  ]) {
    await execIgnoreDuplicateColumn(pool, sql);
  }
}

function hydrateRailwayCredsFromVault() {
  const p = path.join(ROOT, "..", "vault", ".env");
  if (!fs.existsSync(p)) return;
  const parsed = parseEnvLines(fs.readFileSync(p, "utf8"));
  for (const key of ["RAILWAY_TOKEN", "RAILWAY_PROJECT_ID", "NOURISHAI_RAILWAY_PROJECT_ID"]) {
    if (!process.env[key]?.trim() && parsed[key]) process.env[key] = parsed[key];
  }
}

async function main() {
  loadProjectEnv();
  const useRailway = process.argv.includes("--railway-db");
  let conn = process.env.DATABASE_URL?.trim() || "";
  if (useRailway) {
    hydrateRailwayCredsFromVault();
    const tok = process.env.RAILWAY_TOKEN?.trim();
    const pid =
      process.env.NOURISHAI_RAILWAY_PROJECT_ID?.trim() ||
      process.env.RAILWAY_PROJECT_ID?.trim();
    if (!tok || !pid) {
      console.error("--railway-db needs RAILWAY_TOKEN + NOURISHAI_RAILWAY_PROJECT_ID");
      process.exitCode = 1;
      return;
    }
    conn = await resolveRailwayRenderedDatabaseUrl({ token: tok, projectId: pid });
  }
  if (!conn) {
    console.error("Set DATABASE_URL in .env.local or run with --railway-db");
    process.exitCode = 1;
    return;
  }

  const email = (
    process.env.TARGET_FACILITATOR_EMAIL?.trim() ||
    process.env.DEMO_FACILITATOR_EMAIL?.trim() ||
    "nourishai-demo-facilitator@example.local"
  ).toLowerCase();

  const pool = new pg.Pool({ connectionString: conn, max: 3, ssl: ssl(conn) });
  try {
    await ensureSchema(pool);
    const fac = await pool.query(
      `SELECT id::text FROM training_facilitators WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1`,
      [email],
    );
    if (!fac.rows.length) {
      console.error(`No facilitator for ${email}. Run npm run facilitator:demo-seed first.`);
      process.exitCode = 1;
      return;
    }
    const facilitatorId = fac.rows[0].id;

    const existing = await pool.query(
      `SELECT id::text AS id, facilitator_id::text AS fid FROM training_assessments WHERE lower(slug) = lower($1) LIMIT 1`,
      [SLUG],
    );

    const payload = [
      TITLE,
      JSON.stringify(SUBGROUPS),
      INTRO,
      GRADER,
      JSON.stringify(CHECKLIST),
      JSON.stringify(PORTAL_FORM),
    ];

    if (existing.rows.length) {
      if (String(existing.rows[0].fid) !== facilitatorId) {
        console.error(`Slug ${SLUG} owned by another facilitator.`);
        process.exitCode = 1;
        return;
      }
      await pool.query(
        `UPDATE training_assessments SET
           title = $2, subgroup_options = $3::jsonb,
           min_prompt_chars = 40, min_output_chars = 60,
           assessment_intro = $4, grader_instructions = $5,
           student_checklist = $6::jsonb, portal_form_copy = $7::jsonb,
           submissions_open = TRUE, updated_at = NOW()
         WHERE id = $1::uuid`,
        [existing.rows[0].id, ...payload],
      );
      console.log(`Updated assessment "${SLUG}"`);
    } else {
      await pool.query(
        `INSERT INTO training_assessments (
           facilitator_id, title, slug, subgroup_options,
           min_prompt_chars, min_output_chars,
           assessment_intro, grader_instructions,
           submissions_open, is_site_default,
           student_checklist, portal_form_copy
         ) VALUES ($1::uuid, $2, $3, $4::jsonb, 40, 60, $5, $6, TRUE, FALSE, $7::jsonb, $8::jsonb)`,
        [facilitatorId, TITLE, SLUG, JSON.stringify(SUBGROUPS), INTRO, GRADER, JSON.stringify(CHECKLIST), JSON.stringify(PORTAL_FORM)],
      );
      console.log(`Created assessment "${SLUG}"`);
    }

    const origin =
      process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";
    console.log("");
    console.log("Day 04 LIVE links:");
    console.log(`  Class hub   · ${origin}/learn/${SLUG}`);
    console.log(`  Full slides · ${origin}/foundry/day04`);
    console.log(`  Part 2 only · ${origin}/foundry/day04-backend`);
    console.log(`  Submit deck · ${origin}/foundry/day04?assessment=${SLUG}&step=submit`);
    console.log(`  Deck+grade  · ${origin}/foundry/deck/${SLUG}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
