import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { facilitatorFromCookie } from "@/lib/training-session-cookie";
import { pgFacilitatorByEmail } from "@/lib/training-pg";

export const runtime = "nodejs";

export async function GET() {
  const ses = facilitatorFromCookie();
  if (!ses) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const pool = getFoundryPgPool();
  if (!pool) return Response.json({ error: "No database." }, { status: 503 });

  await ensureFoundrySubmissionsSchema(pool);
  const fac = await pgFacilitatorByEmail(pool, ses.email);
  if (!fac || fac.id !== ses.fid) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  return Response.json({
    id: fac.id,
    email: fac.email,
    displayName: fac.display_name,
  });
}
