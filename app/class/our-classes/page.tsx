import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our classes · Qubators AI Foundry",
  description: "Day 03 and Day 04 live class slides and submit links.",
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
            Live slides and graded submit — open the links below in class.
          </p>
        </header>

        <section className="rounded-2xl border border-orange-500/35 bg-orange-950/20 p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-orange-300">
            Today · Day 04
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            From Idea to Working Product
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Part 1 Frontend (Julius) → Part 2 Backend (Deacon Gift) → submit MVP.
          </p>
          <ul className="mt-5 space-y-3">
            <li>
              <Link
                href="/foundry/day04"
                className="block rounded-lg bg-orange-500 px-4 py-3 text-center text-sm font-semibold text-[#0a0a0c] hover:bg-orange-400"
              >
                Full-day slides (Part 1 + 2)
              </Link>
            </li>
            <li>
              <Link
                href="/foundry/day04-backend"
                className="block rounded-lg border border-white/15 px-4 py-3 text-center text-sm text-slate-200 hover:border-cyan-400/40"
              >
                Part 2 only · Backend &amp; data
              </Link>
            </li>
            <li>
              <Link
                href={`/learn/${DAY04_SLUG}`}
                className="block rounded-lg border border-cyan-500/30 px-4 py-3 text-center text-sm text-cyan-100 hover:bg-cyan-950/40"
              >
                Class hub + submit portal
              </Link>
            </li>
            <li>
              <Link
                href={`/foundry/day04?assessment=${DAY04_SLUG}&step=submit`}
                className="block rounded-lg border border-white/10 px-4 py-3 text-center text-xs font-mono text-slate-400 hover:text-white"
              >
                Submit only (skip slides)
              </Link>
            </li>
          </ul>
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
