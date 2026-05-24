import { NextRequest } from "next/server";
import {
  DAY04_ASSESSMENT_SLUG,
  isDay04AssessmentSlug,
} from "@/lib/foundry-day04-defaults";
import { ensureDay04AssessmentInDb } from "@/lib/foundry-day04-db-seed";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { isFoundryAdminRequest } from "@/lib/foundry-admin-auth";
import {
  pgAdminListAssessmentLockSummaries,
  pgAdminSetAssessmentSubmissionsOpen,
  pgAdminSetAssessmentSubmissionsOpenBySlug,
} from "@/lib/training-pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

type PatchBody = {
  assessmentId?: string;
  assessmentSlug?: string;
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

  const ensureDay04 = await ensureDay04AssessmentInDb(pool);
  const assessments = await pgAdminListAssessmentLockSummaries(pool);

  return Response.json(
    {
      assessments,
      day04Ensure: ensureDay04.ok
        ? { ok: true, created: ensureDay04.created, slug: DAY04_ASSESSMENT_SLUG }
        : { ok: false, reason: ensureDay04.reason },
    },
    { headers: NO_STORE },
  );
}

/** Organizer: open or close learner submissions for one assessment (by UUID or slug). */
export async function PATCH(req: NextRequest) {
  if (!isFoundryAdminRequest(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await req.json()) as PatchBody;
  let assessmentId = String(body.assessmentId || "").trim();
  const assessmentSlug = String(body.assessmentSlug || "").trim();

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

  if (
    !assessmentId &&
    assessmentSlug &&
    isDay04AssessmentSlug(assessmentSlug)
  ) {
    const ensured = await ensureDay04AssessmentInDb(pool);
    if (!ensured.ok) {
      return Response.json(
        {
          error:
            ensured.reason === "no_facilitator"
              ? "No facilitator account in Postgres — add one under Facilitators first, then refresh."
              : "Could not register Day 04 assessment.",
        },
        { status: 503 },
      );
    }
    assessmentId = ensured.id;
  }

  if (!assessmentId && assessmentSlug) {
    const ok = await pgAdminSetAssessmentSubmissionsOpenBySlug(
      pool,
      assessmentSlug,
      body.submissionsOpen,
    );
    if (!ok) {
      return Response.json(
        { error: "Assessment not found for that slug." },
        { status: 404 },
      );
    }
    return Response.json({
      ok: true,
      assessmentSlug,
      submissionsOpen: body.submissionsOpen,
    });
  }

  if (!assessmentId) {
    return Response.json(
      { error: "Provide assessmentId or assessmentSlug." },
      { status: 400 },
    );
  }

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

  return Response.json({
    ok: true,
    assessmentId,
    submissionsOpen: body.submissionsOpen,
  });
}
