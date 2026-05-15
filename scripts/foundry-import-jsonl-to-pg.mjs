#!/usr/bin/env node
/**
 * Copies historical JSONL submissions into Postgres so they survive deployments.
 *
 * Prerequisites: Postgres reachable via DATABASE_URL (Railway Postgres or local).
 *
 * Usage (from food-app/):
 *   DATABASE_URL='postgresql://…' npm run foundry:import-jsonl
 *   DATABASE_URL='postgresql://…' node scripts/foundry-import-jsonl-to-pg.mjs path/to/backup.jsonl
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function main() {
  const conn = process.env.DATABASE_URL?.trim();
  if (!conn) {
    console.error("Set DATABASE_URL to your Postgres connection string.");
    process.exit(1);
  }

  const argPath =
    process.argv[2] ||
    path.join(__dirname, "..", "data", "foundry-submissions.jsonl");

  let raw;
  try {
    raw = await fs.readFile(argPath, "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Could not read file:", argPath, msg);
    process.exit(1);
  }

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    console.error("JSONL file is empty.");
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: conn,
    max: 2,
    ssl: ssl(conn),
  });

  await ensureSchema(pool);

  let inserted = 0;
  let duplicates = 0;
  let malformed = 0;

  for (const line of lines) {
    let rec;
    try {
      rec = JSON.parse(line);
    } catch (e) {
      console.warn(
        "Skip invalid JSON:",
        line.slice(0, 120),
        e instanceof Error ? e.message : e
      );
      malformed += 1;
      continue;
    }

    try {
      const r =
        typeof rec.result === "string" ? JSON.parse(rec.result) : rec.result;

      const res = await pool.query(
        `INSERT INTO foundry_submissions
          (id, submitted_at, fellow_name, subgroup, ide, prompt, output, result)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [
          rec.id,
          rec.submittedAt,
          rec.fellowName,
          rec.subgroup,
          rec.ide ?? "",
          rec.prompt,
          rec.output,
          JSON.stringify(r),
        ]
      );

      if (res.rowCount === 1) inserted += 1;
      else duplicates += 1;
    } catch (e) {
      console.warn(
        "Skip row (DB/required fields):",
        line.slice(0, 120),
        e instanceof Error ? e.message : e
      );
      malformed += 1;
    }
  }

  await pool.end();

  console.log(
    `Done (${lines.length} lines): inserted=${inserted}, already present=${duplicates}, skipped/errors=${malformed}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
