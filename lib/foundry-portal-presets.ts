import { mergePortalForm, type PortalFormMerged } from "./foundry-portal-form";

/** Client-only portal wording starters; merged onto defaults. */
export function portalFormFromTemplate(id: string): PortalFormMerged {
  if (id === "minimal") {
    return mergePortalForm({
      prompt: {
        label: "03 · Your prompt",
        hint: "Paste the exact instructions you gave the assistant—no summarizing.",
        placeholder: "",
      },
      output: {
        label: "04 · Model output",
        hint: "Paste the full reply you want graded.",
        placeholder: "",
      },
    });
  }
  if (id === "open") {
    return mergePortalForm({
      prompt: {
        label: "03 · Your work (part 1)",
        hint: "Paste the first artifact your facilitator asked for (prompt, draft, notes, etc.).",
        placeholder: "",
      },
      output: {
        label: "04 · Your work (part 2)",
        hint: "Paste the second part if required; otherwise add any extra context here.",
        placeholder: "",
      },
    });
  }
  return mergePortalForm({});
}

export const PORTAL_TEMPLATE_OPTIONS = [
  { id: "day03", label: "Default (Day 03 style)" },
  { id: "minimal", label: "Minimal labels" },
  { id: "open", label: "Open-ended two-field" },
] as const;
