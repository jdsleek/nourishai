import { learnerDeckPath } from "@/lib/foundry-learner-course";
import {
  sanitizeLevelUpUrl,
  sanitizeStudentChecklistInput,
} from "@/lib/foundry-learner-checklist";
import {
  persistPortalFormCopy,
  readPortalExtraSlots,
} from "@/lib/foundry-portal-extras";
import { mergePortalForm } from "@/lib/foundry-portal-form";
import {
  facilitatorAuthFailureResponse,
  resolveFacilitatorRequest,
} from "@/lib/training-facilitator-auth";
import {
  pgInsertAssessment,
  pgListAssessmentsForFacilitator,
} from "@/lib/training-pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PostBody = {
  title?: string;
  slug?: string;
  subgroupOptions?: string[];
  minPromptChars?: number;
  minOutputChars?: number;
  assessmentIntro?: string;
  graderInstructions?: string;
  levelUpUrl?: string;
  studentChecklist?: string[];
  portalForm?: unknown;
  /** Up to six extra multi-line questions beyond fields 03/04 */
  extraAnswerSlots?: unknown;
};

/** List facilitator-authored assessments */
export async function GET() {
  const auth = await resolveFacilitatorRequest();
  if (!auth.ok) return facilitatorAuthFailureResponse(auth);
  const ctx = auth.ctx;
  const list = await pgListAssessmentsForFacilitator(ctx.pool, ctx.facilitatorId);
  return Response.json({
    assessments: list.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      subgroupOptions: a.subgroup_options,
      minPromptChars: a.min_prompt_chars,
      minOutputChars: a.min_output_chars,
      submissionsOpen: a.submissions_open,
      assessmentIntro: a.assessment_intro ?? "",
      graderInstructions: a.grader_instructions ?? "",
      portalForm: mergePortalForm(a.portal_form_copy),
      studentUrlHint: learnerDeckPath(a.slug),
      classHubPath: `/learn/${encodeURIComponent(a.slug)}`,
      levelUpUrl: a.level_up_url,
      studentChecklist: a.student_checklist,
      extraAnswerSlots: readPortalExtraSlots(a.portal_form_copy),
    })),
    studentDeckBasePath: "/foundry/deck",
  });
}

/** Create assessment */
export async function POST(req: Request) {
  const auth = await resolveFacilitatorRequest();
  if (!auth.ok) return facilitatorAuthFailureResponse(auth);
  const ctx = auth.ctx;

  const body = (await req.json()) as PostBody;
  const title = String(body.title || "").trim();
  let slug = String(body.slug || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const subgroupOptions = Array.isArray(body.subgroupOptions)
    ? body.subgroupOptions.map((s) => String(s || "").trim()).filter(Boolean)
    : [];
  const minPromptChars = Number(body.minPromptChars ?? 40);
  const minOutputChars = Number(body.minOutputChars ?? 80);
  const assessmentIntro = String(body.assessmentIntro || "");
  const graderInstructions = String(body.graderInstructions || "").trim();
  const levelUpUrl = sanitizeLevelUpUrl(String(body.levelUpUrl || ""));
  const studentChecklist = sanitizeStudentChecklistInput(body.studentChecklist);
  const portalPersist = persistPortalFormCopy(body.portalForm, body.extraAnswerSlots, undefined);

  if (!title) {
    return Response.json({ error: "Assessment title required." }, { status: 400 });
  }
  if (!slug || slug.length < 3) {
    return Response.json(
      {
        error:
          "Slug required (letters, numbers, hyphen). Appears as /foundry/deck/your-slug (legacy ?assessment= still works).",
      },
      { status: 400 },
    );
  }

  try {
    const row = await pgInsertAssessment(ctx.pool, ctx.facilitatorId, {
      title,
      slug,
      subgroupOptions,
      min_prompt_chars: minPromptChars,
      min_output_chars: minOutputChars,
      assessment_intro: assessmentIntro,
      grader_instructions: graderInstructions,
      level_up_url: levelUpUrl,
      student_checklist: studentChecklist,
      portal_form_copy: portalPersist,
    });

    return Response.json({
      ok: true,
      assessment: row,
      studentUrl: learnerDeckPath(row.slug),
      classHubPath: `/learn/${encodeURIComponent(row.slug)}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed.";
    console.error("[facilitator/assessments POST]", e);
    if (/unique|duplicate/i.test(msg)) {
      return Response.json(
        { error: "That slug is already taken — choose another." },
        { status: 409 },
      );
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
