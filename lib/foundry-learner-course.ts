/** sessionStorage key — keeps cohort slug when ?assessment= is dropped from the deck URL */
export const FOUNDRY_LEARNER_COURSE_SLUG_KEY = "foundry.courseSlug.v1";

export function normalizeLearnerCourseSlug(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  return s.length >= 3 ? s : null;
}

export function persistLearnerCourseSlug(raw: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const slug = normalizeLearnerCourseSlug(raw);
  if (!slug) return;
  try {
    sessionStorage.setItem(FOUNDRY_LEARNER_COURSE_SLUG_KEY, slug);
  } catch {
    /* private mode / quota */
  }
}

export function readPersistedLearnerCourseSlug(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeLearnerCourseSlug(sessionStorage.getItem(FOUNDRY_LEARNER_COURSE_SLUG_KEY));
  } catch {
    return null;
  }
}

/** Drop cohort context (e.g. generic /class hub or stale session before a facilitator link). */
export function clearPersistedLearnerCourseSlug(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(FOUNDRY_LEARNER_COURSE_SLUG_KEY);
  } catch {
    /* private mode */
  }
}

export function learnerDeckPath(slug: string): string {
  return `/foundry/day03?assessment=${encodeURIComponent(slug)}`;
}

export function learnerClassHubPath(slug: string): string {
  return `/learn/${encodeURIComponent(slug)}`;
}
