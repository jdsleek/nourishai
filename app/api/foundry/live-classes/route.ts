import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { pgLiveOpenCoursesPublic } from "@/lib/training-pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public list of facilitator cohorts currently accepting submissions (student discovery).
 */
export async function GET() {
  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "Service unavailable." }, { status: 503 });
  }

  await ensureFoundrySubmissionsSchema(pool);

  const courses = await pgLiveOpenCoursesPublic(pool);
  return Response.json({ courses });
}
