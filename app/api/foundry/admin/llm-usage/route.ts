import type { NextRequest } from "next/server";
import { isFoundryAdminRequest } from "@/lib/foundry-admin-auth";
import { getFoundryPgPool } from "@/lib/foundry-pg";
import { getFoundryLlmUsageTotals } from "@/lib/foundry-llm-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Aggregated Foundry grader token usage (organizer dashboard). */
export async function GET(req: NextRequest) {
  if (!isFoundryAdminRequest(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json(
      { error: "DATABASE_URL is not configured.", stats: null },
      { status: 503 },
    );
  }

  try {
    const stats = await getFoundryLlmUsageTotals(pool);
    return Response.json({ stats });
  } catch (e) {
    console.error("[foundry/admin/llm-usage]", e);
    const message = e instanceof Error ? e.message : "Failed to aggregate usage.";
    return Response.json({ error: message, stats: null }, { status: 500 });
  }
}
