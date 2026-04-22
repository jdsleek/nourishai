import { NextRequest } from "next/server";
import { getClaude, CLAUDE_MODEL } from "@/lib/claude";
import { macroTargets, goalLabel } from "@/lib/nutrition";
import type { MacroTargets, Profile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  profile: Profile;
  preferences?: string;
}

const SYSTEM = `You are a certified registered dietitian creating a personalized 7-day meal plan.
You MUST respond with ONLY a valid JSON object — no prose, no markdown, no code fences.

The JSON schema you must return:
{
  "days": [
    {
      "day": 1,
      "label": "Monday",
      "breakfast": { "name": string, "description": string, "kcal": number, "protein": number, "carbs": number, "fat": number, "ingredients": string[] },
      "lunch":     { "name": string, "description": string, "kcal": number, "protein": number, "carbs": number, "fat": number, "ingredients": string[] },
      "dinner":    { "name": string, "description": string, "kcal": number, "protein": number, "carbs": number, "fat": number, "ingredients": string[] },
      "snack":     { "name": string, "description": string, "kcal": number, "protein": number, "carbs": number, "fat": number, "ingredients": string[] }
    }
    // ... 7 entries total, Monday..Sunday
  ]
}

Rules:
- Each day's total calories must be within ±75 kcal of the user's target.
- Each day's protein must be within ±10g of target (protein is the priority macro).
- Ingredients must be simple whole foods with portion sizes (e.g. "150g chicken breast", "1 cup cooked brown rice").
- Vary meals across the week. Do not repeat the same main dish on consecutive days.
- Honor dietary preferences and allergies strictly.
- Descriptions should be 1 short sentence.
- All numbers are in grams/kcal. No units in JSON values.`;

function buildUserPrompt(profile: Profile, target: MacroTargets) {
  const prefs = profile.dietaryPreferences?.trim() || "none";
  return `Create a 7-day meal plan for me.

Profile:
- Age: ${profile.age}
- Sex: ${profile.sex}
- Height: ${profile.heightCm} cm
- Weight: ${profile.weightKg} kg
- Activity: ${profile.activity}
- Goal: ${goalLabel(profile.goal)}

Daily targets:
- Calories: ${target.kcal} kcal
- Protein: ${target.protein} g
- Carbs:   ${target.carbs} g
- Fat:     ${target.fat} g

Dietary preferences / allergies: ${prefs}

Return ONLY the JSON object described in the system message.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.profile) {
      return Response.json(
        { error: "Missing profile in request body." },
        { status: 400 }
      );
    }
    const target = macroTargets(body.profile);

    const claude = getClaude();
    const msg = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [
        { role: "user", content: buildUserPrompt(body.profile, target) },
      ],
    });

    const text =
      msg.content
        .filter((b) => b.type === "text")
        .map((b) => ("text" in b ? b.text : ""))
        .join("\n") || "";

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      return Response.json(
        { error: "Model did not return JSON.", raw: text },
        { status: 502 }
      );
    }
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    const days = Array.isArray(parsed.days) ? parsed.days : [];
    const withTotals = days.map((d: any) => {
      const meals = [d.breakfast, d.lunch, d.dinner, d.snack];
      const totals = meals.reduce(
        (acc, m) => ({
          kcal: acc.kcal + (m?.kcal ?? 0),
          protein: acc.protein + (m?.protein ?? 0),
          carbs: acc.carbs + (m?.carbs ?? 0),
          fat: acc.fat + (m?.fat ?? 0),
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      );
      return { ...d, totals };
    });

    return Response.json({
      generatedAt: new Date().toISOString(),
      target,
      days: withTotals,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error generating meal plan.";
    return Response.json({ error: message }, { status: 500 });
  }
}
