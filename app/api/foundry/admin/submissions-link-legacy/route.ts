import { NextRequest } from "next/server";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { isFoundryAdminRequest } from "@/lib/foundry-admin-auth";
import {
  pgAdminLinkLegacySubmissions,
  pgCountSubmissionsLegacyNoAssessment,
  looksLikeUuid,
} from "@/lib/training-pg";

export const runtime = "nodejs";

/** Organizers only — catastrophic if mis-used; gated by typed confirm phrase when not dry-run. */
const CONFIRM = "LINK_ALL_LEGACY_SUBMISSIONS";

type PatchBody = {
  toAssessmentId?: string;
  dryRun?: boolean;
  confirm?: string;
};

export async function GET(req: NextRequest) {
  if (!isFoundryAdminRequest(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL missing." }, { status: 503 });
  }
  await ensureFoundrySubmissionsSchema(pool);
  const legacyCount = await pgCountSubmissionsLegacyNoAssessment(pool);
  return Response.json({ legacyCount });
}

export async function POST(req: NextRequest) {
  if (!isFoundryAdminRequest(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL missing." }, { status: 503 });
  }

  const body = (await req.json()) as PatchBody;
  const to = String(body.toAssessmentId || "").trim();
  const dryRun = body.dryRun === true;

  if (!looksLikeUuid(to)) {
    return Response.json({ error: "Valid toAssessmentId required." }, { status: 400 });
  }

  await ensureFoundrySubmissionsSchema(pool);

  const legacyBefore = await pgCountSubmissionsLegacyNoAssessment(pool);
  if (dryRun) {
    return Response.json({
      ok: true,
      dryRun: true,
      wouldLink: legacyBefore,
      toAssessmentId: to,
    });
  }

  if (String(body.confirm || "") !== CONFIRM) {
    return Response.json(
      {
        error: `Dangerous cohort-wide migration. Retry with confirm: "${CONFIRM}".`,
      },
      { status: 400 },
    );
  }

  const moved = await pgAdminLinkLegacySubmissions(pool, to);
  return Response.json({ ok: true, moved });
}
