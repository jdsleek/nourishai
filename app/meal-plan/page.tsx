"use client";

import { useState } from "react";
import Link from "next/link";
import { useFoodStore } from "@/lib/store";
import { macroTargets } from "@/lib/nutrition";
import type { DayPlan, Meal, MealPlan } from "@/lib/types";

export default function MealPlanPage() {
  const profile = useFoodStore((s) => s.profile);
  const mealPlan = useFoodStore((s) => s.mealPlan);
  const setMealPlan = useFoodStore((s) => s.setMealPlan);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets = profile ? macroTargets(profile) : null;

  async function generate() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mealplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate plan");
      setMealPlan(data as MealPlan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!profile) {
    return (
      <div className="card">
        <h1 className="text-2xl font-bold">7-day AI meal plan</h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          Set up your profile first so we can tailor the plan to your goals.
        </p>
        <Link href="/profile" className="btn-primary mt-4">
          Go to profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">7-day AI meal plan</h1>
          <p className="mt-1 text-sm text-stone-500">
            Tailored to your profile, goal, and dietary preferences.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generate}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Generating…" : mealPlan ? "Regenerate" : "Generate plan"}
          </button>
          {mealPlan && (
            <button
              onClick={() => setMealPlan(null)}
              className="btn-secondary"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {targets && (
        <div className="card">
          <div className="text-sm text-stone-500">Targets per day</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">
            {targets.kcal} kcal · {targets.protein}g P · {targets.carbs}g C ·{" "}
            {targets.fat}g F
          </div>
        </div>
      )}

      {error && (
        <div className="card border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-200">
          <strong>Couldn't generate a plan.</strong>
          <div className="mt-1 text-sm">{error}</div>
          <div className="mt-2 text-xs">
            Tip: make sure your <code>ANTHROPIC_API_KEY</code> is set in
            <code> food-app/.env.local</code>, then restart the dev server.
          </div>
        </div>
      )}

      {loading && !mealPlan && (
        <div className="card grid place-items-center py-16 text-stone-500">
          <div className="animate-pulse">Cooking up your plan…</div>
        </div>
      )}

      {mealPlan && (
        <div className="space-y-6">
          {(mealPlan.days as DayPlan[]).map((day) => (
            <DayCard key={day.day} day={day} />
          ))}
        </div>
      )}

      {!mealPlan && !loading && (
        <div className="card text-center text-stone-500">
          Click <b>Generate plan</b> to build your personalized week of meals.
        </div>
      )}
    </div>
  );
}

function DayCard({ day }: { day: DayPlan }) {
  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">
          Day {day.day} <span className="text-stone-400">· {day.label}</span>
        </h2>
        <span className="pill tabular-nums">
          {Math.round(day.totals.kcal)} kcal · {Math.round(day.totals.protein)}g P
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MealCard label="Breakfast" meal={day.breakfast} />
        <MealCard label="Lunch" meal={day.lunch} />
        <MealCard label="Dinner" meal={day.dinner} />
        <MealCard label="Snack" meal={day.snack} />
      </div>
    </div>
  );
}

function MealCard({ label, meal }: { label: string; meal: Meal }) {
  return (
    <div className="rounded-xl border border-stone-200 p-4 dark:border-stone-700">
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-brand-700 dark:text-brand-300">
          {label}
        </div>
        <div className="text-xs text-stone-500 tabular-nums">
          {Math.round(meal.kcal)} kcal
        </div>
      </div>
      <div className="mt-1 font-semibold">{meal.name}</div>
      <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
        {meal.description}
      </p>
      <div className="mt-2 text-xs text-stone-500 tabular-nums">
        P {Math.round(meal.protein)}g · C {Math.round(meal.carbs)}g · F{" "}
        {Math.round(meal.fat)}g
      </div>
      {meal.ingredients?.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-xs text-stone-600 dark:text-stone-400">
          {meal.ingredients.map((ing, i) => (
            <li key={i}>{ing}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
