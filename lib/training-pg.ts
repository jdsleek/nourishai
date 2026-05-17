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
  /** Facilitator overrides for learner submit-portal labels/hints (merged client-side). */
  portal_form_copy: Record<string, unknown>;
  /** Optional learner “next step” link (hosted URL); shown after grading when valid. */
  level_up_url: string;
  /** Custom pre-submit bullets; empty in DB ⇒ learner-facing code uses curated defaults. */
  student_checklist: string[];
  /** False → learners cannot POST new grades for this slug (admin-managed). */
  submissions_open: boolean;
  /** When true, bare site URL (/) grades attach here without ?assessment=. */
  is_site_default: boolean;
  created_at: string;
  updated_at: string;
};

const ASSESSMENT_SELECT = `
  id, facilitator_id, title, slug, subgroup_options,
  min_prompt_chars, min_output_chars, assessment_intro,
  grader_instructions, submissions_open,
  COALESCE(is_site_default, false) AS is_site_default,
  COALESCE(portal_form_copy, '{}'::jsonb) AS portal_form_copy,
  COALESCE(level_up_url, '') AS level_up_url,
  COALESCE(student_checklist, '[]'::jsonb) AS student_checklist,
  created_at, updated_at`;

export type AssessmentLockSummary = {
  id: string;
  slug: string;
  title: string;
  facilitatorId: string;
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
        `ALTER TABLE training_assessments ADD COLUMN is_site_default BOOLEAN NOT NULL DEFAULT FALSE`,
      );

      await execIgnoreDuplicateColumn(
        pool,
        `ALTER TABLE foundry_submissions ADD COLUMN assessment_id UUID REFERENCES training_assessments(id) ON DELETE SET NULL`,
      );

      await execIgnoreDuplicateColumn(
        pool,
        `ALTER TABLE training_assessments ADD COLUMN portal_form_copy JSONB NOT NULL DEFAULT '{}'::jsonb`,
      );

      await execIgnoreDuplicateColumn(
        pool,
        `ALTER TABLE training_assessments ADD COLUMN level_up_url TEXT NOT NULL DEFAULT ''`,
      );

      await execIgnoreDuplicateColumn(
        pool,
        `ALTER TABLE training_assessments ADD COLUMN student_checklist JSONB NOT NULL DEFAULT '[]'::jsonb`,
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

function readPortalFormCopy(row: Record<string, unknown>): Record<string, unknown> {
  const v = row.portal_form_copy as unknown;
  if (typeof v === "object" && v !== null && !Array.isArray(v))
    return v as Record<string, unknown>;
  if (typeof v === "string" && v.trim().length > 0) {
    try {
      const p = JSON.parse(v) as unknown;
      if (typeof p === "object" && p !== null && !Array.isArray(p))
        return p as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function readStudentChecklistColumn(row: Record<string, unknown>): string[] {
  const v = row.student_checklist as unknown;
  if (Array.isArray(v)) {
    return v
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  if (typeof v === "string" && v.trim().length > 0) {
    try {
      const p = JSON.parse(v) as unknown;
      if (Array.isArray(p)) {
        return p
          .map((x) => String(x ?? "").trim())
          .filter(Boolean)
          .slice(0, 12);
      }
    } catch {
      return [];
    }
  }
  return [];
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
    portal_form_copy: readPortalFormCopy(row),
    level_up_url: String(row.level_up_url ?? ""),
    student_checklist: readStudentChecklistColumn(row),
    submissions_open: readSubmissionsOpen(row),
    is_site_default: row.is_site_default === true,
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
    `SELECT ${ASSESSMENT_SELECT}
     FROM training_assessments WHERE lower(slug) = lower($1) LIMIT 1`,
    [trimmed]
  );
  if (!rows.length) return null;
  return rowAssessment(rows[0] as Record<string, unknown>);
}

export async function pgAssessmentByIdForFacilitator(
  pool: Pool,
  facilitatorId: string,
  assessmentId: string
): Promise<TrainingAssessmentRow | null> {
  const { rows } = await pool.query(
    `SELECT ${ASSESSMENT_SELECT}
     FROM training_assessments WHERE id = $1::uuid AND facilitator_id = $2::uuid LIMIT 1`,
    [assessmentId, facilitatorId]
  );
  if (!rows.length) return null;
  return rowAssessment(rows[0] as Record<string, unknown>);
}

export type FacilitatorCourseCard = {
  slug: string;
  title: string;
  submissionsOpen: boolean;
};

export type FacilitatorCourseCatalogResult = {
  facilitatorEmail: string | null;
  facilitatorDisplayName: string | null;
  courses: FacilitatorCourseCard[];
};

/** Same trainer as `slugLookup` — all their assignments (student hub cards). Unknown slug → null. */
export async function pgFacilitatorCourseCatalogBySlug(
  pool: Pool,
  slugLookup: string,
): Promise<FacilitatorCourseCatalogResult | null> {
  const a = await pgAssessmentBySlug(pool, slugLookup);
  if (!a) return null;
  const fac = await pgFacilitatorById(pool, a.facilitator_id);
  const facilitatorEmail =
    typeof fac?.email === "string" && fac.email.trim().length > 0 ? fac.email.trim() : null;
  const facilitatorDisplayName =
    typeof fac?.display_name === "string" && fac.display_name.trim().length > 0
      ? fac.display_name.trim()
      : null;

  const { rows } = await pool.query(
    `SELECT slug, title, submissions_open FROM training_assessments
     WHERE facilitator_id = $1::uuid
     ORDER BY created_at DESC`,
    [a.facilitator_id],
  );

  const courses = rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      slug: String(row.slug ?? ""),
      title: String(row.title ?? ""),
      submissionsOpen: readSubmissionsOpen(row),
    };
  });

  return {
    facilitatorEmail,
    facilitatorDisplayName,
    courses,
  };
}

export type LiveOpenCourseCard = {
  slug: string;
  title: string;
  submissionsOpen: true;
  facilitatorDisplayName: string | null;
};

/**
 * Every facilitator assessment that is open for submit and not the site-default demo row.
 * For student-facing “pick your cohort” discovery on the class hub.
 */
export async function pgLiveOpenCoursesPublic(
  pool: Pool,
): Promise<LiveOpenCourseCard[]> {
  const { rows } = await pool.query(
    `SELECT ta.slug, ta.title, tf.display_name, tf.email
     FROM training_assessments ta
     INNER JOIN training_facilitators tf ON tf.id = ta.facilitator_id
     WHERE ta.submissions_open = TRUE AND ta.is_site_default = FALSE
     ORDER BY ta.created_at DESC, LOWER(tf.email)`,
  );

  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    const dn =
      typeof row.display_name === "string" && row.display_name.trim().length > 0
        ? row.display_name.trim()
        : null;
    const email = typeof row.email === "string" ? row.email.trim() : "";
    const local =
      email.length > 0 ? (email.split("@")[0]?.trim() || null) : null;
    return {
      slug: String(row.slug ?? ""),
      title: String(row.title ?? ""),
      submissionsOpen: true as const,
      facilitatorDisplayName: dn ?? local,
    };
  });
}

