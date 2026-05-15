import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { isFoundryAdminRequest } from "@/lib/foundry-admin-auth";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const registryFile = path.join(
  process.cwd(),
  "registry",
  "qaf-product-ideation-registry.html",
);

/** Full HTML artifact (not for public `public/` — served only here). */
export async function GET(req: NextRequest) {
  if (!isFoundryAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const html = await readFile(registryFile, "utf8");
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Registry file missing — run `npm run build:qaf-registry` after updating the cohort CSV.",
      },
      { status: 404 },
    );
  }
}
