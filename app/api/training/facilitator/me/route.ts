import {
  facilitatorAuthFailureResponse,
  resolveFacilitatorRequest,
} from "@/lib/training-facilitator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await resolveFacilitatorRequest();
  if (!auth.ok) return facilitatorAuthFailureResponse(auth);

  return Response.json({
    id: auth.ctx.facilitatorId,
    email: auth.ctx.facilitatorEmail,
    displayName: auth.ctx.facilitatorDisplayName,
  });
}