export async function pgListAssessmentsForFacilitator(
  pool: Pool,
  facilitatorId: string
): Promise<TrainingAssessmentRow[]> {
  const { rows } = await pool.query(
    `SELECT ${ASSESSMENT_SELECT}
     FROM training_assessments WHERE facilitator_id = $1::uuid
     ORDER BY created_at DESC`,
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
    level_up_url?: string;
    student_checklist?: string[];
    /** Full merged portal JSONB blob (four fields + optional extra_answer_slots). */
    portal_form_copy?: Record<string, unknown>;
  }
): Promise<TrainingAssessmentRow> {
  const levelUrl = patch.level_up_url ?? "";
  const checklistJson = JSON.stringify(patch.student_checklist ?? []);
  const portalJson = JSON.stringify(patch.portal_form_copy ?? {});
  const { rows } = await pool.query(
    `INSERT INTO training_assessments
      (facilitator_id, title, slug, subgroup_options,
       min_prompt_chars, min_output_chars, assessment_intro, grader_instructions, is_site_default,
       level_up_url, student_checklist, portal_form_copy)
     VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6, $7, $8, false, $9, $10::jsonb, $11::jsonb)
     RETURNING ${ASSESSMENT_SELECT}`,
    [
      facilitatorId,
      patch.title.trim(),
      patch.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      JSON.stringify(patch.subgroupOptions.filter(Boolean)),
      Math.max(0, patch.min_prompt_chars ?? 40),
      Math.max(0, patch.min_output_chars ?? 80),
      patch.assessment_intro ?? "",
      patch.grader_instructions,
      levelUrl,
      checklistJson,
      portalJson,
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
    portal_form_copy: Record<string, unknown>;
    level_up_url: string;
    student_checklist: string[];
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
  if (patch.portal_form_copy !== undefined)
    add("portal_form_copy", patch.portal_form_copy);
  if (patch.level_up_url !== undefined) add("level_up_url", patch.level_up_url);
  if (patch.student_checklist !== undefined)
    add("student_checklist", JSON.stringify(patch.student_checklist));

  if (!fields.length) {
    const cur = await pool.query(
      `SELECT ${ASSESSMENT_SELECT} FROM training_assessments WHERE id = $1::uuid`,
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
    `SELECT ${ASSESSMENT_SELECT} FROM training_assessments WHERE id = $1::uuid`,
    [assessmentId]
  );
  return rowAssessment(rows[0] as Record<string, unknown>);
}

/** Attach orphan legacy rows to this facilitator's oldest-published assessment (stable main-course inbox). */
export async function pgFacilitatorClaimLegacySubmissions(
  pool: Pool,
  facilitatorId: string,
): Promise<{ moved: number; assessmentId: string | null }> {
  const pick = await pool.query(
    `SELECT id FROM training_assessments
     WHERE facilitator_id = $1::uuid
     ORDER BY created_at ASC
     LIMIT 1`,
    [facilitatorId.trim()],
  );
  if (!pick.rows.length) {
    return { moved: 0, assessmentId: null };
  }
  const aid = String((pick.rows[0] as { id: string }).id);
  const r = await pool.query(
    `UPDATE foundry_submissions SET assessment_id = $1::uuid WHERE assessment_id IS NULL`,
    [aid],
  );
  return { moved: r.rowCount ?? 0, assessmentId: aid };
}

export async function pgAdminListAssessmentLockSummaries(
  pool: Pool
): Promise<AssessmentLockSummary[]> {
  const { rows } = await pool.query(`
    SELECT ta.id,
           ta.slug,
           ta.title,
           ta.submissions_open,
           tf.id AS facilitator_id,
           tf.email AS facilitator_email
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
      facilitatorId: String(o.facilitator_id ?? ""),
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

/** Organizer removes a facilitator assessment row. Submissions lose FK (SET NULL); slug is freed. */
export async function pgAdminDeleteAssessment(
  pool: Pool,
  assessmentId: string
): Promise<{ ok: boolean; submissionsUnlinked: number }> {
  const trimmed = assessmentId.trim();
  if (!looksLikeUuid(trimmed)) {
    return { ok: false, submissionsUnlinked: 0 };
  }
  const { rows } = await pool.query(
    `SELECT COUNT(*)::bigint AS n FROM foundry_submissions WHERE assessment_id = $1::uuid`,
    [trimmed]
  );
  const submissionsUnlinked = Number(
    (rows[0] as { n?: string } | undefined)?.n ?? 0
  );
  const r = await pool.query(`DELETE FROM training_assessments WHERE id = $1::uuid`, [
    trimmed,
  ]);
  const ok = (r.rowCount ?? 0) > 0;
  return { ok, submissionsUnlinked };
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeUuid(val: string): boolean {
  return UUID_RE.test(val.trim());
}

export type FacilitatorListSummary = TrainingFacilitatorRow & {
  assessment_count: number;
};

/** Organizer-only: facilitator directory with owned assessment counts */
export async function pgAdminListFacilitators(pool: Pool): Promise<FacilitatorListSummary[]> {
  const { rows } = await pool.query(`
    SELECT tf.id,
           tf.email,
           tf.display_name,
           tf.created_at,
           COALESCE(ac.cnt, 0)::bigint AS assessment_count
    FROM training_facilitators tf
    LEFT JOIN (
      SELECT facilitator_id AS fid, COUNT(*)::bigint AS cnt
      FROM training_assessments
      GROUP BY facilitator_id
    ) ac ON ac.fid = tf.id
    ORDER BY tf.created_at DESC
  `);
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      email: String(r.email ?? ""),
      display_name: String(r.display_name ?? ""),
      created_at: r.created_at ? new Date(r.created_at as string).toISOString() : "",
      assessment_count: Number(r.assessment_count ?? 0),
    };
  });
}

export async function pgFacilitatorById(pool: Pool, facilitatorId: string) {
  if (!looksLikeUuid(facilitatorId)) return null;
  const { rows } = await pool.query(
    `SELECT id, email, display_name, created_at
     FROM training_facilitators WHERE id = $1::uuid LIMIT 1`,
    [facilitatorId.trim()]
  );
  if (!rows.length) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    id: String(r.id),
    email: String(r.email ?? ""),
    display_name: String(r.display_name ?? ""),
    created_at: r.created_at ? new Date(r.created_at as string).toISOString() : "",
  };
}

export async function pgAdminUpdateFacilitatorByEmail(
  pool: Pool,
  email: string,
  patch: { passwordHash?: string; displayName?: string }
): Promise<TrainingFacilitatorRow | null> {
  const hasPwd = patch.passwordHash != null && patch.passwordHash.length > 0;
  const hasDisplay = Object.prototype.hasOwnProperty.call(patch, "displayName");
  if (!hasPwd && !hasDisplay) return null;

  const fields: string[] = [];
  const args: unknown[] = [];
  let i = 1;
  if (hasPwd) {
    fields.push(`password_hash = $${i++}`);
    args.push(patch.passwordHash);
  }
  if (hasDisplay) {
    fields.push(`display_name = $${i++}`);
    args.push(String(patch.displayName ?? "").trim());
  }
  args.push(email.trim());
  const emailParam = i;

  const { rows } = await pool.query(
    `UPDATE training_facilitators SET ${fields.join(", ")}
     WHERE lower(email) = lower($${emailParam})
     RETURNING id, email, display_name, created_at`,
    args
  );
  if (!rows.length) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    id: String(r.id),
    email: String(r.email ?? ""),
    display_name: String(r.display_name ?? ""),
    created_at: r.created_at ? new Date(r.created_at as string).toISOString() : "",
  };
}

/** Organizer-only reassignment — does not change submissions rows (still point at same assessment ids). */
export async function pgAdminSetAssessmentFacilitator(
  pool: Pool,
  assessmentId: string,
  facilitatorId: string
): Promise<boolean> {
  if (!looksLikeUuid(assessmentId) || !looksLikeUuid(facilitatorId)) return false;
  const fac = await pgFacilitatorById(pool, facilitatorId);
  if (!fac) return false;
  const r = await pool.query(
    `UPDATE training_assessments SET facilitator_id = $2::uuid, updated_at = NOW()
     WHERE id = $1::uuid`,
    [assessmentId.trim(), facilitatorId.trim()]
  );
  return (r.rowCount ?? 0) > 0;
}

/** Count submits tied to one assessment UUID (excluding null FK). */
export async function pgCountSubmissionsForAssessment(
  pool: Pool,
  assessmentId: string
): Promise<number> {
  if (!looksLikeUuid(assessmentId)) return 0;
  const { rows } = await pool.query(
    `SELECT COUNT(*)::bigint AS n FROM foundry_submissions WHERE assessment_id = $1::uuid`,
    [assessmentId.trim()]
  );
  return Number((rows[0] as { n?: string })?.n ?? 0);
}

export async function pgCountSubmissionsLegacyNoAssessment(pool: Pool): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::bigint AS n FROM foundry_submissions WHERE assessment_id IS NULL`
  );
  return Number((rows[0] as { n?: string })?.n ?? 0);
}

/**
 * Repoint submits from source assessment UUID to destination.
 * Both assessments must belong to facilitatorId (trainer merge / consolidation).
 */
export async function pgFacilitatorMergeSubmissionsToAssessment(
  pool: Pool,
  facilitatorId: string,
  fromAssessmentId: string,
  toAssessmentId: string
): Promise<number> {
  if (
    !looksLikeUuid(facilitatorId) ||
    !looksLikeUuid(fromAssessmentId) ||
    !looksLikeUuid(toAssessmentId) ||
    fromAssessmentId.trim() === toAssessmentId.trim()
  ) {
    return 0;
  }
  const r = await pool.query(
    `UPDATE foundry_submissions SET assessment_id = $2::uuid
     WHERE assessment_id = $1::uuid
     AND EXISTS (SELECT 1 FROM training_assessments s WHERE s.id = $1::uuid AND s.facilitator_id = $3::uuid)
     AND EXISTS (SELECT 1 FROM training_assessments t WHERE t.id = $2::uuid AND t.facilitator_id = $3::uuid)`,
    [fromAssessmentId.trim(), toAssessmentId.trim(), facilitatorId.trim()]
  );
  return r.rowCount ?? 0;
}

/** Organizer: attach cohort legacy rows (assessment_id null) under one facilitator assessment inbox. */
export async function pgAdminLinkLegacySubmissions(
  pool: Pool,
  toAssessmentId: string
): Promise<number> {
  if (!looksLikeUuid(toAssessmentId)) return 0;
  const exists = await pool.query(
    `SELECT 1 FROM training_assessments WHERE id = $1::uuid LIMIT 1`,
    [toAssessmentId.trim()]
  );
  if (!exists.rows.length) return 0;

  const r = await pool.query(
    `UPDATE foundry_submissions SET assessment_id = $1::uuid WHERE assessment_id IS NULL`,
    [toAssessmentId.trim()]
  );
  return r.rowCount ?? 0;
}
