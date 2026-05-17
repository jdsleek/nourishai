import { NextRequest } from "next/server";
import { getFoundrySubmissionGradeById } from "@/lib/foundry-store";

export const runtime = "nodejs";

/** Public learner lookup by submission id — grade summary only (no prompt/output). */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return Response.json({ error: "Submission id required." }, { status: 400 });
  }

  const row = await getFoundrySubmissionGradeById(id);
  if (!row) {
    return Response.json({ error: "Submission not found." }, { status: 404 });
  }

  return Response.json({
    id: row.id,
    submittedAt: row.submittedAt,
    result: row.result,
  });
}
