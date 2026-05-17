import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { isFoundryAdminRequest } from "@/lib/foundry-admin-auth";
import {
  pgCreateFacilitator,
  pgFacilitatorByEmail,
} from "@/lib/training-pg";

export const runtime = "nodejs";

type Body = {
  email?: string;
  password?: string;
  displayName?: string;
};

/** Organizer-only bootstrap for facilitator accounts */
export async function POST(req: NextRequest) {
  if (!isFoundryAdminRequest(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const displayName = String(body.displayName || "").trim() || email;

  if (!email.includes("@")) {
    return Response.json({ error: "Valid email required." }, { status: 400 });
  }
  if (password.length < 10) {
    return Response.json(
      { error: "Password must be at least 10 characters." },
      { status: 400 },
    );
  }

  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL missing." }, { status: 503 });
  }

  await ensureFoundrySubmissionsSchema(pool);

  const existing = await pgFacilitatorByEmail(pool, email);
  if (existing) {
    return Response.json({ error: "Facilitator with that email already exists." }, { status: 409 });
  }

  const hash = bcrypt.hashSync(password, 11);
  const row = await pgCreateFacilitator(pool, email, hash, displayName);

  return Response.json({
    ok: true,
    facilitator: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
    },
  });
}
