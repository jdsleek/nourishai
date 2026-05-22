import { NextRequest } from "next/server";
import {
  gradeFailureLooksLikeTokenLimit,
  runFoundryGradeWithFallbacks,
} from "@/lib/foundry-grading-llm";
import {
  buildAssessmentRubricPrompt,
  buildDay04RubricPrompt,
  buildFoundryRubricPrompt,
  normalizeGraderResult,
  parseGraderJson,
} from "@/lib/foundry-grade";
import {
  DAY04_EXTRA_SLOTS,
  isDay04AssessmentSlug,
} from "@/lib/foundry-day04-defaults";
import { clipFoundryBodiesForGroq } from "@/lib/foundry-grade-clip";
import { insertFoundryLlmUsageEvent } from "@/lib/foundry-llm-usage";
import { ensureFoundrySubmissionsSchema, getFoundryPgPool } from "@/lib/foundry-pg";
import { QAF_COHORT_SUBGROUPS } from "@/lib/foundry-subgroups";
import { appendFoundrySubmission } from "@/lib/foundry-store";
import type { PortalExtraAnswerSlot } from "@/lib/foundry-portal-extras";
import { readPortalExtraSlots } from "@/lib/foundry-portal-extras";
import { pgAssessmentBySlug, type TrainingAssessmentRow } from "@/lib/training-pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const GRADE_MAX_TOKENS = 1400;

const EXTRA_ANSWER_MAX_PER_FIELD_CHARS = 16_000;
const EXTRA_BLOCK_MAX_FOR_MODEL_CHARS = 14_000;

function coerceExtraAnswersMap(
  raw: unknown,
  allowedIds: ReadonlySet<string>,
): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    const id = String(k || "").trim();
    if (!id || !allowedIds.has(id)) continue;
    out[id] = String(v ?? "").trim().slice(0, EXTRA_ANSWER_MAX_PER_FIELD_CHARS);
  }
  return out;
}

function validateRequiredExtras(
  slots: PortalExtraAnswerSlot[],
  map: Record<string, string>,
): string | null {
  for (const s of slots) {
    if (!s.required) continue;
    if (!(map[s.id] ?? "").trim()) return `Please complete: ${s.label}`;
  }
  return null;
}

function formatExtraAnswersForGrader(
  slots: PortalExtraAnswerSlot[],
  map: Record<string, string>,
): string {
  const parts: string[] = [];
  for (const s of slots) {
    const t = (map[s.id] ?? "").trim();
    if (!t) continue;
    parts.push(`${s.label}:\n${t}`);
  }
  return parts.join("\n\n");
}

type Body = {
  name?: string;
  subgroup?: string;
  prompt?: string;
  output?: string;
  /** When set, loads facilitator rubric from Postgres and stores `assessment_id` on the row. */
  assessmentSlug?: string;
  /** Keys are slot ids from facilitator extra_answer_slots config */
  extraAnswers?: unknown;
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
    let promptForPersistence = prompt;
    let assessmentId: string | null = null;
    let rubricPrompt: string;

    const pool = getFoundryPgPool();
    let facilitatorAssessment: TrainingAssessmentRow | null = null;
    const isDay04Slug = slugRaw ? isDay04AssessmentSlug(slugRaw) : false;

    if (slugRaw) {
      if (pool) {
        await ensureFoundrySubmissionsSchema(pool);
        facilitatorAssessment = await pgAssessmentBySlug(pool, slugRaw);
      }
      if (!facilitatorAssessment && !isDay04Slug) {
        if (!pool) {
          return Response.json(
            {
              error:
                "This assessment is not available right now. Try again later or contact your facilitator.",
            },
            { status: 503 },
          );
        }
        return Response.json({ error: "Unknown assessment." }, { status: 404 });
      }
    }

    if (facilitatorAssessment) {
      const a = facilitatorAssessment;
      if (!a.submissions_open) {
        return Response.json(
          {
            error:
              "This assessment is closed for new submissions. Contact your facilitator if you need help.",
            code: "assessment_submissions_closed",
          },
          { status: 403 },
        );
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

      const extraSlots = readPortalExtraSlots(a.portal_form_copy);
      const extrasMap =
        extraSlots.length > 0
          ? coerceExtraAnswersMap(
              body.extraAnswers,
              new Set(extraSlots.map((s) => s.id)),
            )
          : {};

      const extraErr =
        extraSlots.length > 0 ? validateRequiredExtras(extraSlots, extrasMap) : null;
      if (extraErr) {
        return Response.json({ error: extraErr }, { status: 400 });
      }

      const extraMarkdown =
        extraSlots.length > 0 ? formatExtraAnswersForGrader(extraSlots, extrasMap) : "";

      if (extraMarkdown.trim()) {
        promptForPersistence = `${prompt}\n\n--- Extra learner answers ---\n${extraMarkdown}`;
      }

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
        extraMarkdown.trim()
          ? extraMarkdown.slice(0, EXTRA_BLOCK_MAX_FOR_MODEL_CHARS)
          : undefined,
      );
    } else if (isDay04Slug) {
      if (!QAF_COHORT_SUBGROUPS.includes(subgroup)) {
        return Response.json(
          { error: "Select a valid subgroup from the list." },
          { status: 400 },
        );
      }
      const minP = 40;
      const minO = 60;
      if (prompt.length < minP) {
        return Response.json(
          { error: `Frontend prompt is too short (need at least ${minP} characters).` },
          { status: 400 },
        );
      }
      if (output.length < minO) {
        return Response.json(
          {
            error: `app.js excerpt is too short — include save/load and button logic (need at least ${minO} characters).`,
          },
          { status: 400 },
        );
      }

      const extraSlots = DAY04_EXTRA_SLOTS;
      const extrasMap = coerceExtraAnswersMap(
        body.extraAnswers,
        new Set(extraSlots.map((s) => s.id)),
      );
      const extraErr = validateRequiredExtras(extraSlots, extrasMap);
      if (extraErr) {
        return Response.json({ error: extraErr }, { status: 400 });
      }

      const extraMarkdown = formatExtraAnswersForGrader(extraSlots, extrasMap);
      if (extraMarkdown.trim()) {
        promptForPersistence = `${prompt}\n\n--- Extra learner answers ---\n${extraMarkdown}`;
      }

      rubricPrompt = buildDay04RubricPrompt(
        name,
        subgroup,
        clipped.promptForModel,
        clipped.outputForModel,
        extraMarkdown.trim()
          ? extraMarkdown.slice(0, EXTRA_BLOCK_MAX_FOR_MODEL_CHARS)
          : undefined,
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
      prompt: promptForPersistence,
      output,
      result,
      assessmentId,
    };

    let persisted = false;
    let saved: { id: string; submittedAt: string } | null = null;
    const delays = [0, 250, 600];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
      try {
        const rec = await appendFoundrySubmission(entry);
        persisted = true;
        saved = { id: rec.id, submittedAt: rec.submittedAt };
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

    if (pool) {
      try {
        await insertFoundryLlmUsageEvent(pool, {
          source: "grading",
          provider: graded.meta.provider,
          model: graded.meta.model,
          promptTokens: graded.meta.usage.promptTokens,
          completionTokens: graded.meta.usage.completionTokens,
          totalTokens: graded.meta.usage.totalTokens,
          submissionId: saved?.id ?? null,
          estimated: false,
        });
      } catch (usageErr) {
        console.error("[foundry/grade] metering insert failed", usageErr);
      }
    }

    return Response.json({
      ok: true,
      result,
      persisted,
      submissionId: saved?.id ?? null,
      submittedAt: saved?.submittedAt ?? null,
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
