import { NextRequest } from "next/server";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { isFoundryAdminRequest } from "@/lib/foundry-admin-auth";
import {
  pgAdminSetAssessmentFacilitator,
  looksLikeUuid,
} from "@/lib/training-pg";

export const runtime = "nodejs";

type Body = {
  assessmentId?: string;
  targetFacilitatorId?: string;
};

/** Organizer-only — move assessment ownership between facilitator rows (submissions keep same assessment ids). */
export async function PATCH(req: NextRequest) {
  if (!isFoundryAdminRequest(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  const assessmentId = String(body.assessmentId || "").trim();
  const targetFacilitatorId = String(body.targetFacilitatorId || "").trim();

  if (!looksLikeUuid(assessmentId) || !looksLikeUuid(targetFacilitatorId)) {
    return Response.json({ error: "Valid assessmentId and targetFacilitatorId required." }, { status: 400 });
  }

  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL missing." }, { status: 503 });
  }

  await ensureFoundrySubmissionsSchema(pool);
  const ok = await pgAdminSetAssessmentFacilitator(
    pool,
    assessmentId,
    targetFacilitatorId,
  );
  if (!ok) {
    return Response.json(
      { error: "Assessment or target facilitator not found." },
      { status: 404 },
    );
  }

  return Response.json({ ok: true });
}
