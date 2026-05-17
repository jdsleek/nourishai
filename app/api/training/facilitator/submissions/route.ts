import { readFoundrySubmissionsNewestFirst } from "@/lib/foundry-store";
import { facilitatorFromCookie } from "@/lib/training-session-cookie";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import {
  pgCountSubmissionsLegacyNoAssessment,
  pgFacilitatorByEmail,
  pgListAssessmentsForFacilitator,
} from "@/lib/training-pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ses = facilitatorFromCookie();
  if (!ses)
    return Response.json({ error: "Unauthorized." }, { status: 401 });

  const pool = getFoundryPgPool();
  if (!pool)
    return Response.json({ error: "No database configured." }, { status: 503 });

  await ensureFoundrySubmissionsSchema(pool);

  const fac = await pgFacilitatorByEmail(pool, ses.email);
  if (!fac || fac.id !== ses.fid)
    return Response.json({ error: "Unauthorized." }, { status: 401 });

  const mine = await pgListAssessmentsForFacilitator(pool, ses.fid);
  const allow = new Set(mine.map((a) => a.id));
  const orphanLegacyCount = await pgCountSubmissionsLegacyNoAssessment(pool);

  const all = await readFoundrySubmissionsNewestFirst();
  const submissions = all.filter(
    (r) => r.assessmentId != null && allow.has(r.assessmentId)
  );

  return Response.json({
    facilitator: { email: fac.email, displayName: fac.display_name },
    submissions,
    stats: {
      submissionCount: submissions.length,
      assessmentCount: mine.length,
      orphanLegacyCount,
    },
  });
}
