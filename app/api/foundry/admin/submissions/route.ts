import { readFoundrySubmissionsNewestFirst, deleteFoundrySubmission } from "@/lib/foundry-store";
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

export async function DELETE(req: NextRequest) {
  if (!isFoundryAdminRequest(req)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "Query parameter \"id\" (UUID) is required." }, { status: 400 });
  }

  try {
    const { removed } = await deleteFoundrySubmission(id);
    if (!removed) {
      return Response.json(
        { error: "No submission matched that id (or invalid id)." },
        { status: 404 }
      );
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[foundry/admin/submissions] DELETE", e);
    const message = e instanceof Error ? e.message : "Delete failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
