import type { NextRequest } from "next/server";
import { isFoundryAdminRequest } from "@/lib/foundry-admin-auth";
import { getAnthropicRefRatesUsdPerMTok } from "@/lib/foundry-anthropic-cost";
import { getFoundryPgPool } from "@/lib/foundry-pg";
import { getFoundryLlmUsageTotals } from "@/lib/foundry-llm-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Aggregated Foundry grader usage + Anthropic-priced reference equivalents (organizer dashboard). */
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
    const rates = getAnthropicRefRatesUsdPerMTok();
    return Response.json({ stats, rates });
  } catch (e) {
    console.error("[foundry/admin/llm-usage]", e);
    const message = e instanceof Error ? e.message : "Failed to aggregate usage.";
    return Response.json({ error: message, stats: null }, { status: 500 });
  }
}
