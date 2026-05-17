import type { Pool } from "pg";

export type TrainingFacilitatorRow = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
};

export type TrainingAssessmentRow = {
  id: string;
  facilitator_id: string;
  title: string;
  slug: string;
  subgroup_options: string[];
  min_prompt_chars: number;
  min_output_chars: number;
  grader_instructions: string;
  assessment_intro: string;
  /** False → learners cannot POST new grades for this slug (admin-managed). */
  submissions_open: boolean;
  created_at: string;
  updated_at: string;
};

export type AssessmentLockSummary = {
  id: string;
  slug: string;
  title: string;
  facilitatorEmail: string;
  submissionsOpen: boolean;
};

let trainingSchemaReady: Promise<void> | null = null;

async function execIgnoreDuplicateColumn(pool: Pool, sql: string): Promise<void> {
  try {
    await pool.query(sql);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate_column|already exists/i.test(msg)) return;
    throw e;
  }
}

/**
 * Destructive never: CREATE IF NOT EXISTS + ADD COLUMN guards only.
 * Safe against repeat deploy / Railway reconnects.
 */
export async function ensureTrainingSchema(pool: Pool): Promise<void> {
  if (!trainingSchemaReady) {
    trainingSchemaReady = (async () => {
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
    })().catch((e) => {
      trainingSchemaReady = null;
      throw e;
    });
  }
  await trainingSchemaReady;
}

function readSubmissionsOpen(row: Record<string, unknown>): boolean {
  const v = row.submissions_open;
  if (typeof v === "boolean") return v;
  return true;
}

function rowAssessment(row: Record<string, unknown>): TrainingAssessmentRow {
  const sg = row.subgroup_options as unknown;
  const subgroup_options = Array.isArray(sg)
    ? (sg as unknown[]).map((x) => String(x))
    : [];
  return {
    id: String(row.id),
    facilitator_id: String(row.facilitator_id),
    title: String(row.title ?? ""),
    slug: String(row.slug ?? ""),
    subgroup_options,
    min_prompt_chars: Number(row.min_prompt_chars ?? 40),
    min_output_chars: Number(row.min_output_chars ?? 80),
    grader_instructions: String(row.grader_instructions ?? ""),
    assessment_intro: String(row.assessment_intro ?? ""),
    submissions_open: readSubmissionsOpen(row),
    created_at: row.created_at ? new Date(row.created_at as string).toISOString() : "",
    updated_at: row.updated_at ? new Date(row.updated_at as string).toISOString() : "",
  };
}

export async function pgAssessmentBySlug(
  pool: Pool,
  slug: string
): Promise<TrainingAssessmentRow | null> {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return null;
  const { rows } = await pool.query(
    `SELECT id, facilitator_id, title, slug, subgroup_options,
            min_prompt_chars, min_output_chars, assessment_intro,
            grader_instructions, submissions_open, created_at, updated_at
     FROM training_assessments WHERE lower(slug) = lower($1) LIMIT 1`,
    [trimmed]
  );
  if (!rows.length) return null;
  return rowAssessment(rows[0] as Record<string, unknown>);
}

export async function pgListAssessmentsForFacilitator(
  pool: Pool,
  facilitatorId: string
): Promise<TrainingAssessmentRow[]> {
  const { rows } = await pool.query(
    `SELECT id, facilitator_id, title, slug, subgroup_options,
            min_prompt_chars, min_output_chars, assessment_intro,
            grader_instructions, submissions_open, created_at, updated_at
     FROM training_assessments WHERE facilitator_id = $1::uuid
     ORDER BY updated_at DESC`,
    [facilitatorId]
  );
  return rows.map((r) => rowAssessment(r as Record<string, unknown>));
}

export async function pgInsertAssessment(
  pool: Pool,
  facilitatorId: string,
  patch: {
    title: string;
    slug: string;
    subgroupOptions: string[];
    min_prompt_chars?: number;
    min_output_chars?: number;
    assessment_intro?: string;
    grader_instructions: string;
  }
): Promise<TrainingAssessmentRow> {
  const { rows } = await pool.query(
    `INSERT INTO training_assessments
      (facilitator_id, title, slug, subgroup_options,
       min_prompt_chars, min_output_chars, assessment_intro, grader_instructions)
     VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6, $7, $8)
     RETURNING id, facilitator_id, title, slug, subgroup_options,
       min_prompt_chars, min_output_chars, assessment_intro,
       grader_instructions, submissions_open, created_at, updated_at`,
    [
      facilitatorId,
      patch.title.trim(),
      patch.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      JSON.stringify(patch.subgroupOptions.filter(Boolean)),
      Math.max(0, patch.min_prompt_chars ?? 40),
      Math.max(0, patch.min_output_chars ?? 80),
      patch.assessment_intro ?? "",
      patch.grader_instructions,
    ]
  );
  return rowAssessment(rows[0] as Record<string, unknown>);
}

