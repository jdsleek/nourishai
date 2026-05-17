import { NextRequest } from "next/server";
import { learnerChecklistFromRows } from "@/lib/foundry-learner-checklist";
import { mergePortalForm } from "@/lib/foundry-portal-form";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { pgAssessmentBySlug, pgFacilitatorById } from "@/lib/training-pg";
import { QAF_COHORT_SUBGROUPS } from "@/lib/foundry-subgroups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public endpoint for learner deck — subgroup list & min lengths for an assessment */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim();

  if (!slug) {
    return Response.json(
      {
        slug: "",
        title: "Day 03 AI Builder",
        subgroups: [...QAF_COHORT_SUBGROUPS],
        minPromptChars: 40,
        minOutputChars: 80,
        submissionsOpen: true,
        siteDefault: false,
        studentChecklist: learnerChecklistFromRows([]),
        levelUpUrl: null as string | null,
        portalForm: mergePortalForm({}),
      },
      { status: 200 },
    );
  }

  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "Service unavailable." }, { status: 503 });
  }
  await ensureFoundrySubmissionsSchema(pool);

  const a = await pgAssessmentBySlug(pool, slug);
  if (!a) {
    return Response.json({ error: "Unknown assessment slug." }, { status: 404 });
  }

  const subgroups =
    a.subgroup_options.length > 0 ? a.subgroup_options : [...QAF_COHORT_SUBGROUPS];

  const fac = await pgFacilitatorById(pool, a.facilitator_id);
  const facilitatorEmail =
    typeof fac?.email === "string" && fac.email.trim().length > 0 ? fac.email.trim() : null;
  const facilitatorDisplayName =
    typeof fac?.display_name === "string" && fac.display_name.trim().length > 0
      ? fac.display_name.trim()
      : null;

  return Response.json({
    slug: a.slug,
    title: a.title,
    facilitatorEmail,
    facilitatorDisplayName,
    intro: a.assessment_intro,
    subgroups,
    minPromptChars: Math.max(0, a.min_prompt_chars),
    minOutputChars: Math.max(0, a.min_output_chars),
    submissionsOpen: a.submissions_open,
    studentChecklist: learnerChecklistFromRows(a.student_checklist),
    levelUpUrl: a.level_up_url.trim().length > 0 ? a.level_up_url.trim() : null,
    portalForm: mergePortalForm(a.portal_form_copy),
  });
}
