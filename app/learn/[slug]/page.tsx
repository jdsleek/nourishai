import { notFound } from "next/navigation";
import ClassHubBody from "@/app/class/ClassHubBody";
import { parseCourseSlugParam } from "@/lib/course-slug";

export const dynamic = "force-dynamic";

/**
 * Stable path-based class hub URL (slug in the path, not only query).
 * Survives messengers trimming ?course= links better than `/class?course=…`.
 */
export default function LearnCourseHubPage({
  params,
}: {
  params: { slug: string };
}) {
  const courseSlug = parseCourseSlugParam(params.slug);
  if (!courseSlug) notFound();
  const canonicalHubPath = `/learn/${courseSlug}`;
  return <ClassHubBody courseSlug={courseSlug} canonicalHubPath={canonicalHubPath} />;
}
