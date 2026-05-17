import type { Pool } from "pg";
import {
  facilitatorAuthFailureResponse,
  resolveFacilitatorRequest,
} from "@/lib/training-facilitator-auth";
import {
  pgCountSubmissionsForAssessment,
  pgFacilitatorMergeSubmissionsToAssessment,
  pgListAssessmentsForFacilitator,
  looksLikeUuid,
} from "@/lib/training-pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  fromAssessmentId?: string;
  toAssessmentId?: string;
  dryRun?: boolean;
};

async function ctx(): Promise<
  | { ok: true; pool: Pool; facilitatorId: string }
  | { ok: false; response: Response }
> {
  const auth = await resolveFacilitatorRequest();
  if (!auth.ok) return { ok: false, response: facilitatorAuthFailureResponse(auth) };
  return { ok: true, pool: auth.ctx.pool, facilitatorId: auth.ctx.facilitatorId };
}

async function facilitatorOwnsBoth(
  pool: Pool,
  facilitatorId: string,
  a: string,
  b: string
): Promise<boolean> {
  const list = await pgListAssessmentsForFacilitator(pool, facilitatorId);
  const allow = new Set(list.map((x) => x.id));
  return allow.has(a) && allow.has(b);
}

/** Move all learner submissions tied to one of your assessments onto another slug you manage. */
export async function POST(req: Request) {
  const c = await ctx();
  if (!c.ok) return c.response;

  const body = (await req.json()) as Body;
  const from = String(body.fromAssessmentId || "").trim();
  const to = String(body.toAssessmentId || "").trim();
  const dryRun = body.dryRun === true;

  if (!looksLikeUuid(from) || !looksLikeUuid(to)) {
    return Response.json({ error: "Valid fromAssessmentId and toAssessmentId required." }, { status: 400 });
  }
  if (from === to) {
    return Response.json({ error: "Pick two different assessments." }, { status: 400 });
  }

  const okOwn = await facilitatorOwnsBoth(c.pool, c.facilitatorId, from, to);
  if (!okOwn)
    return Response.json(
      {
        error: "You must own BOTH assessments — use organizer ownership move otherwise.",
      },
      { status: 403 },
    );

  const n = await pgCountSubmissionsForAssessment(c.pool, from);
  if (dryRun) {
    return Response.json({ ok: true, dryRun: true, submissionCount: n });
  }

  const moved = await pgFacilitatorMergeSubmissionsToAssessment(
    c.pool,
    c.facilitatorId,
    from,
    to,
  );
  return Response.json({ ok: true, dryRun: false, moved });
}
