import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Day 04 — From Idea to Working Product (full-day slides: frontend + backend). */
export async function GET() {
  const filePath = path.join(process.cwd(), "public", "day04-build-day.html");
  const html = await readFile(filePath, "utf8");
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}
