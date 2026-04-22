"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  FoodEntry,
  MealPlan,
  Profile,
  WeightEntry,
} from "./types";

interface FoodStore {
  profile: Profile | null;
  foodEntries: FoodEntry[];
  weights: WeightEntry[];
  mealPlan: MealPlan | null;

  setProfile: (p: Profile) => void;
  addFoodEntry: (e: FoodEntry) => void;
  removeFoodEntry: (id: string) => void;
  clearDay: (date: string) => void;

  addWeight: (w: WeightEntry) => void;
  removeWeight: (date: string) => void;

  setMealPlan: (p: MealPlan | null) => void;
}

export const useFoodStore = create<FoodStore>()(
  persist(
    (set) => ({
      profile: null,
      foodEntries: [],
      weights: [],
      mealPlan: null,

      setProfile: (p) => set({ profile: p }),

      addFoodEntry: (e) =>
        set((s) => ({ foodEntries: [...s.foodEntries, e] })),
      removeFoodEntry: (id) =>
        set((s) => ({
          foodEntries: s.foodEntries.filter((x) => x.id !== id),
        })),
      clearDay: (date) =>
        set((s) => ({
          foodEntries: s.foodEntries.filter((x) => x.date !== date),
        })),

      addWeight: (w) =>
        set((s) => {
          const filtered = s.weights.filter((x) => x.date !== w.date);
          return {
            weights: [...filtered, w].sort((a, b) =>
              a.date.localeCompare(b.date)
            ),
          };
        }),
      removeWeight: (date) =>
        set((s) => ({
          weights: s.weights.filter((x) => x.date !== date),
        })),

      setMealPlan: (p) => set({ mealPlan: p }),
    }),
    {
      name: "food-app-store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export function entriesForDate(entries: FoodEntry[], date: string) {
  return entries.filter((e) => e.date === date);
}

export function sumEntries(entries: FoodEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
