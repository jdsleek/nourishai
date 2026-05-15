import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves the Qubators Day 03 slide deck (same file as public/day03-ai-builder.html).
 * Guarantees delivery on hosts where static public mapping is delayed or misconfigured.
 */
export async function GET() {
  const filePath = path.join(process.cwd(), "public", "day03-ai-builder.html");
  const html = await readFile(filePath, "utf8");
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
