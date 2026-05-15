"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import FoodSearch from "@/components/FoodSearch";
import MacroBar from "@/components/MacroBar";
import { useFoodStore, entriesForDate, sumEntries } from "@/lib/store";
import { macroTargets, todayISO } from "@/lib/nutrition";
import type { Food, FoodEntry } from "@/lib/types";

type Meal = FoodEntry["meal"];
const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

export default function TrackerPage() {
  const profile = useFoodStore((s) => s.profile);
  const entries = useFoodStore((s) => s.foodEntries);
  const addEntry = useFoodStore((s) => s.addFoodEntry);
  const removeEntry = useFoodStore((s) => s.removeFoodEntry);

  const [date, setDate] = useState<string>(todayISO());
  const [pending, setPending] = useState<{
    food: Food;
    grams: number;
    meal: Meal;
  } | null>(null);

  const dayEntries = useMemo(
    () => entriesForDate(entries, date),
    [entries, date]
  );
  const totals = sumEntries(dayEntries);
  const targets = profile ? macroTargets(profile) : null;

  function logEntry() {
    if (!pending) return;
    const { food, grams, meal } = pending;
    const ratio = grams / 100;
    const entry: FoodEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date,
      foodId: food.id,
      foodName: food.name,
      grams,
      kcal: food.kcal * ratio,
      protein: food.protein * ratio,
      carbs: food.carbs * ratio,
      fat: food.fat * ratio,
      meal,
    };
    addEntry(entry);
    setPending(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Food tracker</h1>
          <p className="mt-1 text-sm text-stone-500">
            Log what you eat. We calculate the macros for you.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {!profile && (
        <div className="card border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          <strong>Set up your profile first</strong> so we can show you a target
          to aim for.{" "}
          <Link href="/profile" className="underline">
            Go to profile →
          </Link>
        </div>
      )}

      {targets && (
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold">Today's totals</h2>
          <MacroBar
            label="Calories"
            current={totals.kcal}
            target={targets.kcal}
            unit=" kcal"
            colorClass="bg-brand-500"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <MacroBar
              label="Protein"
              current={totals.protein}
              target={targets.protein}
              colorClass="bg-blue-500"
            />
            <MacroBar
              label="Carbs"
              current={totals.carbs}
              target={targets.carbs}
              colorClass="bg-amber-500"
            />
            <MacroBar
              label="Fat"
              current={totals.fat}
              target={targets.fat}
              colorClass="bg-rose-500"
            />
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="text-lg font-semibold">Add food</h2>
        <div className="mt-3">
          <FoodSearch onPick={(f) => setPending({ food: f, grams: 100, meal: "breakfast" })} />
        </div>

        {pending && (
          <div className="mt-4 grid gap-3 rounded-xl border border-stone-200 p-4 dark:border-stone-700 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <div className="text-sm text-stone-500">Food</div>
              <div className="font-semibold">{pending.food.name}</div>
              <div className="mt-1 text-xs text-stone-500 tabular-nums">
                {Math.round((pending.food.kcal * pending.grams) / 100)} kcal ·
                P {Math.round((pending.food.protein * pending.grams) / 100)}g ·
                C {Math.round((pending.food.carbs * pending.grams) / 100)}g ·
                F {Math.round((pending.food.fat * pending.grams) / 100)}g
              </div>
            </div>
            <div>
              <label className="label">Grams</label>
              <input
                type="number"
                min={1}
                className="input"
                value={pending.grams}
                onChange={(e) =>
                  setPending({ ...pending, grams: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="label">Meal</label>
              <select
                className="input"
                value={pending.meal}
                onChange={(e) =>
                  setPending({ ...pending, meal: e.target.value as Meal })
                }
              >
                {MEALS.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 sm:col-span-4">
              <button onClick={logEntry} className="btn-primary">
                Add to log
              </button>
              <button
                onClick={() => setPending(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        {MEALS.map((meal) => {
          const mealEntries = dayEntries.filter((e) => e.meal === meal);
          if (mealEntries.length === 0) return null;
          const mealTotals = sumEntries(mealEntries);
          return (
            <div key={meal} className="card">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold capitalize">{meal}</h3>
                <span className="text-sm text-stone-500 tabular-nums">
                  {Math.round(mealTotals.kcal)} kcal
                </span>
              </div>
              <ul className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
                {mealEntries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">{e.foodName}</div>
                      <div className="text-xs text-stone-500 tabular-nums">
                        {Math.round(e.grams)}g · {Math.round(e.kcal)} kcal · P{" "}
                        {Math.round(e.protein)}g · C {Math.round(e.carbs)}g · F{" "}
                        {Math.round(e.fat)}g
                      </div>
                    </div>
                    <button
                      onClick={() => removeEntry(e.id)}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {dayEntries.length === 0 && (
          <div className="card text-center text-sm text-stone-500">
            No food logged for this day yet. Search and add something above.
          </div>
        )}
      </section>
    </div>
  );
}
