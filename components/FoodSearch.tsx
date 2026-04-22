"use client";

import { useMemo, useState } from "react";
import foodsData from "@/lib/foods.json";
import type { Food } from "@/lib/types";

const FOODS = foodsData as Food[];

interface Props {
  onPick: (food: Food) => void;
  placeholder?: string;
}

export default function FoodSearch({ onPick, placeholder }: Props) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return [];
    return FOODS.filter(
      (f) =>
        f.name.toLowerCase().includes(trimmed) ||
        f.category.toLowerCase().includes(trimmed)
    ).slice(0, 10);
  }, [q]);

  return (
    <div className="relative">
      <input
        className="input"
        placeholder={placeholder ?? "Search foods (e.g. chicken, rice, apple)…"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {focused && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-stone-200 bg-white shadow-lg dark:border-stone-700 dark:bg-stone-900">
          {results.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(f);
                  setQ("");
                }}
                className="flex w-full items-center justify-between px-4 py-2 text-left hover:bg-brand-50 dark:hover:bg-brand-900/20"
              >
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-stone-500">{f.category}</div>
                </div>
                <div className="text-right text-xs text-stone-500 tabular-nums">
                  <div>{f.kcal} kcal / 100g</div>
                  <div>
                    P {f.protein}g · C {f.carbs}g · F {f.fat}g
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
