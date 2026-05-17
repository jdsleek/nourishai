import { NextRequest } from "next/server";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { isFoundryAdminRequest } from "@/lib/foundry-admin-auth";
import { pgAdminDeleteAssessment } from "@/lib/training-pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Organizer deletes a facilitator assessment row (frees slug; submissions become unlinked). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isFoundryAdminRequest(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const assessmentId = String(params.id || "").trim();
  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL missing." }, { status: 503 });
  }

  await ensureFoundrySubmissionsSchema(pool);

  const { ok, submissionsUnlinked } = await pgAdminDeleteAssessment(pool, assessmentId);

  if (!ok) {
    return Response.json(
      { error: "Assessment not found or invalid id." },
      { status: 404 }
    );
  }

  return Response.json({
    ok: true,
    assessmentId,
    submissionsUnlinked,
  });
}
