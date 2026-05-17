/**
 * Learner submit-portal wording (deck portal in public/day03-ai-builder.html).
 * Facilitators store partial overrides in Postgres `portal_form_copy` JSONB; we merge onto these defaults.
 */

export type PortalFormStep = {
  label: string;
  hint: string;
  placeholder: string;
  fieldError: string;
};

export type PortalFormMerged = {
  name: PortalFormStep;
  subgroup: PortalFormStep;
  prompt: PortalFormStep;
  output: PortalFormStep;
};

export const STEPS_KEYS = ["name", "subgroup", "prompt", "output"] as const;
export type PortalFormStepKey = (typeof STEPS_KEYS)[number];

/** Baseline wording (architecture Day 03 style). Facilitators can replace entirely per cohort. */
export const DEFAULT_PORTAL_FORM: PortalFormMerged = {
  name: {
    label: "01 · Fellow / student name",
    hint: "Fellow name · your full name as used on the roster.",
    placeholder: "Your full name",
    fieldError: "Enter your fellow name and full name.",
  },
  subgroup: {
    label: "02 · Subgroup",
    hint: "Pick the subgroup your facilitator assigned (often the same as on signup or ideation forms).",
    placeholder: "",
    fieldError: "Select your subgroup from the dropdown.",
  },
  prompt: {
    label: "03 · Your architecture prompt",
    hint:
      "Paste the exact prompt you sent. The grader looks for five labeled sections: Role, Task, Context, Constraints, Output Format (headings or bullet labels both count).",
    placeholder:
      "Role: You are a senior full-stack architect for early-stage products in Nigeria.\n\nTask: Design a complete system for...\n\nContext: I am building... for... (audience, region, constraints on users)...\n\nConstraints: Free-tier only, must integrate with..., no paid X unless...\n\nOutput Format: Return sections: Frontend Stack, Backend API, Database Schema, Data Flow (with headings).",
    fieldError: "Paste your full prompt.",
  },
  output: {
    label: "04 · AI-generated architecture output",
    hint:
      "Paste the model’s answer, at minimum the parts that cover Frontend, Backend/API, Database, and Data flow. Longer excerpts score more reliably than two vague sentences.",
    placeholder:
      "### Frontend Stack\n...\n\n### Backend API\n...\n\n### Database Schema\n...\n\n### Data Flow\n...",
    fieldError: "Paste enough output for Frontend, Backend/API, Database, and Data flow.",
  },
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function mergeStep(defaults: PortalFormStep, patch: unknown): PortalFormStep {
  if (!isRecord(patch)) return { ...defaults };
  const feCandidate =
    patch.fieldError !== undefined ? patch.fieldError : patch.err;

  const label =
    patch.label != null && String(patch.label).trim().length > 0
      ? String(patch.label).trim()
      : defaults.label;

  const hint =
    patch.hint != null && String(patch.hint).trim().length > 0
      ? String(patch.hint).trim()
      : defaults.hint;

  const placeholder =
    patch.placeholder !== undefined && patch.placeholder !== null
      ? String(patch.placeholder).trim() === ""
        ? defaults.placeholder
        : String(patch.placeholder)
      : defaults.placeholder;

  const fieldError =
    feCandidate != null && String(feCandidate).trim().length > 0
      ? String(feCandidate).trim()
      : defaults.fieldError;

  return {
    label,
    hint,
    placeholder,
    fieldError,
  };
}

/** Normalize partial JSON from DB and merge onto DEFAULT_PORTAL_FORM. */
export function mergePortalForm(dbPatch: unknown): PortalFormMerged {
  const p = isRecord(dbPatch) ? dbPatch : {};
  return {
    name: mergeStep(DEFAULT_PORTAL_FORM.name, p.name),
    subgroup: mergeStep(DEFAULT_PORTAL_FORM.subgroup, p.subgroup),
    prompt: mergeStep(DEFAULT_PORTAL_FORM.prompt, p.prompt),
    output: mergeStep(DEFAULT_PORTAL_FORM.output, p.output),
  };
}
