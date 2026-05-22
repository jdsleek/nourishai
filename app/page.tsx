import Link from "next/link";
import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans, JetBrains_Mono } from "next/font/google";

export const metadata: Metadata = {
  title: "Qubators AI Foundry",
  description:
    "Class hubs, cohort slide decks, and facilitator tools for Qubators AI Builder training.",
};

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"] });
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
});

const sessionNote = process.env.NEXT_PUBLIC_HOME_SESSION_NOTE?.trim();

export default function FoundryHomePage() {
  return (
    <div
      className={`${dmSans.className} relative min-h-screen overflow-hidden bg-[#090a0e] text-[#f7f6f2]`}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 8% 12%, rgba(249,115,22,0.07) 0%, transparent 55%), radial-gradient(ellipse 50% 55% at 92% 88%, rgba(34,211,238,0.05) 0%, transparent 55%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 75% 75% at 50% 40%, black, transparent)",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col px-5 pb-16 pt-[max(2.5rem,env(safe-area-inset-top))] sm:px-8">
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.09] pb-5">
          <p
            className={`${jetbrains.className} text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c9a94]`}
          >
            Qubators AI Foundry
          </p>
          <Link
            href="/training/facilitator/login"
            className={`${jetbrains.className} shrink-0 rounded-md border border-cyan-400/45 px-3 py-1.5 text-[11px] text-cyan-300 transition hover:border-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-100`}
          >
            Facilitator
          </Link>
        </header>

        <main className="flex flex-1 flex-col justify-center py-12 sm:py-16">
          <p
            className={`${jetbrains.className} text-xs font-semibold uppercase tracking-[0.22em] text-orange-400`}
          >
            Day 04 · Build day (live)
          </p>
          <h1
            className={`${bebas.className} mt-3 text-[clamp(3.25rem,12vw,5.5rem)] leading-[0.92] tracking-wide text-white`}
          >
            THE FOUNDRY
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#9c9a94] sm:text-xl">
            Live class slides, your cohort hub, and graded submissions — all through the link your
            facilitator shares.
          </p>

          {sessionNote ? (
            <div className="mt-8 max-w-xl rounded-xl border border-cyan-400/30 bg-cyan-400/[0.07] px-5 py-4">
              <p
                className={`${jetbrains.className} mb-2 text-[10px] uppercase tracking-[0.2em] text-cyan-300`}
              >
                This week
              </p>
              <p className="text-base leading-relaxed text-cyan-50/95">{sessionNote}</p>
            </div>
          ) : null}

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-2xl border border-orange-500/35 bg-gradient-to-br from-orange-500/[0.12] to-transparent p-6 sm:p-8">
              <p
                className={`${jetbrains.className} text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300`}
              >
                Learners
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Open your class link</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#b8b6b0] sm:text-base">
                Do not start from this page for a graded submit. Use the{" "}
                <strong className="font-medium text-[#f7f6f2]">hub</strong> or{" "}
                <strong className="font-medium text-[#f7f6f2]">deck URL</strong> your coach sent
                (it includes your course name).
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/class/our-classes"
                  className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-[#0a0704] transition hover:bg-orange-400"
                >
                  Our classes (Day 04 live)
                </Link>
                <Link
                  href="/class"
                  className={`${jetbrains.className} inline-flex items-center justify-center rounded-lg border border-white/15 px-5 py-3 text-xs text-[#9c9a94] transition hover:border-white/25 hover:text-white`}
                >
                  Course hub
                </Link>
              </div>
            </div>

            <Link
              href="/training/facilitator/login"
              className="group rounded-2xl border border-white/[0.09] bg-[#10111a] p-6 transition hover:border-cyan-400/35 hover:bg-[#12131c]"
            >
              <p
                className={`${jetbrains.className} text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400`}
              >
                Coaches
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white group-hover:text-cyan-50">
                Facilitator console
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6b6963]">
                Share links, review submissions, and manage assessments.
              </p>
              <span
                className={`${jetbrains.className} mt-4 inline-block text-xs text-cyan-400 group-hover:text-cyan-300`}
              >
                Sign in →
              </span>
            </Link>

            <div className="rounded-2xl border border-white/[0.09] bg-[#10111a] p-6">
              <p
                className={`${jetbrains.className} text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b6963]`}
              >
                Link shape
              </p>
              <p className="mt-3 font-mono text-sm leading-relaxed text-[#9c9a94]">
                <span className="text-emerald-400/90">/learn/</span>
                <span className="text-white">your-course</span>
              </p>
              <p className="mt-2 font-mono text-sm leading-relaxed text-[#9c9a94]">
                <span className="text-orange-400/90">/foundry/deck/</span>
                <span className="text-white">your-course</span>
              </p>
            </div>
          </div>
        </main>

        <footer
          className={`${jetbrains.className} border-t border-white/[0.09] pt-6 text-center text-[10px] uppercase tracking-[0.16em] text-[#6b6963]`}
        >
          Qubators AI Foundry · educational use
        </footer>
      </div>
    </div>
  );
}
