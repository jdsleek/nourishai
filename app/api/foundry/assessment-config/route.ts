import { NextRequest } from "next/server";
import { learnerChecklistFromRows } from "@/lib/foundry-learner-checklist";
import {
  day04AssessmentConfigPayload,
  DAY04_ASSESSMENT_SLUG,
  isDay04AssessmentSlug,
} from "@/lib/foundry-day04-defaults";
import { mergePortalForm } from "@/lib/foundry-portal-form";
import { readPortalExtraSlots } from "@/lib/foundry-portal-extras";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { pgAssessmentBySlug, pgFacilitatorById } from "@/lib/training-pg";
import { QAF_COHORT_SUBGROUPS } from "@/lib/foundry-subgroups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public endpoint for learner deck — subgroup list & min lengths for an assessment */
export async function GET(req: NextRequest) {
  const slugParam = req.nextUrl.searchParams.get("slug")?.trim() || "";
  const deck = req.nextUrl.searchParams.get("deck")?.trim().toLowerCase();
  const wantDay04 = deck === "day04" || isDay04AssessmentSlug(slugParam);

  const pool = getFoundryPgPool();

  if (wantDay04) {
    const slug = slugParam || DAY04_ASSESSMENT_SLUG;

    if (pool) {
      await ensureFoundrySubmissionsSchema(pool);
      const a = await pgAssessmentBySlug(pool, slug);
      if (a) {
        const subgroups =
          a.subgroup_options.length > 0 ? a.subgroup_options : [...QAF_COHORT_SUBGROUPS];
        const fac = await pgFacilitatorById(pool, a.facilitator_id);
        const facilitatorEmail =
          typeof fac?.email === "string" && fac.email.trim().length > 0
            ? fac.email.trim()
            : null;
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
          extraAnswerSlots: readPortalExtraSlots(a.portal_form_copy),
          deck: "day04",
        });
      }
    }

    const fallback = day04AssessmentConfigPayload();
    return Response.json({
      ...fallback,
      slug,
      subgroups: [...QAF_COHORT_SUBGROUPS],
      facilitatorEmail: null,
      facilitatorDisplayName: null,
    });
  }

  if (!slugParam) {
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
        extraAnswerSlots: [] as unknown[],
      },
      { status: 200 },
    );
  }

  if (!pool) {
    return Response.json({ error: "Service unavailable." }, { status: 503 });
  }
  await ensureFoundrySubmissionsSchema(pool);

  const a = await pgAssessmentBySlug(pool, slugParam);
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
    extraAnswerSlots: readPortalExtraSlots(a.portal_form_copy),
  });
}
