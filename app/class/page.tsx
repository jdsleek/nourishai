import ClassHubBody from "./ClassHubBody";

function parseCourseSlug(
  raw: string | string[] | undefined,
): string | null {
  if (typeof raw === "string") {
    const s = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    return s.length >= 3 ? s : null;
  }
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    const s = raw[0].trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    return s.length >= 3 ? s : null;
  }
  return null;
}

/** ?course=<assessment slug> binds this hub to THAT facilitator assessment (multi‑cohort safe). */
export default function ClassHubPage({
  searchParams,
}: {
  searchParams: { course?: string | string[] | undefined };
}) {
  const courseSlug = parseCourseSlug(searchParams.course);

  return <ClassHubBody courseSlug={courseSlug} />;
}
