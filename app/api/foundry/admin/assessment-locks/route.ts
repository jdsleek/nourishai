import { NextRequest } from "next/server";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { isFoundryAdminRequest } from "@/lib/foundry-admin-auth";
import {
  pgAdminListAssessmentLockSummaries,
  pgAdminSetAssessmentSubmissionsOpen,
} from "@/lib/training-pg";

export const runtime = "nodejs";

type PatchBody = {
  assessmentId?: string;
  submissionsOpen?: boolean;
};

/** Organizer: list facilitator assessments and whether learners can still submit. */
export async function GET(req: NextRequest) {
  if (!isFoundryAdminRequest(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL missing." }, { status: 503 });
  }

  await ensureFoundrySubmissionsSchema(pool);
  const assessments = await pgAdminListAssessmentLockSummaries(pool);
  return Response.json({ assessments });
}

/** Organizer: open or close learner submissions for one assessment (by UUID). */
export async function PATCH(req: NextRequest) {
  if (!isFoundryAdminRequest(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await req.json()) as PatchBody;
  const assessmentId = String(body.assessmentId || "").trim();
  if (typeof body.submissionsOpen !== "boolean") {
    return Response.json(
      { error: "Body must include submissionsOpen (boolean)." },
      { status: 400 },
    );
  }

  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL missing." }, { status: 503 });
  }

  await ensureFoundrySubmissionsSchema(pool);
  const ok = await pgAdminSetAssessmentSubmissionsOpen(
    pool,
    assessmentId,
    body.submissionsOpen,
  );

  if (!ok) {
    return Response.json(
      { error: "Assessment not found or invalid id." },
      { status: 404 },
    );
  }

  return Response.json({ ok: true, assessmentId, submissionsOpen: body.submissionsOpen });
}
