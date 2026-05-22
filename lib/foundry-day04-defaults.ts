import { mergePortalForm, type PortalFormMerged } from "./foundry-portal-form";
import type { PortalExtraAnswerSlot } from "./foundry-portal-extras";

export const DAY04_ASSESSMENT_SLUG = "qaf-day04-idea-to-product";

export const DAY04_ASSESSMENT_TITLE = "Day 04 · From Idea to Working Product";

export const DAY04_PORTAL_PATCH: Partial<PortalFormMerged> = {
  prompt: {
    label: "03 · Frontend build prompt (5 pillars)",
    hint: "Paste the exact Cursor prompt used to generate index.html (Role, Task, Context, Constraints, Format).",
    placeholder:
      "Role: Senior product UI engineer...\nTask: One index.html + embedded CSS for...\nContext: [your QAF idea]...\nConstraints: mobile-first, single file, no frameworks...\nFormat: Hero / Main / Footer + hook ids for app.js",
    fieldError: "Paste your full frontend prompt.",
  },
  output: {
    label: "04 · app.js + data logic (paste key parts)",
    hint: "Paste your app.js (save/load, primary button, render list/insights). Say what happens after refresh.",
    placeholder:
      "// loadData / saveData / renderList / renderInsights\n// btn-primary click handler\n// localStorage key: ...",
    fieldError: "Paste enough app.js to show persistence and the primary action.",
  },
};

export const DAY04_EXTRA_SLOTS: PortalExtraAnswerSlot[] = [
  {
    id: "demo",
    label: "05 · Live demo checklist",
    hint: "Confirm each line: YES or NO, then one sentence on what your primary button does.",
    placeholder:
      "1. Primary button works without DevTools only: YES/NO\n2. Added 2+ items: YES/NO\n3. Refresh keeps data: YES/NO\n4. Insights panel shows a stat: YES/NO or N/A\n5. On click, I store ___ and update ___.",
    required: true,
  },
  {
    id: "handoff",
    label: "06 · HTML hooks (ids you used)",
    hint: "List ids: btn-primary, inputs, list-root, insights-panel.",
    placeholder: "btn-primary, input-name, list-root, insights-panel",
    required: false,
  },
];

export const DAY04_STUDENT_CHECKLIST = [
  "index.html opens in browser with your product name visible",
  "app.js linked; primary button saves and re-renders a list",
  "Refresh browser — data still visible",
  "Paste frontend prompt + app.js + demo checklist before you leave",
];

export const DAY04_GRADER_INSTRUCTIONS = [
  "Grade Day 04 MVP submission. Return JSON only with keys: total_score (0-20), grade (GO|REVIEW|REBUILD), breakdown.prompt_quality (/10), breakdown.architecture_viability (/10), level_up_tip, verdict.",
  "",
  "Map categories:",
  "- prompt_quality (/10) = UI craft: mobile-readable layout, clear primary CTA, matches their product idea, not generic AI template slop.",
  "- architecture_viability (/10) = Backend logic: primary button saves data (localStorage or equivalent), list/panel updates, refresh persists, data-driven ideas show at least one computed insight.",
  "",
  "GO >= 15, REVIEW 10-14, REBUILD < 9.",
  "Cap architecture_viability at 4/10 if no persistence or button does nothing.",
  "Address student by first name in verdict.",
].join("\n");

export const DAY04_ASSESSMENT_INTRO = [
  "Day 04 · From Idea to Working Product",
  "",
  "Submit your frontend prompt + app.js when your demo works: button saves, list updates, refresh keeps data.",
].join("\n");

export function day04PortalFormMerged() {
  return mergePortalForm(DAY04_PORTAL_PATCH);
}

export function day04AssessmentConfigPayload() {
  return {
    slug: DAY04_ASSESSMENT_SLUG,
    title: DAY04_ASSESSMENT_TITLE,
    intro: DAY04_ASSESSMENT_INTRO,
    subgroups: [] as string[],
    minPromptChars: 40,
    minOutputChars: 60,
    submissionsOpen: true,
    studentChecklist: DAY04_STUDENT_CHECKLIST,
    levelUpUrl: null as string | null,
    portalForm: day04PortalFormMerged(),
    extraAnswerSlots: DAY04_EXTRA_SLOTS,
    deck: "day04" as const,
  };
}

export function isDay04AssessmentSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  const s = slug.trim().toLowerCase();
  return s === DAY04_ASSESSMENT_SLUG || s.includes("day04");
}
