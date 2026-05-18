import {
  facilitatorAuthFailureResponse,
  resolveFacilitatorRequest,
} from "@/lib/training-facilitator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISABLED =
  "Bulk-attaching legacy submissions is disabled. It previously moved every unlinked row in the database into one inbox, which could attach other facilitators' learners by mistake. Ask your program organizer to link legacy rows to the correct assessment using the admin tool.";

/** @deprecated Facilitator bulk-claim removed for multi-tenant safety. */
export async function POST() {
  const auth = await resolveFacilitatorRequest();
  if (!auth.ok) return facilitatorAuthFailureResponse(auth);
  return Response.json({ error: DISABLED }, { status: 403 });
}

/** @deprecated Orphan counts are no longer exposed to facilitators (global count was misleading). */
export async function GET() {
  const auth = await resolveFacilitatorRequest();
  if (!auth.ok) return facilitatorAuthFailureResponse(auth);
  return Response.json({ error: DISABLED }, { status: 403 });
}
