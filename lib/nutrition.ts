import type { ActivityLevel, Goal, MacroTargets, Profile } from "./types";

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENT: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: 400,
};

/** Mifflin-St Jeor equation for Basal Metabolic Rate (kcal/day). */
export function bmr(profile: Profile): number {
  const { weightKg, heightCm, age, sex } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (sex === "male" ? 5 : -161));
}

/** Total Daily Energy Expenditure (kcal/day). */
export function tdee(profile: Profile): number {
  return Math.round(bmr(profile) * ACTIVITY_MULTIPLIER[profile.activity]);
}

/** Target daily calories based on the user's goal. */
export function targetKcal(profile: Profile): number {
  const t = tdee(profile) + GOAL_ADJUSTMENT[profile.goal];
  return Math.max(1200, Math.round(t));
}

/**
 * Split target calories into macros.
 * - Lose: higher protein to preserve lean mass
 * - Gain: higher carbs to fuel training
 * - Maintain: balanced
 */
export function macroTargets(profile: Profile): MacroTargets {
  const kcal = targetKcal(profile);

  let pPct = 0.3;
  let cPct = 0.4;
  let fPct = 0.3;

  if (profile.goal === "lose") {
    pPct = 0.35;
    cPct = 0.35;
    fPct = 0.3;
  } else if (profile.goal === "gain") {
    pPct = 0.25;
    cPct = 0.5;
    fPct = 0.25;
  }

  return {
    kcal,
    protein: Math.round((kcal * pPct) / 4),
    carbs: Math.round((kcal * cPct) / 4),
    fat: Math.round((kcal * fPct) / 9),
  };
}

export function goalLabel(goal: Goal): string {
  switch (goal) {
    case "lose":
      return "Lose Weight";
    case "gain":
      return "Gain Weight";
    case "maintain":
      return "Maintain Weight";
  }
}

export function activityLabel(a: ActivityLevel): string {
  return {
    sedentary: "Sedentary (little to no exercise)",
    light: "Light (1-3 days/week)",
    moderate: "Moderate (3-5 days/week)",
    active: "Active (6-7 days/week)",
    very_active: "Very active (twice daily / physical job)",
  }[a];
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
