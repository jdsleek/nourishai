"use client";

import { useMemo, useState } from "react";
import foodsData from "@/lib/foods.json";
import type { Food } from "@/lib/types";

const FOODS = foodsData as Food[];

export default function FoodsPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [sort, setSort] = useState<"name" | "kcal" | "protein">("name");

  const categories = useMemo(() => {
    const s = new Set<string>();
    FOODS.forEach((f) => s.add(f.category));
    return ["All", ...Array.from(s).sort()];
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = FOODS.filter((f) => {
      const matchQ =
        !needle ||
        f.name.toLowerCase().includes(needle) ||
        f.category.toLowerCase().includes(needle);
      const matchC = category === "All" || f.category === category;
      return matchQ && matchC;
    });
    list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      return b[sort] - a[sort];
    });
    return list;
  }, [q, category, sort]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Food database</h1>
        <p className="mt-1 text-sm text-stone-500">
          Browse {FOODS.length} foods with per-100g macros. Filter by category
          and sort by calories or protein.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <input
          className="input"
          placeholder="Search by name or category…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          <option value="name">Sort: Name (A→Z)</option>
          <option value="kcal">Sort: Calories (high→low)</option>
          <option value="protein">Sort: Protein (high→low)</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900">
            <tr>
              <th className="px-4 py-3">Food</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Kcal</th>
              <th className="px-4 py-3 text-right">Protein</th>
              <th className="px-4 py-3 text-right">Carbs</th>
              <th className="px-4 py-3 text-right">Fat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
            {filtered.map((f) => (
              <tr key={f.id} className="hover:bg-brand-50/40 dark:hover:bg-brand-900/10">
                <td className="px-4 py-3 font-medium">{f.name}</td>
                <td className="px-4 py-3 text-stone-500">{f.category}</td>
                <td className="px-4 py-3 text-right tabular-nums">{f.kcal}</td>
                <td className="px-4 py-3 text-right tabular-nums">{f.protein}g</td>
                <td className="px-4 py-3 text-right tabular-nums">{f.carbs}g</td>
                <td className="px-4 py-3 text-right tabular-nums">{f.fat}g</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-stone-500"
                >
                  No foods match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">
        Values are per 100g. Cooked weights where applicable. Sources: USDA
        FoodData Central averages.
      </p>
    </div>
  );
}
