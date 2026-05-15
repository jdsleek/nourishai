"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "nourishai.class-workbook.v1";

const WELCOME =
  "Hi — ask about today’s class material, or paste a confusing phrase and I’ll unpack it in plain language.";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function ClassWorkbookPage() {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [objectives, setObjectives] = useState("");
  const [notes, setNotes] = useState("");
  const [questions, setQuestions] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const j = JSON.parse(
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY) || "{}"
          : "{}"
      ) as Record<string, string>;
      if (j.name) setName(j.name);
      if (j.topic) setTopic(j.topic);
      if (j.objectives) setObjectives(j.objectives);
      if (j.notes) setNotes(j.notes);
      if (j.questions) setQuestions(j.questions);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const payload = { name, topic, objectives, notes, questions };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [name, topic, objectives, notes, questions]);

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setErr(null);
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/class-workbook/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim() || undefined,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply || "(no text)" },
      ]);
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      setErr(
        e instanceof Error
          ? e.message
          : "Could not reach the assistant. Check GROQ_API_KEY on the server."
      );
    } finally {
      setSending(false);
    }
  }

  function clearSaved() {
    if (!confirm("Clear all saved fields on this device?")) return;
    setName("");
    setTopic("");
    setObjectives("");
    setNotes("");
    setQuestions("");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8 border-b border-stone-200/80 pb-6 dark:border-stone-800">
        <h1 className="font-serif text-3xl font-medium text-brand-800 dark:text-brand-200">
          Class workbook
        </h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          In-class notes and a live assistant — same Groq key as the rest of
          NourishAI. Your notes stay on this device only.
        </p>
        <p className="mt-3">
          <a
            href="/foundry/day03"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-brand-700"
          >
            Open Day 03 — AI Builder slides &amp; Foundry grader
          </a>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(300px,360px)] lg:items-start">
        <div className="space-y-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-950">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Session
          </h2>
          <label className="block text-sm text-stone-600 dark:text-stone-400">
            Your name (optional)
            <input
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-stone-900 dark:border-stone-700 dark:bg-stone-900/50 dark:text-stone-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name"
              autoComplete="name"
            />
          </label>
          <label className="block text-sm text-stone-600 dark:text-stone-400">
            Class topic / module
            <input
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-stone-900 dark:border-stone-700 dark:bg-stone-900/50 dark:text-stone-100"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Unit 3 — key concepts"
            />
          </label>

          <h2 className="pt-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Objectives &amp; notes
          </h2>
          <label className="block text-sm text-stone-600 dark:text-stone-400">
            What we’re meant to learn today
            <textarea
              className="mt-1.5 min-h-[88px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-stone-900 dark:border-stone-700 dark:bg-stone-900/50 dark:text-stone-100"
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              placeholder="Learning objectives or board notes…"
            />
          </label>
          <label className="block text-sm text-stone-600 dark:text-stone-400">
            My notes
            <textarea
              className="mt-1.5 min-h-[160px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-stone-900 dark:border-stone-700 dark:bg-stone-900/50 dark:text-stone-100"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Running notes during class…"
            />
          </label>
          <label className="block text-sm text-stone-600 dark:text-stone-400">
            Questions I still have
            <textarea
              className="mt-1.5 min-h-[88px] w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-stone-900 dark:border-stone-700 dark:bg-stone-900/50 dark:text-stone-100"
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="For your tutor or the assistant…"
            />
          </label>
          <p className="text-xs text-stone-500">Saved in this browser only.</p>
          <button
            type="button"
            onClick={clearSaved}
            className="text-sm text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-900 dark:text-brand-300"
          >
            Clear saved notes
          </button>
        </div>

        <div className="space-y-3 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm lg:sticky lg:top-24 dark:border-stone-800 dark:bg-stone-950">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Class assistant
          </h2>
          <p className="text-xs text-stone-500">
            Short explanations and study tips. Not a replacement for your
            instructor.
          </p>
          <div
            ref={logRef}
            className="max-h-[min(52vh,420px)] space-y-3 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm dark:border-stone-700 dark:bg-stone-900/40"
            aria-live="polite"
          >
            {messages.map((m, i) => (
              <div key={i}>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  {m.role === "user" ? "You" : "Assistant"}
                </div>
                <div
                  className={
                    m.role === "user"
                      ? "rounded-lg bg-brand-100 px-3 py-2 text-stone-900 dark:bg-brand-900/30 dark:text-stone-100"
                      : "rounded-lg border border-stone-200 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-950"
                  }
                >
                  {m.content.split("\n").map((line, j) => (
                    <span key={j}>
                      {j > 0 && <br />}
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
          <div className="flex gap-2">
            <textarea
              className="min-h-[52px] flex-1 resize-y rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-900/50 dark:text-stone-100"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask about today’s material…"
              rows={2}
              disabled={sending}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !input.trim()}
              className="h-fit self-end rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-brand-700 disabled:opacity-50"
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
