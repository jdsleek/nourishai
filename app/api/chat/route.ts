import { NextRequest } from "next/server";
import { getClaude, CLAUDE_MODEL } from "@/lib/claude";
import { macroTargets, goalLabel } from "@/lib/nutrition";
import type { ChatMessage, FoodEntry, Profile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  messages: ChatMessage[];
  profile?: Profile | null;
  todayEntries?: FoodEntry[];
}

function buildSystemPrompt(
  profile: Profile | null | undefined,
  entries: FoodEntry[] | undefined
): string {
  const base = `You are NourishAI, a friendly, evidence-based nutrition coach.
You help users reach their weight goals via sensible food choices.
Keep answers concise, actionable, and warm. Use bullet points for lists of food recommendations.
You are NOT a medical professional. For medical conditions, recommend consulting a doctor or registered dietitian.
When recommending foods, include approximate calories and key macros when useful.`;

  if (!profile) {
    return `${base}\n\nThe user has not yet set up their profile. Encourage them to visit the Profile page so you can personalize advice.`;
  }

  const t = macroTargets(profile);
  const todayTotals = (entries ?? []).reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const prefs = profile.dietaryPreferences?.trim() || "none stated";
  const todayStr =
    entries && entries.length > 0
      ? entries
          .map(
            (e) =>
              `- ${e.meal}: ${e.foodName} (${Math.round(e.grams)}g, ${Math.round(
                e.kcal
              )} kcal)`
          )
          .join("\n")
      : "(nothing logged yet today)";

  return `${base}

USER PROFILE:
- Name: ${profile.name || "(not set)"}
- Age: ${profile.age}, Sex: ${profile.sex}
- Height: ${profile.heightCm} cm, Weight: ${profile.weightKg} kg
- Activity: ${profile.activity}
- Goal: ${goalLabel(profile.goal)}
- Dietary preferences / allergies: ${prefs}

DAILY TARGETS:
- Calories: ${t.kcal} kcal
- Protein: ${t.protein} g, Carbs: ${t.carbs} g, Fat: ${t.fat} g

TODAY SO FAR (${Math.round(todayTotals.kcal)} kcal · ${Math.round(
    todayTotals.protein
  )}g P · ${Math.round(todayTotals.carbs)}g C · ${Math.round(todayTotals.fat)}g F):
${todayStr}

REMAINING FOR TODAY: ~${Math.max(0, Math.round(t.kcal - todayTotals.kcal))} kcal, ~${Math.max(
    0,
    Math.round(t.protein - todayTotals.protein)
  )}g protein.

Always factor the user's goal, remaining calories, and preferences into your recommendations.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const messages = body.messages ?? [];

    const claude = getClaude();
    const system = buildSystemPrompt(body.profile, body.todayEntries);

    const stream = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
