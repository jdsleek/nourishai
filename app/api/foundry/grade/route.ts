import { NextRequest } from "next/server";
import { getGroq, GROQ_MODEL } from "@/lib/groq";
import {
  buildFoundryRubricPrompt,
  normalizeGraderResult,
  parseGraderJson,
} from "@/lib/foundry-grade";
import { clipFoundryBodiesForGroq } from "@/lib/foundry-grade-clip";
import { QAF_COHORT_SUBGROUPS } from "@/lib/foundry-subgroups";
import { appendFoundrySubmission } from "@/lib/foundry-store";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  name?: string;
  subgroup?: string;
  prompt?: string;
  output?: string;
};

function groqErrStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const o = err as {
    status?: number;
    response?: { status?: number };
  };
  if (typeof o.status === "number") return o.status;
  const r = o.response?.status;
  if (typeof r === "number") return r;
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const name = String(body.name || "").trim();
    const subgroup = String(body.subgroup || "").trim();
    const prompt = String(body.prompt || "").trim();
    const output = String(body.output || "").trim();

    if (!name) {
      return Response.json(
        { error: "Fellow / student name is required." },
        { status: 400 },
      );
    }
    if (!subgroup || !QAF_COHORT_SUBGROUPS.includes(subgroup)) {
      return Response.json(
        { error: "Select a valid subgroup from the list." },
        { status: 400 },
      );
    }
    if (prompt.length < 40) {
      return Response.json(
        { error: "Architecture prompt is too short." },
        { status: 400 },
      );
    }
    if (output.length < 80) {
      return Response.json(
        {
          error:
            "Architecture output is too short — include all key sections.",
        },
        { status: 400 },
      );
    }

    const clipped = clipFoundryBodiesForGroq(prompt, output);
    const rubricPrompt = buildFoundryRubricPrompt(
      name,
      subgroup,
      clipped.promptForModel,
      clipped.outputForModel,
    );

    const groq = getGroq();
    let res;
    try {
      res = await groq.chat.completions.create({
        model: GROQ_MODEL,
        temperature: 0,
        max_tokens: 1400,
        messages: [{ role: "user", content: rubricPrompt }],
      });
    } catch (groqErr: unknown) {
      const status = groqErrStatus(groqErr);
      console.error("[foundry/grade] Groq create failed", groqErr);

      if (status === 413) {
        return Response.json(
          {
            error:
              "The grading service rejected this attempt because it was too large for the current AI quota (token limit). Shorten what you paste in the prompt and architecture output — keep headings and representative bullets — then submit again.",
            code: "groq_prompt_tpm_exceeded",
            hint:
              "If this persists, facilitators may lower paste length guidance, set env FOUNDRY_GRADE_MAX_OUTPUT_CHARS smaller, upgrade Groq, or switch GROQ_MODEL to a lighter model.",
          },
          { status: 503 },
        );
      }

      throw groqErr;
    }

    const raw = res.choices[0]?.message?.content?.trim() || "";
    if (!raw) {
      return Response.json(
        { error: "Empty response from grading model." },
        { status: 502 },
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
        { status: 502 },
      );
    }

    const result = normalizeGraderResult(parsed);

    const entry = {
      fellowName: name,
      subgroup,
      ide: "",
      prompt,
      output,
      result,
    };

    let persisted = false;
    const delays = [0, 250, 600];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
      try {
        await appendFoundrySubmission(entry);
        persisted = true;
        break;
      } catch (storeErr) {
        console.error(
          `[foundry/grade] persist error attempt ${attempt + 1}`,
          storeErr,
        );
      }
    }

    if (!persisted) {
      console.error("[foundry/grade] all persist attempts failed");
    }

    return Response.json({
      ok: true,
      result,
      persisted,
      gradedWithTruncatedExcerpt: clipped.truncated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Grading failed.";
    console.error("[foundry/grade]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
