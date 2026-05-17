import { NextResponse } from "next/server";
import { facilitatorCookieName } from "@/lib/facilitator-session";

export const runtime = "nodejs";

export function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  const secure =
    new URL(req.url).protocol === "https:" ||
    process.env.NODE_ENV === "production";
  res.cookies.set(facilitatorCookieName(), "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
