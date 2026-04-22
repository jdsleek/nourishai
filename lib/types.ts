export type Sex = "male" | "female";
export type Goal = "lose" | "maintain" | "gain";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export interface Profile {
  name?: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  dietaryPreferences?: string;
}

export interface MacroTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Food {
  id: string;
  name: string;
  category: string;
  /** per 100g */
  kcal: number;
  /** per 100g, grams */
  protein: number;
  /** per 100g, grams */
  carbs: number;
  /** per 100g, grams */
  fat: number;
}

export interface FoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  foodId: string;
  foodName: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
}

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

export interface Meal {
  name: string;
  description: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
}

export interface DayPlan {
  day: number; // 1..7
  label: string; // "Monday"
  breakfast: Meal;
  lunch: Meal;
  dinner: Meal;
  snack: Meal;
  totals: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface MealPlan {
  generatedAt: string;
  target: MacroTargets;
  days: DayPlan[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
