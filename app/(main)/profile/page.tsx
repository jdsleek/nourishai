"use client";

import { useEffect, useState } from "react";
import { useFoodStore } from "@/lib/store";
import {
  activityLabel,
  bmr,
  goalLabel,
  macroTargets,
  tdee,
  targetKcal,
} from "@/lib/nutrition";
import type { ActivityLevel, Goal, Profile, Sex } from "@/lib/types";

const ACTIVITIES: ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];
const GOALS: Goal[] = ["lose", "maintain", "gain"];

const DEFAULT: Profile = {
  name: "",
  age: 30,
  sex: "male",
  heightCm: 175,
  weightKg: 75,
  activity: "moderate",
  goal: "maintain",
  dietaryPreferences: "",
};

export default function ProfilePage() {
  const stored = useFoodStore((s) => s.profile);
  const setProfile = useFoodStore((s) => s.setProfile);

  const [form, setForm] = useState<Profile>(DEFAULT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (stored) setForm(stored);
  }, [stored]);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setProfile(form);
    setSaved(true);
  }

  const targets = macroTargets(form);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={onSave} className="card space-y-4 lg:col-span-2">
        <div>
          <h1 className="text-2xl font-bold">Your profile</h1>
          <p className="mt-1 text-sm text-stone-500">
            We use this to calculate your calorie & macro targets. Data stays in
            your browser.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="name">
            Name (optional)
          </label>
          <input
            id="name"
            className="input"
            value={form.name ?? ""}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Alex"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="age">
              Age
            </label>
            <input
              id="age"
              type="number"
              min={14}
              max={100}
              className="input"
              value={form.age}
              onChange={(e) => update("age", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Sex</label>
            <div className="flex gap-2">
              {(["male", "female"] as Sex[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update("sex", s)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium capitalize transition ${
                    form.sex === s
                      ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200"
                      : "border-stone-300 dark:border-stone-700"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="height">
              Height (cm)
            </label>
            <input
              id="height"
              type="number"
              min={120}
              max={230}
              className="input"
              value={form.heightCm}
              onChange={(e) => update("heightCm", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="weight">
              Weight (kg)
            </label>
            <input
              id="weight"
              type="number"
              min={30}
              max={250}
              step={0.1}
              className="input"
              value={form.weightKg}
              onChange={(e) => update("weightKg", Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="activity">
            Activity level
          </label>
          <select
            id="activity"
            className="input"
            value={form.activity}
            onChange={(e) =>
              update("activity", e.target.value as ActivityLevel)
            }
          >
            {ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {activityLabel(a)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Goal</label>
          <div className="grid grid-cols-3 gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => update("goal", g)}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                  form.goal === g
                    ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-900/30 dark:text-brand-200"
                    : "border-stone-300 dark:border-stone-700"
                }`}
              >
                {goalLabel(g)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="prefs">
            Dietary preferences / allergies (optional)
          </label>
          <textarea
            id="prefs"
            className="input min-h-[80px]"
            placeholder="e.g. vegetarian, no peanuts, lactose-free, love Mediterranean food"
            value={form.dietaryPreferences ?? ""}
            onChange={(e) => update("dietaryPreferences", e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary">
            Save profile
          </button>
          {saved && (
            <span className="text-sm text-brand-700 dark:text-brand-300">
              Saved locally.
            </span>
          )}
        </div>
      </form>

      <aside className="card space-y-4">
        <h2 className="text-lg font-semibold">Your targets (live)</h2>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="BMR" value={`${bmr(form)}`} unit="kcal" />
          <MiniStat label="TDEE" value={`${tdee(form)}`} unit="kcal" />
        </div>
        <div className="rounded-xl bg-brand-50 p-4 dark:bg-brand-900/20">
          <div className="text-sm text-brand-800 dark:text-brand-200">
            Daily target
          </div>
          <div className="mt-1 text-3xl font-bold text-brand-900 dark:text-brand-100 tabular-nums">
            {targetKcal(form)}
            <span className="ml-1 text-sm font-normal text-brand-700 dark:text-brand-300">
              kcal
            </span>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <Row label="Protein" value={`${targets.protein} g`} />
          <Row label="Carbs" value={`${targets.carbs} g`} />
          <Row label="Fat" value={`${targets.fat} g`} />
        </div>
        <p className="text-xs text-stone-500">
          Calculated with the Mifflin-St Jeor equation and your goal adjustment.
        </p>
      </aside>
    </div>
  );
}

function MiniStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-xl bg-stone-100 p-3 dark:bg-stone-800">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">
        {value}
        <span className="ml-1 text-xs font-normal text-stone-500">{unit}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-stone-100 pb-1 last:border-0 dark:border-stone-800">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
