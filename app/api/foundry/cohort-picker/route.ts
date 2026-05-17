import { NextRequest } from "next/server";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { pgFacilitatorCourseCatalogBySlug } from "@/lib/training-pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Given any known assessment slug, return that facilitator’s cohort list (student hub picker).
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return Response.json({ error: "Query ?slug= is required." }, { status: 400 });
  }

  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "Service unavailable." }, { status: 503 });
  }

  await ensureFoundrySubmissionsSchema(pool);

  const data = await pgFacilitatorCourseCatalogBySlug(pool, slug);
  if (!data) {
    return Response.json({ error: "Unknown slug." }, { status: 404 });
  }

  return Response.json(data);
}
