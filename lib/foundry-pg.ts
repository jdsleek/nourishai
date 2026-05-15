import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import type { FoundrySubmissionRecord } from "@/lib/foundry-store";

function sslOption(conn: string): boolean | { rejectUnauthorized: boolean } | undefined {
  if (process.env.PG_SSL_DISABLE === "1") return false;
  if (/\?.*sslmode=require/i.test(conn) || /\?.*sslmode=verify-full/i.test(conn)) {
    return { rejectUnauthorized: false };
  }
  if (
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    /\.railway\.app/i.test(conn)
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

const globalForPg = globalThis as unknown as { foundryPool?: Pool };

export function getFoundryPgPool(): Pool | null {
  const conn = process.env.DATABASE_URL?.trim();
  if (!conn) return null;
  if (!globalForPg.foundryPool) {
    globalForPg.foundryPool = new PgPool({
      connectionString: conn,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8000,
      ssl: sslOption(conn),
    });
  }
  return globalForPg.foundryPool;
}

let schemaReady: Promise<void> | null = null;

export async function ensureFoundrySubmissionsSchema(
  pool: Pool
): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool
      .query(`
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
      `)
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null;
        throw e;
      });
  }
  await schemaReady;
}

function rowToRecord(row: Record<string, unknown>): FoundrySubmissionRecord {
  return {
    id: String(row.id),
    submittedAt: row.submitted_at
      ? new Date(row.submitted_at as string).toISOString()
      : "",
    fellowName: String(row.fellow_name ?? ""),
    subgroup: String(row.subgroup ?? ""),
    ide: String(row.ide ?? ""),
    prompt: String(row.prompt ?? ""),
    output: String(row.output ?? ""),
    result:
      typeof row.result === "string"
        ? (JSON.parse(row.result) as FoundrySubmissionRecord["result"])
        : (row.result as FoundrySubmissionRecord["result"]),
  };
}

export async function pgInsertSubmission(
  client: Pool,
  rec: FoundrySubmissionRecord
): Promise<void> {
  await client.query(
    `INSERT INTO foundry_submissions
      (id, submitted_at, fellow_name, subgroup, ide, prompt, output, result)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      rec.id,
      rec.submittedAt,
      rec.fellowName,
      rec.subgroup,
      rec.ide,
      rec.prompt,
      rec.output,
      JSON.stringify(rec.result),
    ]
  );
}

export async function pgListSubmissionsNewestFirst(
  pool: Pool
): Promise<FoundrySubmissionRecord[]> {
  const { rows } = await pool.query(
    `SELECT id, submitted_at, fellow_name, subgroup, ide, prompt, output, result
     FROM foundry_submissions
     ORDER BY submitted_at DESC`
  );
  return rows.map((r) => rowToRecord(r as Record<string, unknown>));
}
