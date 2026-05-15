/**
 * Qubators Day 03 — AI Builder foundry grader (shared by /api/foundry/grade).
 */

export type FoundryGradeResult = {
  total_score: number;
  grade: "GO" | "REVIEW" | "REBUILD";
  breakdown: {
    prompt_quality: { score: number; feedback: string };
    architecture_viability: { score: number; feedback: string };
    environment_setup: { score: number; feedback: string };
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

Note: No separate workspace/IDE verification field is collected. Infer any tooling or environment signals only from explicit text in the PROMPT or OUTPUT below.

ARCHITECTURE PROMPT SUBMITTED:
${prompt}

AI-GENERATED ARCHITECTURE OUTPUT:
${output}

---
RUBRIC (total 100 points):

1. PROMPT QUALITY (40 points):
   Role defined clearly (8 pts)
   Task clearly stated (8 pts)
   Context provided — who is the audience and what is being built (8 pts)
   Constraints mentioned — technical, cost, integration limits (8 pts)
   Output Format specified — what the AI should return (8 pts)

2. ARCHITECTURE VIABILITY (40 points):
   Frontend stack is named and justified (10 pts)
   Backend logic / API design described (10 pts)
   Database schema or data model present (10 pts)
   Data flow or user journey from A to B is clear (10 pts)

3. ENVIRONMENT SETUP (20 points):
   Workspace description is not submitted this term. Score this category only from explicit mentions of IDE/tooling/local dev in the PROMPT or ARCHITECTURE OUTPUT (e.g. Cursor, VS Code, npm, localhost). If neither document mentions tooling, cap at 8/20 and state that environment was not evidenced in the submission.

Grade thresholds: GO = 75-100 | REVIEW = 50-74 | REBUILD = 0-49

If the model output is too short to judge architecture, cap ARCHITECTURE VIABILITY at 15/40 and mention that in feedback.

Return this exact JSON structure with no extra text:
{
  "total_score": <integer 0-100>,
  "grade": "<GO or REVIEW or REBUILD>",
  "breakdown": {
    "prompt_quality": { "score": <integer 0-40>, "feedback": "<one crisp sentence>" },
    "architecture_viability": { "score": <integer 0-40>, "feedback": "<one crisp sentence>" },
    "environment_setup": { "score": <integer 0-20>, "feedback": "<one crisp sentence>" }
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

export function normalizeGraderResult(obj: Record<string, unknown>): FoundryGradeResult {
  const g = String(obj.grade || "").toUpperCase();
  const grade = (["GO", "REVIEW", "REBUILD"].includes(g) ? g : "REVIEW") as
    | "GO"
    | "REVIEW"
    | "REBUILD";
  const total = Math.max(
    0,
    Math.min(100, parseInt(String(obj.total_score), 10) || 0)
  );
  const b = (obj.breakdown || {}) as Record<string, unknown>;
  const pq = (b.prompt_quality || {}) as Record<string, unknown>;
  const av = (b.architecture_viability || {}) as Record<string, unknown>;
  const es = (b.environment_setup || {}) as Record<string, unknown>;
  return {
    total_score: total,
    grade,
    breakdown: {
      prompt_quality: {
        score: Math.max(0, Math.min(40, parseInt(String(pq.score), 10) || 0)),
        feedback: String(pq.feedback || ""),
      },
      architecture_viability: {
        score: Math.max(0, Math.min(40, parseInt(String(av.score), 10) || 0)),
        feedback: String(av.feedback || ""),
      },
      environment_setup: {
        score: Math.max(0, Math.min(20, parseInt(String(es.score), 10) || 0)),
        feedback: String(es.feedback || ""),
      },
    },
    level_up_tip: String(
      obj.level_up_tip ||
        "Add explicit Role and Constraints lines so the grader can award full pillar points."
    ),
    verdict: String(obj.verdict || ""),
  };
}