export async function pgUpdateAssessment(
  pool: Pool,
  facilitatorId: string,
  assessmentId: string,
  patch: Partial<{
    title: string;
    slug: string;
    subgroupOptions: string[];
    min_prompt_chars: number;
    min_output_chars: number;
    assessment_intro: string;
    grader_instructions: string;
    submissions_open: boolean;
  }>
): Promise<TrainingAssessmentRow | null> {
  const prev = await pool.query(
    `SELECT facilitator_id FROM training_assessments WHERE id = $1::uuid`,
    [assessmentId]
  );
  if (!prev.rows.length) return null;
  if (String((prev.rows[0] as { facilitator_id: string }).facilitator_id) !== facilitatorId)
    return null;

  const fields: string[] = [];
  const args: unknown[] = [];
  let i = 1;
  const add = (col: string, val: unknown) => {
    fields.push(`${col} = $${i++}`);
    args.push(val);
  };

  if (patch.title != null) add("title", patch.title.trim());
  if (patch.slug != null)
    add("slug", patch.slug.trim().toLowerCase().replace(/\s+/g, "-"));
  if (patch.subgroupOptions != null)
    add("subgroup_options", JSON.stringify(patch.subgroupOptions.filter(Boolean)));
  if (patch.min_prompt_chars != null) add("min_prompt_chars", patch.min_prompt_chars);
  if (patch.min_output_chars != null) add("min_output_chars", patch.min_output_chars);
  if (patch.assessment_intro != null) add("assessment_intro", patch.assessment_intro);
  if (patch.grader_instructions != null) add("grader_instructions", patch.grader_instructions);
  if (patch.submissions_open !== undefined)
    add("submissions_open", patch.submissions_open);

  if (!fields.length) {
    const cur = await pool.query(
      `SELECT id, facilitator_id, title, slug, subgroup_options,
              min_prompt_chars, min_output_chars, assessment_intro,
              grader_instructions, submissions_open, created_at, updated_at
       FROM training_assessments WHERE id = $1::uuid`,
      [assessmentId]
    );
    return rowAssessment(cur.rows[0] as Record<string, unknown>);
  }

  fields.push(`updated_at = NOW()`);

  args.push(assessmentId);
  await pool.query(
    `UPDATE training_assessments SET ${fields.join(", ")} WHERE id = $${i}::uuid`,
    args
  );

  const { rows } = await pool.query(
    `SELECT id, facilitator_id, title, slug, subgroup_options,
            min_prompt_chars, min_output_chars, assessment_intro,
            grader_instructions, submissions_open, created_at, updated_at
     FROM training_assessments WHERE id = $1::uuid`,
    [assessmentId]
  );
  return rowAssessment(rows[0] as Record<string, unknown>);
}

export async function pgAdminListAssessmentLockSummaries(
  pool: Pool
): Promise<AssessmentLockSummary[]> {
  const { rows } = await pool.query(`
    SELECT ta.id, ta.slug, ta.title, ta.submissions_open, tf.email AS facilitator_email
    FROM training_assessments ta
    INNER JOIN training_facilitators tf ON tf.id = ta.facilitator_id
    ORDER BY ta.updated_at DESC
  `);
  return rows.map((r) => {
    const o = r as Record<string, unknown>;
    return {
      id: String(o.id ?? ""),
      slug: String(o.slug ?? ""),
      title: String(o.title ?? ""),
      facilitatorEmail: String(o.facilitator_email ?? ""),
      submissionsOpen: readSubmissionsOpen(o),
    };
  });
}

/** Organizer-only toggles learner submission window for one assessment row. */
export async function pgAdminSetAssessmentSubmissionsOpen(
  pool: Pool,
  assessmentId: string,
  submissionsOpen: boolean
): Promise<boolean> {
  const trimmed = assessmentId.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed
    )
  )
    return false;
  const r = await pool.query(
    `UPDATE training_assessments SET submissions_open = $2, updated_at = NOW()
     WHERE id = $1::uuid`,
    [trimmed, submissionsOpen]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function pgFacilitatorByEmail(pool: Pool, email: string) {
  const { rows } = await pool.query(
    `SELECT id, email, display_name, password_hash, created_at
     FROM training_facilitators WHERE lower(email) = lower($1) LIMIT 1`,
    [email.trim()]
  );
  if (!rows.length) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    id: String(r.id),
    email: String(r.email ?? ""),
    display_name: String(r.display_name ?? ""),
    password_hash: String(r.password_hash ?? ""),
    created_at: r.created_at ? new Date(r.created_at as string).toISOString() : "",
  };
}

export async function pgCreateFacilitator(
  pool: Pool,
  email: string,
  passwordHash: string,
  displayName: string
) {
  const { rows } = await pool.query(
    `INSERT INTO training_facilitators (email, password_hash, display_name)
     VALUES (lower(trim($1)), $2, trim($3))
     RETURNING id, email, display_name, created_at`,
    [email, passwordHash, displayName]
  );
  const r = rows[0] as Record<string, unknown>;
  return {
    id: String(r.id),
    email: String(r.email ?? ""),
    display_name: String(r.display_name ?? ""),
    created_at: r.created_at ? new Date(r.created_at as string).toISOString() : "",
  };
}
