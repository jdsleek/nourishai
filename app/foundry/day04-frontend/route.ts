import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Day 04 Part 1 — Frontend & UI/UX (Julius · 90 min). */
export async function GET() {
  const filePath = path.join(process.cwd(), "public", "day04-frontend.html");
  const html = await readFile(filePath, "utf8");
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  });
}
