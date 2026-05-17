import { readFoundrySubmissionsNewestFirst } from "@/lib/foundry-store";
import {
  facilitatorAuthFailureResponse,
  resolveFacilitatorRequest,
} from "@/lib/training-facilitator-auth";
import { pgCountSubmissionsLegacyNoAssessment, pgListAssessmentsForFacilitator } from "@/lib/training-pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await resolveFacilitatorRequest();
  if (!auth.ok) return facilitatorAuthFailureResponse(auth);

  const { pool, facilitatorId } = auth.ctx;
  const mine = await pgListAssessmentsForFacilitator(pool, facilitatorId);
  const allow = new Set(mine.map((a) => a.id));
  const orphanLegacyCount = await pgCountSubmissionsLegacyNoAssessment(pool);

  const all = await readFoundrySubmissionsNewestFirst();
  const submissions = all.filter(
    (r) => r.assessmentId != null && allow.has(r.assessmentId)
  );

  return Response.json({
    facilitator: {
      email: auth.ctx.facilitatorEmail,
      displayName: auth.ctx.facilitatorDisplayName,
    },
    submissions,
    stats: {
      submissionCount: submissions.length,
      assessmentCount: mine.length,
      orphanLegacyCount,
    },
  });
}
