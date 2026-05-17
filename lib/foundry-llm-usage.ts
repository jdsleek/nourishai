import type { Pool } from "pg";

export type FoundryLlmUsageInsert = {
  source: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  submissionId: string | null;
  estimated: boolean;
};

export type FoundryLlmUsageTotals = {
  metered: {
    gradingCalls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  reconstructed: {
    gradingCalls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  combined: {
    gradingCalls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

let schemaLatch: Promise<void> | null = null;

async function migrateFoundryLlmUsageTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS foundry_llm_usage_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source TEXT NOT NULL DEFAULT 'grading',
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INT NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
      completion_tokens INT NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
      total_tokens BIGINT NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
      submission_id UUID NULL,
      estimated BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE INDEX IF NOT EXISTS idx_foundry_llm_usage_created_at
      ON foundry_llm_usage_events (created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_foundry_llm_usage_submission
      ON foundry_llm_usage_events (submission_id)
      WHERE submission_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS ux_foundry_llm_usage_metered_submission
      ON foundry_llm_usage_events (submission_id)
      WHERE submission_id IS NOT NULL AND estimated = FALSE;

    CREATE UNIQUE INDEX IF NOT EXISTS ux_foundry_llm_usage_estimated_submission
      ON foundry_llm_usage_events (submission_id)
      WHERE submission_id IS NOT NULL AND estimated = TRUE;
  `);

  /** Heuristic totals for graded rows that pre‑date metering (~4 chars per token + rubric overhead). */
  await pool.query(`
    INSERT INTO foundry_llm_usage_events (
      created_at,
      source,
      provider,
      model,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      submission_id,
      estimated
    )
    SELECT
      fs.submitted_at,
      'grading',
      'reconstructed',
      'unknown',
      GREATEST(1,
        CEIL((LENGTH(fs.prompt)::float + LENGTH(fs.output)::float) / 4.0)::int + 3600
      ),
      GREATEST(120,
        CEIL(pg_column_size(fs.result)::float / 4.0)::int
      ),
      (
        GREATEST(1,
          CEIL((LENGTH(fs.prompt)::float + LENGTH(fs.output)::float) / 4.0)::int + 3600
        )
        + GREATEST(120,
          CEIL(pg_column_size(fs.result)::float / 4.0)::int
        )
      )::bigint,
      fs.id::uuid,
      TRUE
    FROM foundry_submissions fs
    WHERE NOT EXISTS (
      SELECT 1
      FROM foundry_llm_usage_events e
      WHERE e.submission_id = fs.id::uuid
    );
  `);
}

export async function ensureFoundryLlmUsageSchema(pool: Pool): Promise<void> {
  if (!schemaLatch) {
    schemaLatch = migrateFoundryLlmUsageTable(pool).catch((e) => {
      schemaLatch = null;
      throw e;
    });
  }
  await schemaLatch;
}

export async function insertFoundryLlmUsageEvent(
  pool: Pool,
  row: FoundryLlmUsageInsert,
): Promise<void> {
  await ensureFoundryLlmUsageSchema(pool);

  try {
    await pool.query(
      `INSERT INTO foundry_llm_usage_events
         (source, provider, model, prompt_tokens, completion_tokens, total_tokens,
          submission_id, estimated)
       VALUES ($1, $2, $3, $4, $5, $6, $7::uuid, $8)`,
      [
        row.source,
        row.provider.slice(0, 120),
        row.model.slice(0, 240),
        row.promptTokens,
        row.completionTokens,
        row.totalTokens,
        row.submissionId,
        row.estimated,
      ],
    );
  } catch (e: unknown) {
    const pg = e as { code?: string };
    if (pg.code === "23505") {
      console.warn("[foundry-llm-usage] duplicate usage row skipped", row.submissionId);
      return;
    }
    throw e;
  }
}

export async function getFoundryLlmUsageTotals(
  pool: Pool,
): Promise<FoundryLlmUsageTotals | null> {
  await ensureFoundryLlmUsageSchema(pool);

  type Row = {
    metered_calls: string | null;
    metered_pt: string | null;
    metered_ct: string | null;
    metered_tt: string | null;
    recon_calls: string | null;
    recon_pt: string | null;
    recon_ct: string | null;
    recon_tt: string | null;
  };

  const { rows } = await pool.query<Row>(
    `SELECT
       COUNT(*) FILTER (WHERE NOT estimated)::text AS metered_calls,
       COALESCE(SUM(prompt_tokens) FILTER (WHERE NOT estimated), 0)::text AS metered_pt,
       COALESCE(SUM(completion_tokens) FILTER (WHERE NOT estimated), 0)::text AS metered_ct,
       COALESCE(SUM(total_tokens) FILTER (WHERE NOT estimated), 0)::text AS metered_tt,

       COUNT(*) FILTER (WHERE estimated)::text AS recon_calls,
       COALESCE(SUM(prompt_tokens) FILTER (WHERE estimated), 0)::text AS recon_pt,
       COALESCE(SUM(completion_tokens) FILTER (WHERE estimated), 0)::text AS recon_ct,
       COALESCE(SUM(total_tokens) FILTER (WHERE estimated), 0)::text AS recon_tt
     FROM foundry_llm_usage_events
     WHERE source = 'grading'`,
  );

  const r = rows[0];
  const parseN = (s: string | null | undefined): number =>
    Number.parseInt(String(s ?? "0").replace(/\s/g, ""), 10) || 0;
  const parseBig = (s: string | null | undefined): number => {
    const n = Number(String(s ?? "0").replace(/\s/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const mc = parseN(r?.metered_calls);
  const mpt = parseN(r?.metered_pt);
  const mct = parseN(r?.metered_ct);
  const mtt = parseBig(r?.metered_tt) || mpt + mct;

  const rc = parseN(r?.recon_calls);
  const rpt = parseN(r?.recon_pt);
  const rct = parseN(r?.recon_ct);
  const rtt = parseBig(r?.recon_tt) || rpt + rct;

  const cCalls = mc + rc;
  const cpt = mpt + rpt;
  const cct = mct + rct;
  const ctt = mtt + rtt;

  return {
    metered: {
      gradingCalls: mc,
      promptTokens: mpt,
      completionTokens: mct,
      totalTokens: mtt,
    },
    reconstructed: {
      gradingCalls: rc,
      promptTokens: rpt,
      completionTokens: rct,
      totalTokens: rtt,
    },
    combined: {
      gradingCalls: cCalls,
      promptTokens: cpt,
      completionTokens: cct,
      totalTokens: ctt,
    },
  };
}
