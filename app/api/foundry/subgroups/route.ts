import { QAF_COHORT_SUBGROUPS } from "@/lib/foundry-subgroups";

export const runtime = "nodejs";

export function GET() {
  return Response.json({ subgroups: [...QAF_COHORT_SUBGROUPS] });
}
