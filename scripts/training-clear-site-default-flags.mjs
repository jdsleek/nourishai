#!/usr/bin/env node
/**
 * Clears deprecated ministry-wide assessment flags (`is_site_default`) after migrating
 * off the shared “home hub” facilitator rubric behavior.
 *
 * From food-app/ with DATABASE_URL (e.g. in .env.local):
 *   node scripts/training-clear-site-default-flags.mjs
 *
 * Optionally verify assessments for one facilitator email:
 *   FACILITATOR_VERIFY_EMAIL=fredaanyanwu.k@gmail.com node scripts/training-clear-site-default-flags.mjs
 */

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
  for (const name of [".env.local", ".env"]) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    fragments.push(parseEnvLines(fs.readFileSync(p, "utf8")));
  }
  const merged = fragments.reduce((a, b) => ({ ...a, ...b }), {});
  for (const [key, val] of Object.entries(merged)) {
    if (process.env[key] === undefined || process.env[key] === "") process.env[key] = val;
  }
}

function ssl(conn) {
  if (process.env.PG_SSL_DISABLE === "1") return false;
  if (/\?.*sslmode=require/i.test(conn)) return { rejectUnauthorized: false };
  if (process.env.RAILWAY_ENVIRONMENT || /\.railway\.app/i.test(conn))
    return { rejectUnauthorized: false };
  return undefined;
}

async function main() {
  loadProjectEnv();

  const conn = process.env.DATABASE_URL?.trim();
  if (!conn) {
    console.error("[training-clear-site-defaults] Set DATABASE_URL (e.g. in food-app/.env.local)");
    process.exitCode = 1;
    return;
  }

  const pool = new pg.Pool({
    connectionString: conn,
    max: 2,
    ssl: ssl(conn),
  });

  try {
    const cleared = await pool.query(
      `UPDATE training_assessments SET is_site_default = FALSE, updated_at = NOW()
       WHERE COALESCE(is_site_default, FALSE) = TRUE`,
    );
    console.log(
      `[training-clear-site-defaults] Cleared is_site_default on ${cleared.rowCount ?? 0} row(s).`,
    );

    const verifyEmail = process.env.FACILITATOR_VERIFY_EMAIL?.trim();
    if (verifyEmail && verifyEmail.includes("@")) {
      const { rows } = await pool.query(
        `SELECT ta.slug, ta.title, tf.email
         FROM training_assessments ta
         INNER JOIN training_facilitators tf ON tf.id = ta.facilitator_id
         WHERE lower(tf.email) = lower($1)
         ORDER BY ta.updated_at DESC`,
        [verifyEmail],
      );
      console.log(
        `\n[training-clear-site-defaults] Assessments for ${verifyEmail} (${rows.length} row(s)):`,
      );
      for (const r of rows) {
        console.log(`  • ${String(r.slug)} — ${String(r.title)} (${String(r.email)})`);
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[training-clear-site-defaults]", e);
  process.exitCode = 1;
});
