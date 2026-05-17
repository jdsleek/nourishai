import { NextRequest } from "next/server";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { QAF_COHORT_SUBGROUPS } from "@/lib/foundry-subgroups";
import { pgAssessmentBySlug, pgGetSiteDefaultAssessment } from "@/lib/training-pg";

export const runtime = "nodejs";

function deckWithAssessment(slug: string): string {
  return `/foundry/day03?assessment=${encodeURIComponent(slug.trim().toLowerCase())}`;
}

/** Public learner hub — always returns a canonical deck path where ?assessment= is preserved by the Route Handler (no fragile root rewrite). */
export async function GET(req: NextRequest) {
  const pool = getFoundryPgPool();
  const workbookPath = "/class-workbook";

  const baseFallback = {
    programName: "Qubators AI Foundry",
    deckHref: "/foundry/day03",
    workbookPath,
    assessmentSlug: null as string | null,
    assessmentTitle: null as string | null,
    submissionsOpen: true,
    subgroups: [...QAF_COHORT_SUBGROUPS],
    minPromptChars: 40,
    minOutputChars: 80,
    siteDefaultActive: false,
    mode: "builtin" as const,
  };

  const slugRequested = req.nextUrl.searchParams.get("slug")?.trim();

  if (!pool) {
    if (slugRequested) {
      return Response.json(
        {
          error: "DATABASE_UNAVAILABLE",
          message:
            "Course lookup requires the live database. Open this link on the deployed site.",
        },
        { status: 503 },
      );
    }
    return Response.json(baseFallback);
  }

  await ensureFoundrySubmissionsSchema(pool);

  if (slugRequested) {
    const a = await pgAssessmentBySlug(pool, slugRequested);
    if (!a) {
      return Response.json(
        {
          error: "UNKNOWN_COURSE",
          message:
            "This course link does not exist on the server yet, or the address was pasted incorrectly.",
        },
        { status: 404 },
      );
    }

    const subgroups =
      a.subgroup_options.length > 0 ? a.subgroup_options : [...QAF_COHORT_SUBGROUPS];

    return Response.json({
      programName: "Qubators AI Foundry",
      deckHref: deckWithAssessment(a.slug),
      workbookPath,
      assessmentSlug: a.slug,
      assessmentTitle: a.title,
      submissionsOpen: a.submissions_open,
      subgroups,
      minPromptChars: Math.max(0, a.min_prompt_chars),
      minOutputChars: Math.max(0, a.min_output_chars),
      siteDefaultActive: a.is_site_default,
      mode: "course" as const,
    });
  }

  const site = await pgGetSiteDefaultAssessment(pool);
  if (!site) {
    return Response.json({
      ...baseFallback,
      mode: "builtin" as const,
    });
  }

  const subgroups =
    site.subgroup_options.length > 0 ? site.subgroup_options : [...QAF_COHORT_SUBGROUPS];

  return Response.json({
    programName: "Qubators AI Foundry",
    deckHref: deckWithAssessment(site.slug),
    workbookPath,
    assessmentSlug: site.slug,
    assessmentTitle: site.title,
    submissionsOpen: site.submissions_open,
    subgroups,
    minPromptChars: Math.max(0, site.min_prompt_chars),
    minOutputChars: Math.max(0, site.min_output_chars),
    siteDefaultActive: true,
    mode: "site-default" as const,
  });
}
