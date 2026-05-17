import { facilitatorFromCookie } from "@/lib/training-session-cookie";
import { learnerDeckPath } from "@/lib/foundry-learner-course";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { pgFacilitatorByEmail, pgUpdateAssessment } from "@/lib/training-pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  title?: string;
  slug?: string;
  subgroupOptions?: string[];
  minPromptChars?: number;
  minOutputChars?: number;
  assessmentIntro?: string;
  graderInstructions?: string;
  submissionsOpen?: boolean;
};

async function auth() {
  const ses = facilitatorFromCookie();
  if (!ses) return null;
  const pool = getFoundryPgPool();
  if (!pool) return null;
  await ensureFoundrySubmissionsSchema(pool);
  const fac = await pgFacilitatorByEmail(pool, ses.email);
  if (!fac || fac.id !== ses.fid) return null;
  return { pool, facilitatorId: fac.id };
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await auth();
  if (!ctx)
    return Response.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = params;

  const body = (await req.json()) as PatchBody;
  const patch: {
    title?: string;
    slug?: string;
    subgroupOptions?: string[];
    min_prompt_chars?: number;
    min_output_chars?: number;
    assessment_intro?: string;
    grader_instructions?: string;
    submissions_open?: boolean;
  } = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.slug !== undefined)
    patch.slug = body.slug
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  if (body.subgroupOptions !== undefined) patch.subgroupOptions = body.subgroupOptions;
  if (body.minPromptChars !== undefined)
    patch.min_prompt_chars = Math.max(0, Number(body.minPromptChars));
  if (body.minOutputChars !== undefined)
    patch.min_output_chars = Math.max(0, Number(body.minOutputChars));
  if (body.assessmentIntro !== undefined)
    patch.assessment_intro = body.assessmentIntro;
  if (body.graderInstructions !== undefined)
    patch.grader_instructions = body.graderInstructions.trim();
  if (body.submissionsOpen !== undefined)
    patch.submissions_open = Boolean(body.submissionsOpen);

  try {
    const next = await pgUpdateAssessment(ctx.pool, ctx.facilitatorId, id, patch);
    if (!next) {
      return Response.json({ error: "Assessment not found." }, { status: 404 });
    }
    return Response.json({
      ok: true,
      assessment: next,
      studentUrl: learnerDeckPath(next.slug),
      classHubPath: `/learn/${encodeURIComponent(next.slug)}`,
    });
  } catch (e) {
    console.error("[facilitator PATCH assessment]", e);
    return Response.json({ error: "Update failed." }, { status: 500 });
  }
}
