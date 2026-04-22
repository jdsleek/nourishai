"use client";

import { useEffect, useRef, useState } from "react";
import { useFoodStore, entriesForDate } from "@/lib/store";
import { todayISO } from "@/lib/nutrition";
import type { ChatMessage } from "@/lib/types";

const SUGGESTIONS = [
  "Suggest 3 high-protein snacks under 200 kcal",
  "What should I eat for dinner to hit my remaining calories?",
  "Give me a grocery list for the week based on my goal",
  "I'm feeling hungry — what's a smart low-calorie option?",
  "Quick breakfast ideas with 30g+ protein",
];

export default function ChatPage() {
  const profile = useFoodStore((s) => s.profile);
  const entries = useFoodStore((s) => s.foodEntries);
  const todayEntries = entriesForDate(entries, todayISO());

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streaming]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: text.trim() },
    ];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          profile,
          todayEntries,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Chat failed." }));
        setMessages([
          ...next,
          {
            role: "assistant",
            content: `Sorry, something went wrong: ${err.error ?? res.statusText}`,
          },
        ]);
        setStreaming(false);
        return;
      }

      setMessages([...next, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Error: ${e instanceof Error ? e.message : "network error"}`,
        },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col space-y-4">
      <div>
        <h1 className="text-2xl font-bold">AI nutrition coach</h1>
        <p className="mt-1 text-sm text-stone-500">
          Ask anything about food, recipes, or hitting your goals. I know your
          profile and today's log.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
      >
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="rounded-xl bg-brand-50 p-4 text-brand-900 dark:bg-brand-900/20 dark:text-brand-100">
              <div className="font-semibold">Hi! I'm your NourishAI coach.</div>
              <div className="mt-1 text-sm">
                {profile
                  ? `Based on your goal to ${profile.goal} weight, I can help you plan meals, hit your targets, and pick smart foods. Try one of these:`
                  : "Set up your profile and I can personalize answers. Meanwhile, ask anything about nutrition:"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-brand-500 hover:text-brand-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {streaming &&
          messages[messages.length - 1]?.role === "user" && (
            <Bubble role="assistant" content="…" />
          )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          className="input flex-1"
          placeholder="Ask about food, recipes, or calories…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="btn-primary"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, content }: ChatMessage) {
  const isUser = role === "user";
  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-brand-600 text-white"
            : "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100"
        }`}
      >
        {content || " "}
      </div>
    </div>
  );
}
