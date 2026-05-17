/**
 * Normalizes a course slug from a query/path segment ([a-z0-9-], min length 3).
 * Used by /class ?course and /learn/[slug] so both stay consistent with DB slugs.
 */
export function parseCourseSlugParam(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = decodeURIComponent(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return s.length >= 3 ? s : null;
}
