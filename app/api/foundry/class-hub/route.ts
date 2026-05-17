import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { QAF_COHORT_SUBGROUPS } from "@/lib/foundry-subgroups";
import { pgGetSiteDefaultAssessment } from "@/lib/training-pg";

export const runtime = "nodejs";

/** Public student hub — current class deck + submission window (no secrets). */
export async function GET() {
  const pool = getFoundryPgPool();
  const base = {
    programName: "Qubators AI Foundry",
    deckPath: "/",
    workbookPath: "/class-workbook",
    assessmentSlug: null as string | null,
    assessmentTitle: null as string | null,
    submissionsOpen: true,
    subgroups: [...QAF_COHORT_SUBGROUPS],
    minPromptChars: 40,
    minOutputChars: 80,
    siteDefaultActive: false,
  };

  if (!pool) {
    return Response.json(base);
  }

  await ensureFoundrySubmissionsSchema(pool);
  const site = await pgGetSiteDefaultAssessment(pool);
  if (!site) {
    return Response.json(base);
  }

  const subgroups =
    site.subgroup_options.length > 0 ? site.subgroup_options : [...QAF_COHORT_SUBGROUPS];

  return Response.json({
    ...base,
    assessmentSlug: site.slug,
    assessmentTitle: site.title,
    submissionsOpen: site.submissions_open,
    subgroups,
    minPromptChars: Math.max(0, site.min_prompt_chars),
    minOutputChars: Math.max(0, site.min_output_chars),
    siteDefaultActive: true,
    deckPath: "/",
    slugDeckPath: `/foundry/day03?assessment=${encodeURIComponent(site.slug)}`,
  });
}
