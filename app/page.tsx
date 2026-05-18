import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NourishAI · Training home",
  description:
    "Class hubs, facilitator-assigned decks, and coach tools — use the link your instructor sent.",
};

const sessionNote = process.env.NEXT_PUBLIC_HOME_SESSION_NOTE?.trim();

export default function TrainingHomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#061018] via-[#0a121c] to-[#04080c] text-slate-200">
      <div className="mx-auto flex max-w-2xl flex-col gap-10 px-5 pb-24 pt-16 md:pt-24">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90">
            Qubators · NourishAI
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Training home
          </h1>
          <p className="mt-4 text-lg text-slate-400">
            Materials and grading are tied to the link your facilitator gives you — typically a{" "}
            <strong className="text-slate-200">class hub</strong>
            {" "}(path like{" "}
            <code className="rounded bg-black/35 px-1.5 py-0.5 font-mono text-sm text-emerald-200/90">
              /learn/your-course
            </code>
            ) or the <strong className="text-slate-200">slide deck</strong> for your cohort.
          </p>
          {sessionNote ? (
            <p className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-950/30 px-4 py-3 text-sm text-cyan-100/95">
              {sessionNote}
            </p>
          ) : (
            <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              Between live sessions there is usually nothing to submit from this page. Bookmark your
              facilitator&apos;s hub or deck link for the next class.
            </p>
          )}
        </header>

        <section aria-label="Common entry points" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Common entry points
          </h2>
          <Link
            href="/class"
            className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-5 py-4 transition hover:border-emerald-400/45 hover:bg-emerald-950/35"
          >
            <span className="block text-base font-semibold text-emerald-100">Class workbook hub</span>
            <span className="mt-1 block text-sm text-slate-400">
              Paste your course slug if you were given{" "}
              <code className="font-mono text-emerald-200/80">?course=…</code> instructions.
            </span>
          </Link>
          <Link
            href="/foundry/day03"
            className="rounded-2xl border border-orange-500/25 bg-orange-950/15 px-5 py-4 transition hover:border-orange-400/40 hover:bg-orange-950/28"
          >
            <span className="block text-base font-semibold text-orange-100">
              Open Day&nbsp;03 deck (generic rubric)
            </span>
            <span className="mt-1 block text-sm text-slate-400">
              Practice or demo slides only — submits here are{" "}
              <strong className="text-slate-300">not</strong> routed to your facilitator&apos;s cohort
              unless you append their course slug (?assessment= or /deck/ slug).
            </span>
          </Link>
          <Link
            href="/training/facilitator/login"
            className="rounded-2xl border border-white/15 bg-[#111520] px-5 py-4 transition hover:border-white/25 hover:bg-[#161c28]"
          >
            <span className="block text-base font-semibold text-white">Facilitator sign-in</span>
            <span className="mt-1 block text-sm text-slate-400">
              Coaches: manage assessments, learner links, and submissions.
            </span>
          </Link>
        </section>

        <p className="text-center text-xs text-slate-500">
          Educational use only · not medical advice
        </p>
      </div>
    </div>
  );
}
