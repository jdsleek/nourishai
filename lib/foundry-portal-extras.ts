import { mergePortalForm, type PortalFormMerged } from "./foundry-portal-form";

export type PortalExtraAnswerSlot = {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  /** Learner cannot submit with empty when true */
  required?: boolean;
};

const EXTRA_KEY = "extra_answer_slots";

export const MAX_PORTAL_EXTRA_ANSWER_SLOTS = 6;

export function sanitizePortalExtraSlots(raw: unknown): PortalExtraAnswerSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: PortalExtraAnswerSlot[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null || out.length >= MAX_PORTAL_EXTRA_ANSWER_SLOTS)
      continue;
    const o = item as Record<string, unknown>;
    const label = String(o.label ?? "").trim();
    if (!label) continue;
    const idRaw = String(o.id ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    const id =
      idRaw.length >= 2
        ? idRaw.slice(0, 40)
        : `x${Math.random().toString(36).slice(2, 10)}`;
    out.push({
      id,
      label: label.slice(0, 200),
      hint: String(o.hint ?? "").trim().slice(0, 600),
      placeholder: String(o.placeholder ?? "").trim().slice(0, 2000),
      required: o.required === true,
    });
  }
  return out;
}

export function readPortalExtraSlots(copy: Record<string, unknown>): PortalExtraAnswerSlot[] {
  return sanitizePortalExtraSlots(copy[EXTRA_KEY]);
}

/**
 * JSONB blob: merged portal steps + optional extra long-answer definitions.
 */
export function persistPortalFormCopy(
  portalFormInput: unknown,
  extraSlotsExplicit: unknown | undefined,
  preserveExtrasWhenUnset: PortalExtraAnswerSlot[] | undefined,
): Record<string, unknown> {
  const merged = mergePortalForm(portalFormInput ?? {}) as PortalFormMerged;
  const blob: Record<string, unknown> = {
    name: merged.name,
    subgroup: merged.subgroup,
    prompt: merged.prompt,
    output: merged.output,
  };
  const slots =
    extraSlotsExplicit !== undefined
      ? sanitizePortalExtraSlots(extraSlotsExplicit)
      : sanitizePortalExtraSlots(preserveExtrasWhenUnset ?? []);
  if (slots.length) blob[EXTRA_KEY] = slots;
  return blob;
}

/** Partial PATCH merge — keeps extras unless client sends extraAnswerSlots explicitly. */
export function mergeAssessmentPortalBlobForPatch(opts: {
  previousCopy: Record<string, unknown>;
  portalFormPatch?: unknown;
  extraSlotsPatch?: unknown;
}): Record<string, unknown> {
  const prevExtras = readPortalExtraSlots(opts.previousCopy);
  const stepSeed =
    opts.portalFormPatch !== undefined ? opts.portalFormPatch : opts.previousCopy;
  return persistPortalFormCopy(
    stepSeed,
    opts.extraSlotsPatch !== undefined ? opts.extraSlotsPatch : undefined,
    opts.extraSlotsPatch !== undefined ? undefined : prevExtras,
  );
}
