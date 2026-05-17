import ClassHubBody from "./ClassHubBody";
import { parseCourseSlugParam } from "@/lib/course-slug";

function parseCourseFromSearch(
  raw: string | string[] | undefined,
): string | null {
  if (typeof raw === "string") return parseCourseSlugParam(raw);
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    return parseCourseSlugParam(raw[0]);
  }
  return null;
}

/** ?course=<assessment slug> binds this hub to THAT facilitator assessment (multi‑cohort safe). */
export default function ClassHubPage({
  searchParams,
}: {
  searchParams: { course?: string | string[] | undefined };
}) {
  const courseSlug = parseCourseFromSearch(searchParams.course);

  return <ClassHubBody courseSlug={courseSlug} />;
}
