import { facilitatorFromCookie } from "@/lib/training-session-cookie";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import {
  pgCountSubmissionsLegacyNoAssessment,
  pgFacilitatorByEmail,
  pgFacilitatorClaimLegacySubmissions,
} from "@/lib/training-pg";

export const runtime = "nodejs";

/** One-click: attach all legacy (no assessment FK) rows to your site-default course. */
export async function POST() {
  const ses = facilitatorFromCookie();
  if (!ses) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const pool = getFoundryPgPool();
  if (!pool) return Response.json({ error: "No database configured." }, { status: 503 });

  await ensureFoundrySubmissionsSchema(pool);
  const fac = await pgFacilitatorByEmail(pool, ses.email);
  if (!fac || fac.id !== ses.fid)
    return Response.json({ error: "Unauthorized." }, { status: 401 });

  const before = await pgCountSubmissionsLegacyNoAssessment(pool);
  const { moved, assessmentId, siteDefaultWasAutoSet } =
    await pgFacilitatorClaimLegacySubmissions(pool, fac.id);

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
    siteDefaultWasAutoSet: siteDefaultWasAutoSet === true,
  });
}

export async function GET() {
  const ses = facilitatorFromCookie();
  if (!ses) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const pool = getFoundryPgPool();
  if (!pool) return Response.json({ error: "No database configured." }, { status: 503 });

  await ensureFoundrySubmissionsSchema(pool);
  const orphanLegacyCount = await pgCountSubmissionsLegacyNoAssessment(pool);

  return Response.json({ orphanLegacyCount });
}
