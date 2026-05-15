"use client";

import { useState } from "react";
import WeightChart from "@/components/WeightChart";
import { useFoodStore } from "@/lib/store";
import { todayISO } from "@/lib/nutrition";

export default function ProgressPage() {
  const profile = useFoodStore((s) => s.profile);
  const weights = useFoodStore((s) => s.weights);
  const addWeight = useFoodStore((s) => s.addWeight);
  const removeWeight = useFoodStore((s) => s.removeWeight);

  const [date, setDate] = useState(todayISO());
  const [kg, setKg] = useState<number>(profile?.weightKg ?? 75);

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!kg || kg <= 0) return;
    addWeight({ date, weightKg: Number(kg) });
  }

  const first = weights[0];
  const last = weights[weights.length - 1];
  const delta = first && last ? last.weightKg - first.weightKg : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Weight progress</h1>
        <p className="mt-1 text-sm text-stone-500">
          Track your weight over time to stay accountable.
        </p>
      </div>

      <section className="card">
        <WeightChart
          data={weights}
          targetKg={
            profile && profile.goal !== "maintain" ? undefined : profile?.weightKg
          }
        />
        {weights.length >= 2 && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Stat label="Start" value={`${first.weightKg} kg`} />
            <Stat label="Current" value={`${last.weightKg} kg`} />
            <Stat
              label="Change"
              value={`${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`}
              highlight={delta !== 0}
              positive={
                profile?.goal === "gain" ? delta > 0 : delta < 0
              }
            />
          </div>
        )}
      </section>

      <form onSubmit={onAdd} className="card grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="wdate">
            Date
          </label>
          <input
            id="wdate"
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="wkg">
            Weight (kg)
          </label>
          <input
            id="wkg"
            type="number"
            step={0.1}
            min={30}
            max={300}
            className="input"
            value={kg}
            onChange={(e) => setKg(Number(e.target.value))}
          />
        </div>
        <button className="btn-primary sm:h-[42px]">Log weight</button>
      </form>

      {weights.length > 0 && (
        <section className="card">
          <h2 className="text-lg font-semibold">History</h2>
          <ul className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
            {[...weights]
              .reverse()
              .map((w) => (
                <li
                  key={w.date}
                  className="flex items-center justify-between py-2"
                >
                  <span>
                    {new Date(w.date + "T00:00:00").toLocaleDateString(
                      undefined,
                      {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }
                    )}
                  </span>
                  <span className="flex items-center gap-4">
                    <span className="font-semibold tabular-nums">
                      {w.weightKg} kg
                    </span>
                    <button
                      onClick={() => removeWeight(w.date)}
                      className="text-xs text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  positive,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
}) {
  const color = highlight
    ? positive
      ? "text-brand-600"
      : "text-rose-600"
    : "text-stone-900 dark:text-stone-100";
  return (
    <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}
