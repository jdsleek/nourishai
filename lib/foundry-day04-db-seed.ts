import type { Pool } from "pg";
import {
  DAY04_ASSESSMENT_INTRO,
  DAY04_ASSESSMENT_SLUG,
  DAY04_ASSESSMENT_TITLE,
  DAY04_EXTRA_SLOTS,
  DAY04_GRADER_INSTRUCTIONS,
  DAY04_PORTAL_PATCH,
  DAY04_STUDENT_CHECKLIST,
} from "@/lib/foundry-day04-defaults";
import { QAF_COHORT_SUBGROUPS } from "@/lib/foundry-subgroups";
import { pgAssessmentBySlug } from "@/lib/training-pg";

export type EnsureDay04Result =
  | { ok: true; id: string; created: boolean }
  | { ok: false; reason: "no_facilitator" | "slug_conflict" };

function day04PortalFormCopy(): Record<string, unknown> {
  return {
    ...DAY04_PORTAL_PATCH,
    extra_answer_slots: DAY04_EXTRA_SLOTS,
  };
}

async function resolveFacilitatorId(pool: Pool): Promise<string | null> {
  const preferred =
    process.env.TARGET_FACILITATOR_EMAIL?.trim() ||
    process.env.ORG_FACILITATOR_EMAIL?.trim() ||
    process.env.DEMO_FACILITATOR_EMAIL?.trim();
  if (preferred) {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id::text AS id FROM training_facilitators
       WHERE lower(trim(email)) = lower(trim($1)) LIMIT 1`,
      [preferred],
    );
    if (rows[0]?.id) return rows[0].id;
  }
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM training_facilitators ORDER BY created_at ASC LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

/** Idempotent — registers Day 04 in Postgres so admin/facilitator can close submissions. */
export async function ensureDay04AssessmentInDb(
  pool: Pool,
): Promise<EnsureDay04Result> {
  const existing = await pgAssessmentBySlug(pool, DAY04_ASSESSMENT_SLUG);
  if (existing) {
    return { ok: true, id: existing.id, created: false };
  }

  const facilitatorId = await resolveFacilitatorId(pool);
  if (!facilitatorId) {
    return { ok: false, reason: "no_facilitator" };
  }

  const portalJson = JSON.stringify(day04PortalFormCopy());
  const subgroupsJson = JSON.stringify([...QAF_COHORT_SUBGROUPS]);
  const checklistJson = JSON.stringify([...DAY04_STUDENT_CHECKLIST]);

  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO training_assessments (
         facilitator_id, title, slug, subgroup_options,
         min_prompt_chars, min_output_chars,
         assessment_intro, grader_instructions,
         submissions_open, is_site_default,
         student_checklist, portal_form_copy
       ) VALUES (
         $1::uuid, $2, $3, $4::jsonb,
         40, 60, $5, $6,
         TRUE, FALSE,
         $7::jsonb, $8::jsonb
       )
       RETURNING id::text AS id`,
      [
        facilitatorId,
        DAY04_ASSESSMENT_TITLE,
        DAY04_ASSESSMENT_SLUG,
        subgroupsJson,
        DAY04_ASSESSMENT_INTRO,
        DAY04_GRADER_INSTRUCTIONS,
        checklistJson,
        portalJson,
      ],
    );
    const id = rows[0]?.id;
    if (!id) return { ok: false, reason: "slug_conflict" };
    return { ok: true, id, created: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(msg)) {
      const again = await pgAssessmentBySlug(pool, DAY04_ASSESSMENT_SLUG);
      if (again) return { ok: true, id: again.id, created: false };
      return { ok: false, reason: "slug_conflict" };
    }
    throw e;
  }
}
