import {
  facilitatorAuthFailureResponse,
  resolveFacilitatorRequest,
} from "@/lib/training-facilitator-auth";
import {
  pgCountSubmissionsLegacyNoAssessment,
  pgFacilitatorClaimLegacySubmissions,
} from "@/lib/training-pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One-click: attach all legacy (no assessment FK) rows to this facilitator's oldest-published assessment. */
export async function POST() {
  const auth = await resolveFacilitatorRequest();
  if (!auth.ok) return facilitatorAuthFailureResponse(auth);

  const pool = auth.ctx.pool;
  const facId = auth.ctx.facilitatorId;
  const before = await pgCountSubmissionsLegacyNoAssessment(pool);
  const { moved, assessmentId } = await pgFacilitatorClaimLegacySubmissions(pool, facId);

  if (!assessmentId) {
    return Response.json(
      {
        error:
          "Create at least one assessment under the Assessments tab, then try again.",
      },
      { status: 400 },
    );
  }

  return Response.json({
    ok: true,
    moved,
    orphanBefore: before,
    assessmentId,
  });
}

export async function GET() {
  const auth = await resolveFacilitatorRequest();
  if (!auth.ok) return facilitatorAuthFailureResponse(auth);

  const orphanLegacyCount = await pgCountSubmissionsLegacyNoAssessment(auth.ctx.pool);

  return Response.json({ orphanLegacyCount });
}
