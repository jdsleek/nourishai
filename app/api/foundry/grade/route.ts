import { NextRequest } from "next/server";
import {
  gradeFailureLooksLikeTokenLimit,
  runFoundryGradeWithFallbacks,
} from "@/lib/foundry-grading-llm";
import {
  buildAssessmentRubricPrompt,
  buildFoundryRubricPrompt,
  normalizeGraderResult,
  parseGraderJson,
} from "@/lib/foundry-grade";
import { clipFoundryBodiesForGroq } from "@/lib/foundry-grade-clip";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { QAF_COHORT_SUBGROUPS } from "@/lib/foundry-subgroups";
import { appendFoundrySubmission } from "@/lib/foundry-store";
import { pgAssessmentBySlug } from "@/lib/training-pg";

export const runtime = "nodejs";
export const maxDuration = 120;

const GRADE_MAX_TOKENS = 1400;

type Body = {
  name?: string;
  subgroup?: string;
  prompt?: string;
  output?: string;
  /** When set, loads facilitator rubric from Postgres and stores `assessment_id` on the row. */
  assessmentSlug?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const name = String(body.name || "").trim();
    const subgroup = String(body.subgroup || "").trim();
    const prompt = String(body.prompt || "").trim();
    const output = String(body.output || "").trim();
    const slugRaw = String(body.assessmentSlug || "").trim().toLowerCase();

    if (!name) {
      return Response.json(
        { error: "Fellow / student name is required." },
        { status: 400 },
      );
    }
    if (!subgroup) {
      return Response.json(
        { error: "Select a subgroup from the list." },
        { status: 400 },
      );
    }

    const clipped = clipFoundryBodiesForGroq(prompt, output);
    let assessmentId: string | null = null;
    let rubricPrompt: string;

    if (slugRaw) {
      const pool = getFoundryPgPool();
      if (!pool) {
        return Response.json(
          {
            error:
              "This assessment requires DATABASE_URL on the server so its rubric can be loaded.",
          },
          { status: 503 },
        );
      }
      await ensureFoundrySubmissionsSchema(pool);
      const a = await pgAssessmentBySlug(pool, slugRaw);
      if (!a) {
        return Response.json({ error: "Unknown assessment." }, { status: 404 });
      }
      const allow =
        a.subgroup_options.length > 0 ? a.subgroup_options : [...QAF_COHORT_SUBGROUPS];
      if (!allow.includes(subgroup)) {
        return Response.json(
          { error: "Select a valid subgroup for this assessment." },
          { status: 400 },
        );
      }
      const minP = Math.max(0, a.min_prompt_chars);
      const minO = Math.max(0, a.min_output_chars);
      if (prompt.length < minP) {
        return Response.json(
          {
            error: `Architecture prompt is too short (need at least ${minP} characters).`,
          },
          { status: 400 },
        );
      }
      if (output.length < minO) {
        return Response.json(
          {
            error: `Architecture output is too short — include all key sections (need at least ${minO} characters).`,
          },
          { status: 400 },
        );
      }
      assessmentId = a.id;
      rubricPrompt = buildAssessmentRubricPrompt(
        {
          assessmentTitle: a.title,
          facilitatorInstructions: a.grader_instructions,
          facilitatorIntro: a.assessment_intro?.trim()
            ? a.assessment_intro
            : undefined,
        },
        name,
        subgroup,
        clipped.promptForModel,
        clipped.outputForModel,
      );
    } else {
      if (!QAF_COHORT_SUBGROUPS.includes(subgroup)) {
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
      rubricPrompt = buildFoundryRubricPrompt(
        name,
        subgroup,
        clipped.promptForModel,
        clipped.outputForModel,
      );
    }

    let graded: Awaited<ReturnType<typeof runFoundryGradeWithFallbacks>>;
    try {
      graded = await runFoundryGradeWithFallbacks({
        userContent: rubricPrompt,
        maxTokens: GRADE_MAX_TOKENS,
      });
    } catch (llmErr) {
      const msg =
        llmErr instanceof Error ? llmErr.message : "Grading model error.";
      console.error("[foundry/grade] all providers failed", llmErr);

      if (gradeFailureLooksLikeTokenLimit(msg)) {
        return Response.json(
          {
            error:
              "The grading services rejected this attempt because it was too large for available AI quotas or context limits (or rate limits piled up). Shorten what you paste in the prompt and architecture output — keep headings and representative bullets — then submit again.",
            code: "grade_prompt_quota_exceeded",
            hint:
              "Facilitators can lower paste guidance, tighten FOUNDRY_GRADE_MAX_OUTPUT_CHARS / FOUNDRY_GRADE_MAX_PROMPT_CHARS, or use FOUNDRY_GRADING_PROVIDER_ORDER to prefer a larger-context model.",
            detail: msg.slice(0, 1600),
          },
          { status: 503 },
        );
      }

      return Response.json({ error: msg }, { status: 502 });
    }

    const raw = graded.content;
    let parsed: Record<string, unknown>;
    try {
      parsed = parseGraderJson(raw);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Invalid JSON from model.";
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
      assessmentId,
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
      gradingProvider: graded.meta.provider,
      gradingModel: graded.meta.model,
      gradingFallbackTrail: graded.errors ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Grading failed.";
    console.error("[foundry/grade]", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
