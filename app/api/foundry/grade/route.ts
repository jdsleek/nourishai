import { NextRequest } from "next/server";
import { getGroq, GROQ_MODEL } from "@/lib/groq";
import {
  buildFoundryRubricPrompt,
  normalizeGraderResult,
  parseGraderJson,
} from "@/lib/foundry-grade";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  name?: string;
  ide?: string;
  prompt?: string;
  output?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const name = String(body.name || "").trim();
    const ide = String(body.ide || "").trim();
    const prompt = String(body.prompt || "").trim();
    const output = String(body.output || "").trim();

    if (!name) {
      return Response.json({ error: "Name is required." }, { status: 400 });
    }
    if (ide.length < 24) {
      return Response.json(
        { error: "Workspace description is too short — add specific IDE and file details." },
        { status: 400 }
      );
    }
    if (prompt.length < 40) {
      return Response.json(
        { error: "Architecture prompt is too short." },
        { status: 400 }
      );
    }
    if (output.length < 80) {
      return Response.json(
        { error: "Architecture output is too short — include all key sections." },
        { status: 400 }
      );
    }

    const groq = getGroq();
    const rubric = buildFoundryRubricPrompt(name, ide, prompt, output);

    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0,
      max_tokens: 2048,
      messages: [{ role: "user", content: rubric }],
    });

    const raw = res.choices[0]?.message?.content?.trim() || "";
    if (!raw) {
      return Response.json(
        { error: "Empty response from grading model." },
        { status: 502 }
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = parseGraderJson(raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid JSON from model.";
      console.error("[foundry/grade] parse error", raw.slice(0, 500));
      return Response.json(
        { error: msg, rawPreview: raw.slice(0, 400) },
        { status: 502 }
      );
    }

    const result = normalizeGraderResult(parsed);
    return Response.json({ ok: true, result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Grading failed.";
    console.error("[foundry/grade]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
