import type { Pool } from "pg";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { pgFacilitatorByEmail } from "@/lib/training-pg";
import { facilitatorFromCookie } from "@/lib/training-session-cookie";

export type ResolvedFacilitatorCtx = {
  pool: Pool;
  facilitatorId: string;
  facilitatorEmail: string;
  facilitatorDisplayName: string;
};

export type ResolveFacilitatorFailureReason =
  | "no_session"
  | "no_database"
  | "unknown_facilitator";

export type ResolveFacilitatorResult =
  | { ok: true; ctx: ResolvedFacilitatorCtx }
  | { ok: false; reason: ResolveFacilitatorFailureReason };

export function facilitatorAuthFailureResponse(auth: {
  ok: false;
  reason: ResolveFacilitatorFailureReason;
}): Response {
  if (auth.reason === "no_database") {
    return Response.json({ error: "No database configured." }, { status: 503 });
  }
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}

/**
 * Resolve facilitator from signed cookie + DB row keyed by session email.
 * Uses DB facilitator id as authoritative (cookie `fid` may be stale after reseed / DB restore).
 */
export async function resolveFacilitatorRequest(): Promise<ResolveFacilitatorResult> {
  const ses = facilitatorFromCookie();
  if (!ses) return { ok: false, reason: "no_session" };

  const pool = getFoundryPgPool();
  if (!pool) return { ok: false, reason: "no_database" };

  await ensureFoundrySubmissionsSchema(pool);
  const fac = await pgFacilitatorByEmail(pool, ses.email);
  if (!fac) return { ok: false, reason: "unknown_facilitator" };

  return {
    ok: true,
    ctx: {
      pool,
      facilitatorId: fac.id,
      facilitatorEmail: fac.email,
      facilitatorDisplayName: fac.display_name,
    },
  };
}
