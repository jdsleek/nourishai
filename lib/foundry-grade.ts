/**
 * Qubators Day 03 — AI Builder foundry grader (shared by /api/foundry/grade).
 */

export type FoundryGradeResult = {
  total_score: number;
  grade: "GO" | "REVIEW" | "REBUILD";
  breakdown: {
    prompt_quality: { score: number; feedback: string };
    architecture_viability: { score: number; feedback: string };
  };
  level_up_tip: string;
  verdict: string;
};

export function buildFoundryRubricPrompt(
  name: string,
  subgroup: string,
  prompt: string,
  output: string
): string {
  return `You are the Senior AI Architect Grader for Qubators AI Foundry, Day 03 "The AI Builder."

Evaluate the student submission below against the Foundry Rubric. Return ONLY valid JSON — no markdown code fences, no preamble, no explanation outside the JSON object.

FELLOW NAME: ${name}

SUBGROUP: ${subgroup}

ARCHITECTURE PROMPT SUBMITTED:
${prompt}

AI-GENERATED ARCHITECTURE OUTPUT:
${output}

---
RUBRIC (total 20 points — two categories only):

1. PROMPT QUALITY (10 points total):
   Internally weigh the five pillars (Role, Task, Context, Constraints, Output format). Roughly ~2 pts each where each is clearly labeled and substantive — vague one-paragraph blobs lose marks.

2. ARCHITECTURE VIABILITY (10 points total):
   Internally weigh: frontend stack + justification (~2–3 pts), backend/API (~2–3 pts), database or data model (~2–3 pts), clear user data flow (~2–3 pts).

Grade thresholds (on the 20-point total): GO = 15–20 | REVIEW = 10–14 | REBUILD = 0–9

If the model architecture output is too short to judge, cap ARCHITECTURE VIABILITY at 4/10 and mention that in feedback.

Return this exact JSON structure with no extra text:
{
  "total_score": <integer 0-20>,
  "grade": "<GO or REVIEW or REBUILD>",
  "breakdown": {
    "prompt_quality": { "score": <integer 0-10>, "feedback": "<one crisp sentence>" },
    "architecture_viability": { "score": <integer 0-10>, "feedback": "<one crisp sentence>" }
  },
  "level_up_tip": "<one specific actionable tip to raise their score on the next attempt>",
  "verdict": "<2-3 sentences, firm but encouraging, addressing the student by first name>"
}`;
}

/** Day 04 — MVP build day (frontend prompt + app.js), not architecture. */
export function buildDay04RubricPrompt(
  name: string,
  subgroup: string,
  prompt: string,
  output: string,
  extraLearnerAnswers?: string,
): string {
  const addon = extraLearnerAnswers?.trim()
    ? `\n\nADDITIONAL LEARNER ANSWERS:\n${extraLearnerAnswers.trim()}\n`
    : "";

  return `You are the AI grading assistant for Qubators AI Foundry, Day 04 "From Idea to Working Product."

Evaluate the student MVP submission below. Return ONLY valid JSON — no markdown fences, no preamble.

FELLOW NAME: ${name}
SUBGROUP: ${subgroup}

FRONTEND BUILD PROMPT (field 03):
${prompt}

APP.JS / DATA LOGIC (field 04):
${output}${addon}

---
RUBRIC (total 20 points — two categories only):

1. PROMPT QUALITY (/10) — UI craft from their frontend prompt and described intent:
   Clear Role, Task, Context, Constraints, Format (~2 pts each). Product idea visible; mobile-first; not generic template slop.

2. ARCHITECTURE VIABILITY (/10) — rename mentally to BACKEND LOGIC in feedback:
   Primary button saves data (localStorage or equivalent); list or panel updates; refresh persists; optional insights/stat from stored rows.
   Cap at 4/10 if app.js is missing, too short to judge, or no persistence pattern.

Grade thresholds: GO = 15–20 | REVIEW = 10–14 | REBUILD = 0–9

Return this exact JSON structure:
{
  "total_score": <integer 0-20>,
  "grade": "<GO or REVIEW or REBUILD>",
  "breakdown": {
    "prompt_quality": { "score": <integer 0-10>, "feedback": "<one sentence on UI/prompt>" },
    "architecture_viability": { "score": <integer 0-10>, "feedback": "<one sentence on app.js/data logic>" }
  },
  "level_up_tip": "<one actionable tip>",
  "verdict": "<2-3 sentences, address student by first name>"
}`;
}

