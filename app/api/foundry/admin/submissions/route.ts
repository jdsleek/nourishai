import { readFoundrySubmissionsNewestFirst } from "@/lib/foundry-store";
import { isFoundryAdminRequest } from "@/lib/foundry-admin-auth";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isFoundryAdminRequest(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const submissions = await readFoundrySubmissionsNewestFirst();
  return Response.json({ submissions });
}
