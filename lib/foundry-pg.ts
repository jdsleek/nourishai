import type { Pool } from "pg";
import { Pool as PgPool } from "pg";
import type { FoundrySubmissionRecord } from "@/lib/foundry-store";
import { ensureTrainingSchema } from "@/lib/training-pg";

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

export async function ensureFoundrySubmissionsSchema(pool: Pool): Promise<void> {
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
      .then(async () => {
        /** Add training_* tables & optional assessment FK — additive only */
        await ensureTrainingSchema(pool);
      })
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null;
        throw e;
      });
  }
  await schemaReady;
}

function rowToRecord(row: Record<string, unknown>): FoundrySubmissionRecord {
  const assessmentIdRaw = row.assessment_id;
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
    assessmentId:
      assessmentIdRaw != null && String(assessmentIdRaw).length
        ? String(assessmentIdRaw)
        : null,
    assessmentSlug:
      row.assessment_slug != null ? String(row.assessment_slug) : null,
    assessmentTitle:
      row.assessment_title != null ? String(row.assessment_title) : null,
  };
}

export async function pgInsertSubmission(
  client: Pool,
  rec: FoundrySubmissionRecord
): Promise<void> {
  await client.query(
    `INSERT INTO foundry_submissions
      (id, submitted_at, fellow_name, subgroup, ide, prompt, output, result, assessment_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
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
      rec.assessmentId ?? null,
    ]
  );
}

export async function pgListSubmissionsNewestFirst(
  pool: Pool
): Promise<FoundrySubmissionRecord[]> {
  const { rows } = await pool.query(
    `SELECT fs.id, fs.submitted_at, fs.fellow_name, fs.subgroup, fs.ide,
            fs.prompt, fs.output, fs.result, fs.assessment_id,
            ta.slug AS assessment_slug,
            ta.title AS assessment_title
     FROM foundry_submissions fs
     LEFT JOIN training_assessments ta ON ta.id = fs.assessment_id
     ORDER BY fs.submitted_at DESC`
  );
  return rows.map((r) => rowToRecord(r as Record<string, unknown>));
}

/** True if a row existed and was removed. */
export async function pgDeleteSubmissionById(pool: Pool, id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM foundry_submissions WHERE id = $1::uuid RETURNING id`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}