export type FacilitatorGradingBlock = {
  assessmentTitle: string;
  facilitatorInstructions: string;
  facilitatorIntro?: string;
};

/** Same JSON contract as the Foundry baseline; facilitator-authored rubric prose. */
export function buildAssessmentRubricPrompt(
  cfg: FacilitatorGradingBlock,
  name: string,
  subgroup: string,
  prompt: string,
  output: string,
  /** Optional · appended after main prompt for facilitator-defined bonus questions */
  extraLearnerAnswers?: string
): string {
  const intro = cfg.facilitatorIntro?.trim()
    ? `${cfg.facilitatorIntro.trim()}\n\n`
    : "";

  const body =
    cfg.facilitatorInstructions.trim() ||
    "(No facilitator rubric text — award marks fairly across prompt quality vs architecture viability, 10+10.)";

  const addon = extraLearnerAnswers?.trim()
    ? `\n\nADDITIONAL LEARNER ANSWERS (count toward completeness of their submission):\n${extraLearnerAnswers.trim()}\n`
    : "";

  return `You are the AI grading assistant for a facilitator-led training cohort.

Assessment: ${cfg.assessmentTitle}

${intro}FACILITATOR RUBRIC (primary grading authority — follow closely):
${body}

Submission to grade (return ONLY JSON per schema below — no markdown fences):

LEARNER NAME: ${name}
SUBGROUP: ${subgroup}

ARCHITECTURE PROMPT:
${prompt}

ARCHITECT OUTPUT:
${output}${addon}

Use two scored categories only (still 20 total): prompt_quality (/10), architecture_viability (/10).
Bands: GO 15–20, REVIEW 10–14, REBUILD 0–9.

JSON shape:
{
  "total_score": <0-20 int>,
  "grade": "<GO|REVIEW|REBUILD>",
  "breakdown": {
    "prompt_quality": { "score": <0-10>, "feedback": "<one sentence>" },
    "architecture_viability": { "score": <0-10>, "feedback": "<one sentence>" }
  },
  "level_up_tip": "<one actionable tip>",
  "verdict": "<2–3 sentences, use learner first name>"
}`;
}

export function parseGraderJson(raw: string): Record<string, unknown> {
  let s = raw.replace(/\uFEFF/g, "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("Model did not return JSON with { ... }");
  }
  return JSON.parse(s.slice(first, last + 1)) as Record<string, unknown>;
}

/** Map old 40-pt category scores onto the current /10 buckets. */
function scoreFromLegacy40(n: number): number {
  return Math.max(0, Math.min(10, Math.round((Math.min(40, Math.max(0, n)) / 40) * 10)));
}

export function normalizeGraderResult(obj: Record<string, unknown>): FoundryGradeResult {
  const b = (obj.breakdown || {}) as Record<string, unknown>;
  const pq = (b.prompt_quality || {}) as Record<string, unknown>;
  const av = (b.architecture_viability || {}) as Record<string, unknown>;
  const rawPq = parseInt(String(pq.score), 10) || 0;
  const rawAv = parseInt(String(av.score), 10) || 0;
  const hadLegacyEnvColumn =
    Object.prototype.hasOwnProperty.call(b, "environment_setup") &&
    b.environment_setup != null;
  const looksLegacyScale = hadLegacyEnvColumn || rawPq > 10 || rawAv > 10;
  const pqScore = looksLegacyScale ? scoreFromLegacy40(rawPq) : Math.max(0, Math.min(10, rawPq));
  const avScore = looksLegacyScale ? scoreFromLegacy40(rawAv) : Math.max(0, Math.min(10, rawAv));
  const totalAligned = Math.min(20, pqScore + avScore);
  const grade: "GO" | "REVIEW" | "REBUILD" =
    totalAligned >= 15 ? "GO" : totalAligned >= 10 ? "REVIEW" : "REBUILD";
  return {
    total_score: totalAligned,
    grade,
    breakdown: {
      prompt_quality: {
        score: pqScore,
        feedback: String(pq.feedback || ""),
      },
      architecture_viability: {
        score: avScore,
        feedback: String(av.feedback || ""),
      },
    },
    level_up_tip: String(
      obj.level_up_tip ||
        "Add explicit Role and Constraints lines so the grader can award full pillar points."
    ),
    verdict: String(obj.verdict || ""),
  };
}
