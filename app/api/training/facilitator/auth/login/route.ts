import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import {
  facilitatorSessionExpiry,
  facilitatorCookieName,
  sealFacilitatorSession,
} from "@/lib/facilitator-session";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { pgFacilitatorByEmail } from "@/lib/training-pg";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL missing." }, { status: 503 });
  }

  await ensureFoundrySubmissionsSchema(pool);

  type Body = { email?: string; password?: string };
  const body = (await req.json()) as Body;
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return Response.json({ error: "Email and password required." }, { status: 400 });
  }

  const fac = await pgFacilitatorByEmail(pool, email);
  if (!fac || !fac.password_hash) {
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const ok = bcrypt.compareSync(password, fac.password_hash);
  if (!ok) {
    return Response.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = sealFacilitatorSession({
    fid: fac.id,
    email: fac.email,
    exp: facilitatorSessionExpiry(),
  });

  const res = NextResponse.json({
    ok: true,
    facilitator: {
      id: fac.id,
      email: fac.email,
      displayName: fac.display_name,
    },
  });
  const secure =
    req.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
  res.cookies.set(facilitatorCookieName(), token, {
    httpOnly: true,
    secure: secure,
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 24 * 60 * 60,
  });
  return res;
}
