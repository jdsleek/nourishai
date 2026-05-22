import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeAssessmentSlug(raw: string): string | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return s.length >= 3 ? s : null;
}

/**
 * Cohort-specific Day 03 URL: `/foundry/deck/your-course-slug` (same HTML as `/foundry/day03`).
 * The segment is validated so arbitrary paths cannot be used as opaque proxies.
 */
export async function GET(
  _req: Request,
  ctx: { params: { slug: string } },
) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(ctx.params.slug);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const slug = normalizeAssessmentSlug(decoded);
  if (!slug) {
    return new Response("Not found", { status: 404 });
  }

  const deckFile =
    slug.startsWith("qaf-day04") || slug.includes("day04")
      ? "day04-build-day.html"
      : "day03-ai-builder.html";
  const filePath = path.join(process.cwd(), "public", deckFile);
  const html = await readFile(filePath, "utf8");
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
