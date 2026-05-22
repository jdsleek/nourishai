import { NextRequest } from "next/server";
import {
  isClassHubError,
  resolveClassHubConfig,
} from "@/lib/foundry-class-hub-resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/** Public learner hub — returns a cohort-specific deck path plus legacy defaults when unset. */
export async function GET(req: NextRequest) {
  const slugRequested = req.nextUrl.searchParams.get("slug")?.trim() || null;
  const result = await resolveClassHubConfig(slugRequested);

  if (isClassHubError(result)) {
    return Response.json(
      { error: result.error, message: result.message },
      { status: result.status, headers: NO_STORE },
    );
  }

  return Response.json(result, { headers: NO_STORE });
}
