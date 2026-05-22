import {
  day04ClassHubPayload,
  isDay04AssessmentSlug,
} from "@/lib/foundry-day04-defaults";
import type { ClassHubPayload } from "@/lib/foundry-class-hub-types";
export type { ClassHubPayload } from "@/lib/foundry-class-hub-types";
export { clientClassHubFallback } from "@/lib/foundry-class-hub-types";
import { learnerChecklistFromRows } from "@/lib/foundry-learner-checklist";
import { learnerDeckPath } from "@/lib/foundry-learner-course";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { QAF_COHORT_SUBGROUPS } from "@/lib/foundry-subgroups";
import { pgAssessmentBySlug, pgFacilitatorById } from "@/lib/training-pg";

export type ClassHubError = {
  error: "UNKNOWN_COURSE" | "DATABASE_UNAVAILABLE";
  message: string;
  status: 404 | 503;
};

const WORKBOOK_PATH = "/class-workbook";

function day04HubWithSubgroups(): ClassHubPayload {
  return {
    ...day04ClassHubPayload(),
    subgroups: [...QAF_COHORT_SUBGROUPS],
  };
}

function builtinFallback(): ClassHubPayload {
  return {
    programName: "Qubators AI Foundry",
    deckHref: "/foundry/day04-frontend",
    workbookPath: WORKBOOK_PATH,
    assessmentSlug: null,
    assessmentTitle: null,
    submissionsOpen: true,
    subgroups: [...QAF_COHORT_SUBGROUPS],
    minPromptChars: 40,
    minOutputChars: 80,
    siteDefaultActive: false,
    mode: "builtin",
    studentChecklist: learnerChecklistFromRows([]),
    levelUpUrl: null,
  };
}

/** Shared by GET /api/foundry/class-hub and /learn/[slug] SSR. */
export async function resolveClassHubConfig(
  slugRequested: string | null | undefined,
): Promise<ClassHubPayload | ClassHubError> {
  const slug = typeof slugRequested === "string" ? slugRequested.trim() : "";

  if (!slug) {
    return builtinFallback();
  }

  if (isDay04AssessmentSlug(slug)) {
    const poolEarly = getFoundryPgPool();
    if (!poolEarly) {
      return day04HubWithSubgroups();
    }
  }

  const pool = getFoundryPgPool();
  if (!pool) {
    return {
      error: "DATABASE_UNAVAILABLE",
      message:
        "Course lookup requires the live database. Open this link on the deployed site.",
      status: 503,
    };
  }

  await ensureFoundrySubmissionsSchema(pool);

  const a = await pgAssessmentBySlug(pool, slug);
  if (!a) {
    if (isDay04AssessmentSlug(slug)) {
      return day04HubWithSubgroups();
    }
    return {
      error: "UNKNOWN_COURSE",
      message:
        "This course link does not exist on the server yet, or the address was pasted incorrectly.",
      status: 404,
    };
  }

  const subgroups =
    a.subgroup_options.length > 0 ? a.subgroup_options : [...QAF_COHORT_SUBGROUPS];

  const fac = await pgFacilitatorById(pool, a.facilitator_id);
  const facilitatorEmail =
    typeof fac?.email === "string" && fac.email.trim().length > 0 ? fac.email.trim() : null;
  const facilitatorDisplayName =
    typeof fac?.display_name === "string" && fac.display_name.trim().length > 0
      ? fac.display_name.trim()
      : null;

  return {
    programName: "Qubators AI Foundry",
    deckHref: learnerDeckPath(a.slug),
    workbookPath: WORKBOOK_PATH,
    facilitatorEmail,
    facilitatorDisplayName,
    assessmentSlug: a.slug,
    assessmentTitle: a.title,
    assessmentIntro: a.assessment_intro ?? "",
    submissionsOpen: a.submissions_open,
    subgroups,
    minPromptChars: Math.max(0, a.min_prompt_chars),
    minOutputChars: Math.max(0, a.min_output_chars),
    siteDefaultActive: false,
    mode: "course",
    studentChecklist: learnerChecklistFromRows(a.student_checklist),
    levelUpUrl: a.level_up_url.trim().length > 0 ? a.level_up_url.trim() : null,
  };
}

export function isClassHubError(
  v: ClassHubPayload | ClassHubError,
): v is ClassHubError {
  return "error" in v && "status" in v;
}
