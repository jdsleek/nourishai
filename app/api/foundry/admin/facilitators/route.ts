import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { isFoundryAdminRequest } from "@/lib/foundry-admin-auth";
import {
  pgAdminListFacilitators,
  pgAdminUpdateFacilitatorByEmail,
  pgCreateFacilitator,
  pgFacilitatorByEmail,
} from "@/lib/training-pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Organizer-only: directory (no hashes) */
export async function GET(req: NextRequest) {
  if (!isFoundryAdminRequest(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL missing." }, { status: 503 });
  }

  await ensureFoundrySubmissionsSchema(pool);
  const facilitators = await pgAdminListFacilitators(pool);
  return Response.json({
    facilitators: facilitators.map((f) => ({
      id: f.id,
      email: f.email,
      displayName: f.display_name,
      createdAt: f.created_at,
      assessmentCount: f.assessment_count,
    })),
  });
}

type PatchBody = {
  email?: string;
  password?: string;
  displayName?: string;
};

/** Organizer-only: rotate password and/or display name for an existing facilitator */
export async function PATCH(req: NextRequest) {
  if (!isFoundryAdminRequest(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await req.json()) as PatchBody;
  const email = String(body.email || "").trim().toLowerCase();

  if (!email.includes("@")) {
    return Response.json({ error: "Valid email required." }, { status: 400 });
  }

  const password = String(body.password || "");

  const hasPwd = password.length > 0;
  if (hasPwd && password.length < 10) {
    return Response.json(
      { error: "Password must be at least 10 characters when provided." },
      { status: 400 },
    );
  }

  const includeDisplay = Object.prototype.hasOwnProperty.call(body, "displayName");
  if (!hasPwd && !includeDisplay) {
    return Response.json(
      { error: "Provide a new password and/or displayName." },
      { status: 400 },
    );
  }

  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "DATABASE_URL missing." }, { status: 503 });
  }

  await ensureFoundrySubmissionsSchema(pool);

  const existing = await pgFacilitatorByEmail(pool, email);
  if (!existing) {
    return Response.json({ error: "No facilitator with that email." }, { status: 404 });
  }

  const patch: { passwordHash?: string; displayName?: string } = {};
  if (hasPwd) patch.passwordHash = bcrypt.hashSync(password, 11);
  if (includeDisplay) patch.displayName = String(body.displayName ?? "").trim();

  const row = await pgAdminUpdateFacilitatorByEmail(pool, email, patch);
  if (!row) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  return Response.json({
    ok: true,
    facilitator: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
    },
  });
}

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
