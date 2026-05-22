import {
  day04ClassHubPayload,
  isDay04AssessmentSlug,
} from "@/lib/foundry-day04-defaults";
import { QAF_COHORT_SUBGROUPS } from "@/lib/foundry-subgroups";

export type ClassHubPayload = {
  programName: string;
  deckHref: string;
  workbookPath: string;
  facilitatorEmail?: string | null;
  facilitatorDisplayName?: string | null;
  assessmentSlug: string | null;
  assessmentTitle: string | null;
  assessmentIntro?: string | null;
  submissionsOpen: boolean;
  subgroups: string[];
  minPromptChars: number;
  minOutputChars: number;
  siteDefaultActive: boolean;
  mode: "builtin" | "course";
  studentChecklist: string[];
  levelUpUrl: string | null;
};

/** Client-safe fallback when fetch fails but slug is a known Day 04 cohort link. */
export function clientClassHubFallback(slug: string): ClassHubPayload | null {
  if (!isDay04AssessmentSlug(slug)) return null;
  return {
    ...day04ClassHubPayload(),
    subgroups: [...QAF_COHORT_SUBGROUPS],
  };
}
