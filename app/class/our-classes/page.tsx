import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our classes · Qubators AI Foundry",
  description: "Day 04 frontend, backend, and submit links for QAF cohort.",
};

const DAY04_SLUG = "qaf-day04-idea-to-product";

export default function OurClassesPage() {
  return (
    <div className="min-h-screen bg-[#07080d] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-8">
        <header>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-400">
            Qubators AI Foundry
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Our classes</h1>
          <p className="mt-2 text-sm text-slate-400">
            Day 04 is split into two decks — share the right link for each block.
          </p>
        </header>

        <section className="rounded-2xl border border-orange-500/35 bg-orange-950/20 p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-orange-300">
            Part 1 · Julius · Frontend &amp; UI/UX (90 min)
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            From Idea to Working Product — UI block
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Scope, UI checklist, copy-paste Cursor prompts, 90-minute run sheet, HTML hooks,
            handoff card for Part 2. <strong>Share this link with students for your session.</strong>
          </p>
          <Link
            href="/foundry/day04-frontend"
            className="mt-5 block rounded-lg bg-orange-500 px-4 py-3 text-center text-sm font-semibold text-[#0a0a0c] hover:bg-orange-400"
          >
            Open frontend slides →
          </Link>
        </section>

        <section className="rounded-2xl border border-cyan-500/25 bg-cyan-950/15 p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">
            Part 2 · Deacon Gift · Backend &amp; data (90 min)
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Backend logic block</h2>
          <p className="mt-2 text-sm text-slate-400">
            AttendNow-style <code>app.js</code> prompt on slide 4 · localStorage · insights · 7 slides.
          </p>
          <Link
            href="/foundry/day04-backend"
            className="mt-4 block rounded-lg border border-cyan-500/40 px-4 py-3 text-center text-sm text-cyan-100 hover:bg-cyan-950/40"
          >
            Open backend slides →
          </Link>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0c0e14] p-6 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Submit &amp; hub
          </p>
          <Link
            href={`/learn/${DAY04_SLUG}`}
            className="block rounded-lg border border-white/15 px-4 py-3 text-center text-sm text-slate-200 hover:bg-white/5"
          >
            Class hub + graded portal
          </Link>
          <Link
            href={`/foundry/day04-frontend?assessment=${DAY04_SLUG}&step=submit`}
            className="block rounded-lg border border-white/10 px-4 py-3 text-center text-xs font-mono text-slate-500 hover:text-white"
          >
            Submit only (end of day)
          </Link>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0c0e14] p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Earlier
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Day 03 · The AI Builder</h2>
          <Link
            href="/foundry/day03"
            className="mt-4 inline-block text-sm text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
          >
            Day 03 slides →
          </Link>
        </section>

        <p className="text-center text-xs text-slate-600">
          <Link href="/class" className="text-slate-500 hover:text-slate-300">
            ← Generic class hub
          </Link>
        </p>
      </div>
    </div>
  );
}
