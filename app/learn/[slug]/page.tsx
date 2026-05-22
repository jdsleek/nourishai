import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ClassHubBody from "@/app/class/ClassHubBody";
import { parseCourseSlugParam } from "@/lib/course-slug";
import {
  isClassHubError,
  resolveClassHubConfig,
  type ClassHubPayload,
} from "@/lib/foundry-class-hub-resolve";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const courseSlug = parseCourseSlugParam(params.slug);
  if (!courseSlug) return {};
  return {
    title: `Class hub · ${courseSlug}`,
    description: `Learner hub for cohort ${courseSlug} — workbook and links. Slides open separately from this page.`,
  };
}

/**
 * Stable path-based class hub URL (slug in the path, not only query).
 * Survives messengers trimming ?course= links better than `/class?course=…`.
 */
export default async function LearnCourseHubPage({
  params,
}: {
  params: { slug: string };
}) {
  const courseSlug = parseCourseSlugParam(params.slug);
  if (!courseSlug) notFound();

  const resolved = await resolveClassHubConfig(courseSlug);
  const initialHub: ClassHubPayload | null = isClassHubError(resolved)
    ? null
    : resolved;

  const canonicalHubPath = `/learn/${courseSlug}`;

  return (
    <ClassHubBody
      courseSlug={courseSlug}
      canonicalHubPath={canonicalHubPath}
      initialHub={initialHub}
      initialHubError={
        isClassHubError(resolved) ? resolved.message : null
      }
    />
  );
}
