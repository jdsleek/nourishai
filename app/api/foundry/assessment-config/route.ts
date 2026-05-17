import { NextRequest } from "next/server";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { pgAssessmentBySlug } from "@/lib/training-pg";
import { QAF_COHORT_SUBGROUPS } from "@/lib/foundry-subgroups";

export const runtime = "nodejs";

/** Public endpoint for learner deck — subgroup list & min lengths for an assessment */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return Response.json(
      {
        slug: "",
        title: "Built-in Foundry deck",
        subgroups: [...QAF_COHORT_SUBGROUPS],
        minPromptChars: 40,
        minOutputChars: 80,
      },
      { status: 200 },
    );
  }

  const pool = getFoundryPgPool();
  if (!pool) {
    return Response.json({ error: "Database unavailable." }, { status: 503 });
  }
  await ensureFoundrySubmissionsSchema(pool);

  const a = await pgAssessmentBySlug(pool, slug);
  if (!a) {
    return Response.json({ error: "Unknown assessment slug." }, { status: 404 });
  }

  const subgroups =
    a.subgroup_options.length > 0 ? a.subgroup_options : [...QAF_COHORT_SUBGROUPS];

  return Response.json({
    slug: a.slug,
    title: a.title,
    intro: a.assessment_intro,
    subgroups,
    minPromptChars: Math.max(0, a.min_prompt_chars),
    minOutputChars: Math.max(0, a.min_output_chars),
  });
}
