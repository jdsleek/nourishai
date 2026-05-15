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
