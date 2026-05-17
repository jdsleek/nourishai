#!/usr/bin/env node
/**
 * Organizer / DBA helper: bulk reassign facilitator_id on rows in training_assessments.
 *
 * From food-app/:
 *   REASSIGN_TO_EMAIL=trainer@corp.com DEMO_FACILITATOR_EMAIL=old@corp.com \\
 *     npm run facilitator:reassign-assessments -- --dry-run
 *
 * Filters (at least one):
 *   --from-email <email>           owner to take from (or env DEMO_FACILITATOR_EMAIL)
 *   --slug-prefix siest           slug ILIKE `${prefix}%`
 *   --slugs a,b,c                 exact slugs after lower/trim (comma-separated)
 *
 * Omit dry-run after preview. Never commit secrets — uses DATABASE_URL from env/.env.local.
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

function argvFlags() {
  const args = process.argv.slice(2);
  let dryRun = args.includes("--dry-run");
  let fromEmail = null;
  let slugPrefix = null;
  let slugsCsv = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from-email" && args[i + 1])
      fromEmail = args[++i].trim().toLowerCase();
    else if (args[i] === "--slug-prefix" && args[i + 1])
      slugPrefix = args[++i].trim().toLowerCase();
    else if (args[i] === "--slugs" && args[i + 1]) slugsCsv = args[++i];
  }
  return { dryRun, fromEmail, slugPrefix, slugsCsv };
}

async function main() {
  loadProjectEnv();

  const conn = process.env.DATABASE_URL?.trim();
  if (!conn) {
    console.error("[reassign-assessments] Set DATABASE_URL (e.g. food-app/.env.local)");
    process.exitCode = 1;
    return;
  }

  const toEmailRaw =
    process.env.REASSIGN_TO_EMAIL?.trim().toLowerCase() || "";
  if (!toEmailRaw.includes("@")) {
    console.error(
      "[reassign-assessments] REASSIGN_TO_EMAIL must be a valid facilitator row email.",
    );
    process.exitCode = 1;
    return;
  }

  const { dryRun, fromEmail: fromFlag, slugPrefix, slugsCsv } = argvFlags();
  const fromEmail =
    (fromFlag ||
      process.env.DEMO_FACILITATOR_EMAIL?.trim().toLowerCase() ||
      ""
    ).toLowerCase() || null;

  const slugList = slugsCsv
    ? slugsCsv
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];

  if (!fromEmail && !slugPrefix && slugList.length === 0) {
    console.error(
      "[reassign-assessments] Need at least one filter: --from-email, DEMO_FACILITATOR_EMAIL, --slug-prefix, or --slugs",
    );
    process.exitCode = 1;
    return;
  }

  const pool = new pg.Pool({
    connectionString: conn,
    max: 4,
    ssl: ssl(conn),
  });

  try {
    const {
      rows: [target],
    } = await pool.query(
      `SELECT id, email FROM training_facilitators WHERE lower(email) = lower($1) LIMIT 1`,
      [toEmailRaw],
    );
    if (!target) {
      console.error(`[reassign-assessments] No facilitator row for ${toEmailRaw}`);
      process.exitCode = 1;
      return;
    }
    const targetId = target.id;

    const clauses = [];
    const params = [];
    let n = 1;

    clauses.push(`ta.facilitator_id <> $${n++}::uuid`);
    params.push(targetId);

    if (fromEmail) {
      clauses.push(
        `EXISTS (
          SELECT 1 FROM training_facilitators f
          WHERE f.id = ta.facilitator_id AND lower(f.email) = lower($${n++})
        )`,
      );
      params.push(fromEmail);
    }

    let prefixSafe = slugPrefix ?? "";
    if (prefixSafe) {
      prefixSafe = prefixSafe.replace(/%/g, "");
      clauses.push(`lower(ta.slug) LIKE lower($${n++}) || '%'`);
      params.push(prefixSafe);
    }

    if (slugList.length) {
      clauses.push(`lower(trim(ta.slug)) = ANY($${n++}::text[])`);
      params.push(slugList);
    }

    const whereSql = clauses.join(" AND ");

    const listSql = `
      SELECT ta.id, ta.slug, ta.title, tf.email AS owner_email
      FROM training_assessments ta
      INNER JOIN training_facilitators tf ON tf.id = ta.facilitator_id
      WHERE ${whereSql}
      ORDER BY ta.slug`;

    const { rows: candidates } = await pool.query(listSql, params);

    console.log("");
    console.log(`[reassign-assessments] Target owner: ${toEmailRaw} (${targetId})`);
    console.log(`[reassign-assessments] Matches: ${candidates.length} row(s)`);
    if (candidates.length) {
      for (const r of candidates) {
        console.log(
          `  - ${r.slug} (${r.owner_email}) id=${r.id} — ${String(r.title || "").slice(0, 52)}`,
        );
      }
    }

    if (dryRun || candidates.length === 0) {
      console.log(
        candidates.length === 0
          ? ""
          : dryRun
            ? "\nDry run — no updates."
            : "",
      );
      return;
    }

    const ids = candidates.map((r) => String(r.id));
    const upd = await pool.query(
      `UPDATE training_assessments
       SET facilitator_id = $1::uuid, updated_at = NOW()
       WHERE id = ANY($2::uuid[])`,
      [targetId, ids],
    );

    console.log(`\n[reassign-assessments] Updated ${upd.rowCount} row(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[reassign-assessments]", e);
  process.exitCode = 1;
});
