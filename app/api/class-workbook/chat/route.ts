import { NextRequest } from "next/server";
import { getGroq, GROQ_MODEL } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

const BASE_SYSTEM = `You are a supportive in-class learning assistant. Help students understand ideas from their lesson, give short clear examples, and suggest ways to study or practice. Be concise by default; expand only if the student asks. If you do not have enough context (e.g. the exact topic), say what you can generally and encourage them to align with the instructor. Never invent policy, grades, or official requirements. This page lives inside a food & nutrition learning site — if the class topic is unrelated to nutrition, focus on the study skills and concepts they name.`;

type Msg = { role: string; content: string };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { messages?: Msg[]; topic?: string };
    const raw = body.messages ?? [];
    const messages = raw
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .slice(-24)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    if (messages.length === 0) {
      return Response.json({ error: "No messages." }, { status: 400 });
    }

    const topic = (body.topic || "").trim();
    const system = topic
      ? `${BASE_SYSTEM}\nThe student said today's focus is: "${topic}".`
      : BASE_SYSTEM;

    const groq = getGroq();
    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.7,
      max_tokens: 1200,
      messages: [{ role: "system", content: system }, ...messages],
    });

    const reply = res.choices[0]?.message?.content?.trim() || "";
    if (!reply) {
      return Response.json({ error: "Empty response." }, { status: 502 });
    }
    return Response.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
