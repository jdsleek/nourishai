/** Shown on class hub and deck when facilitator leaves checklist empty. */
export const DEFAULT_LEARNER_PROGRESS_CHECKLIST: readonly string[] = [
  "Open the facilitator’s official link (/learn/… or /foundry/deck/…) so you hit the live deck, not an old copy.",
  "Pick the right subgroup before you submit — it’s stored with your grade.",
  "Paste your full AI prompt verbatim (what you actually sent), not a summary.",
  "Paste the model’s complete output you want graded, not a short excerpt.",
];

export function learnerChecklistFromRows(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [...DEFAULT_LEARNER_PROGRESS_CHECKLIST];
  const t = rows
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .map((s) => s.slice(0, 500))
    .slice(0, 12);
  return t.length > 0 ? t : [...DEFAULT_LEARNER_PROGRESS_CHECKLIST];
}

export function sanitizeLevelUpUrl(raw: string): string {
  const t = raw.trim().slice(0, 2048);
  if (!t) return "";
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

export function sanitizeStudentChecklistInput(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .map((s) => s.slice(0, 400))
    .slice(0, 12);
}
