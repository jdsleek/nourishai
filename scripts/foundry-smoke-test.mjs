#!/usr/bin/env node
/**
 * Smoke test: Postgres + optional live API (grading + admin).
 *
 * Usage:
 *   node scripts/foundry-smoke-test.mjs                    # DATABASE_URL + schema (transaction rolled back)
 *   node scripts/foundry-smoke-test.mjs --api              # plus GET /api/foundry/admin/submissions (server must run)
 *   node scripts/foundry-smoke-test.mjs --api --grade       # plus POST /api/foundry/grade (Groq burn)
 *
 * Loads food-app/.env then .env.local into process.env when present.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function parseEnvLines(text) {
  /** @type {Record<string, string>} */
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

/**
 * Mimics typical Next layering: `.env` then `.env.local` precedence.
 * Never replaces a non‑empty shell / already-set env value.
 */
function loadProjectEnv() {
  const fragments = [];
  for (const name of [".env", ".env.local"]) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    fragments.push(parseEnvLines(fs.readFileSync(p, "utf8")));
  }
  /** @type {Record<string, string>} */
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
}

const SAMPLE_PROMPT =
  String.raw`Role: You are a test architect.` +
  ` Task: Design a trivial API.` +
  ` Context: Smoke test cohort.` +
  ` Constraints: Minimal stack only.` +
  ` Output Format: Markdown sections Frontend, Backend, Database, Flow.`;

const SAMPLE_OUTPUT =
  `### Frontend Stack\nReact SPA on Vite.` +
  ` ### Backend API\nREST with Node.` +
  ` ### Database Schema\nPostgres tables users(id), items(id,user_id).` +
  ` ### Data Flow\nBrowser calls API, API queries DB, JSON back to client.` +
  ` Extra padding so length exceeds eighty characters for validator.`;

async function smokeDatabase() {
  const conn = process.env.DATABASE_URL?.trim();
  if (!conn) {
    console.error(`
DATABASE_URL is not set.

If you configure Postgres only on Railway: copy the Postgres service "DATABASE_URL"
(Railway → Database → Variables) and run ONE of:

  DATABASE_URL='postgresql://…' npm run foundry:smoke
  DATABASE_URL='postgresql://…' npm run foundry:smoke -- --api --grade

Or add DATABASE_URL to food-app/.env.local (recommended for full local parity).
`);
    throw new Error("DATABASE_URL missing (set in .env.local or environment).");
  }

  const pool = new pg.Pool({
    connectionString: conn,
    max: 2,
    ssl: ssl(conn),
  });

  await ensureSchema(pool);

  const testId = crypto.randomUUID();
  const now = new Date().toISOString();
  /** Minimal valid grade JSON matching current FoundryGradeResult shape */
  const result = {
    total_score: 12,
    grade: "REVIEW",
    breakdown: {
      prompt_quality: { score: 6, feedback: "Smoke test bucket A." },
      architecture_viability: { score: 6, feedback: "Smoke test bucket B." },
    },
    level_up_tip: "Smoke test tip.",
    verdict: "Smoke test verdict line for persistence check.",
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO foundry_submissions
        (id, submitted_at, fellow_name, subgroup, ide, prompt, output, result)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        testId,
        now,
        "Foundry Smoke",
        "Zion",
        "",
        SAMPLE_PROMPT,
        SAMPLE_OUTPUT,
        JSON.stringify(result),
      ]
    );

    const { rows } = await client.query(
      "SELECT fellow_name, result->>'grade' AS g FROM foundry_submissions WHERE id = $1",
      [testId]
    );

    await client.query("ROLLBACK");

    if (rows.length !== 1 || rows[0].fellow_name !== "Foundry Smoke") {
      throw new Error("Unexpected row after insert.");
    }

    console.log("[db] OK — connected, migrated, insert/select with ROLLBACK (no stray rows).");

    /** After rollback, verify row invisible */
    const after = await pool.query(
      "SELECT 1 FROM foundry_submissions WHERE id = $1",
      [testId]
    );
    if ((after.rowCount ?? 0) !== 0) {
      throw new Error("Rollback did not remove smoke row.");
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log("[db] OK — transactional smoke row absent after rollback.");
}

async function smokeAdmin(base) {
  const pwd =
    process.env.FOUNDRY_ADMIN_PASSWORD?.trim() || getDefaultAdminPw();
  const url = new URL("/api/foundry/admin/submissions", base.replace(/\/$/, ""));
  const res = await fetch(url, {
    headers: { "x-foundry-admin-password": pwd },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GET admin failed ${res.status}: ${text.slice(0, 200)}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Admin response not JSON.");
  }
  const n = Array.isArray(data.submissions) ? data.submissions.length : -1;
  if (n < 0) {
    throw new Error("Admin payload missing submissions array.");
  }

  console.log(`[admin] OK — fetched ${n} submission(s).`);
}

function getDefaultAdminPw() {
  return "10101010";
}

async function smokeGrade(base) {
  if (!process.env.GROQ_API_KEY?.trim()) {
    throw new Error("GROQ_API_KEY missing — cannot POST /api/foundry/grade.");
  }
  const url = new URL("/api/foundry/grade", base.replace(/\/$/, ""));
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Smoke Grader User",
      subgroup: "Zion",
      prompt: SAMPLE_PROMPT,
      output: SAMPLE_OUTPUT,
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("[grade] body:", text.slice(0, 500));
    throw new Error(`Grade parse error (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    throw new Error(`POST grade HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  const ok = Boolean(data.ok && data.result?.total_score != null);
  if (!ok) throw new Error("Grade payload missing ok/result.");

  console.log(
    `[grade] OK — score ${data.result.total_score}/20, persisted=${String(data.persisted)}`
  );
}

async function main() {
  loadProjectEnv();
  const argv = process.argv.slice(2);
  const api = argv.includes("--api") || argv.includes("--with-api");
  const grade = argv.includes("--grade");
  const baseArg =
    argv.find((a) => a.startsWith("--base="))?.slice("--base=".length) ||
    process.env.FOUNDRY_SMOKE_BASE ||
    "http://127.0.0.1:3000";

  await smokeDatabase();

  if (api) {
    await smokeAdmin(baseArg);
    if (grade) {
      await smokeGrade(baseArg);
    } else {
      console.log("[grade] skipped (pass --grade to POST /api/foundry/grade; uses Groq).");
    }
  } else {
    console.log("[api] skipped (pass --api with dev server running to hit admin.).");
  }

  console.log("All smoke checks passed.");
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e.message || e);
  process.exit(1);
});
