"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  clearPersistedLearnerCourseSlug,
  learnerDeckPath,
  persistLearnerCourseSlug,
} from "@/lib/foundry-learner-course";

type HubConfig = {
  programName: string;
  deckHref: string;
  workbookPath: string;
  facilitatorEmail?: string | null;
  facilitatorDisplayName?: string | null;
  assessmentSlug: string | null;
  assessmentTitle: string | null;
  assessmentIntro?: string | null;
  submissionsOpen: boolean;
  siteDefaultActive: boolean;
  mode?: "builtin" | "course";
};

type SavedGrade = {
  submissionId?: string;
  submittedAt?: string;
  assessmentTitle?: string;
  result?: {
    total_score: number;
    grade: string;
    verdict: string;
    level_up_tip: string;
  };
};

const STORE_KEY = "foundry.student.v1";

function readStore(): { lastGrade?: SavedGrade } {
  try {
    return JSON.parse(
      typeof window !== "undefined"
        ? localStorage.getItem(STORE_KEY) || "{}"
        : "{}",
    ) as { lastGrade?: SavedGrade };
  } catch {
    return {};
  }
}

export default function ClassHubBody({
  courseSlug,
  canonicalHubPath,
}: {
  /** From ?course=facilitator-slug or /learn/[slug] — THAT assessment only */
  courseSlug: string | null;
  /** Stable share path (preferred over ?course); e.g. /learn/my-course-slug */
  canonicalHubPath?: string | null;
}) {
  const [hub, setHub] = useState<HubConfig | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hubLoadFailed, setHubLoadFailed] = useState<string | null>(null);
  const [lastGrade, setLastGrade] = useState<SavedGrade | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<SavedGrade | null>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);

  /** Same trainer’s cohorts — card picker when they run multiple slug links. */
  const [catalog, setCatalog] = useState<{
    courses: { slug: string; title: string; submissionsOpen: boolean }[];
    facilitatorDisplayName: string | null;
  } | null>(null);
  const [catalogErr, setCatalogErr] = useState<string | null>(null);

  /** Org-wide facilitator cohorts with submissions open (student discovery). */
  const [liveOpen, setLiveOpen] = useState<
    | {
        slug: string;
        title: string;
        submissionsOpen: boolean;
        facilitatorDisplayName: string | null;
      }[]
    | null
  >(null);
  const [liveOpenErr, setLiveOpenErr] = useState<string | null>(null);

  const hubUrl =
    typeof window !== "undefined" && courseSlug
      ? `${window.location.origin}${
          canonicalHubPath ??
          `/class?course=${encodeURIComponent(courseSlug)}`
        }`
      : null;

  const loadHub = useCallback(async () => {
    setErr(null);
    setHubLoadFailed(null);
    const q = courseSlug
      ? `/api/foundry/class-hub?slug=${encodeURIComponent(courseSlug)}`
      : "/api/foundry/class-hub";
    const res = await fetch(q);
    const data = (await res.json()) as HubConfig & {
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      if (data.error === "DATABASE_UNAVAILABLE") {
        setHubLoadFailed(
          data.message ||
            "Course links need the deployed site with Postgres. Plain local npm dev without DATABASE_URL cannot load course-specific (/learn/… or ?course=) links.",
        );
        setHub(null);
        return;
      }
      if (data.error === "UNKNOWN_COURSE") {
        clearPersistedLearnerCourseSlug();
        setHubLoadFailed(
          data.message ||
            "This course link could not be found. Ask your facilitator to resend the link.",
        );
        setHub(null);
        return;
      }
      throw new Error(data.message || data.error || "Could not load class info.");
    }
    setHub(data);
    const slug = data.assessmentSlug ?? courseSlug;
    if (slug) persistLearnerCourseSlug(slug);
  }, [courseSlug]);

  useEffect(() => {
    if (courseSlug) persistLearnerCourseSlug(courseSlug);
  }, [courseSlug]);

  useEffect(() => {
    if (!hub) return;
    if (!courseSlug && hub.mode === "builtin") clearPersistedLearnerCourseSlug();
  }, [hub, courseSlug]);

  useEffect(() => {
    setLastGrade(readStore().lastGrade ?? null);
    void loadHub().catch((e) =>
      setErr(e instanceof Error ? e.message : "Load failed."),
    );
  }, [loadHub]);

  useEffect(() => {
    let cancelled = false;
    setLiveOpenErr(null);
    setLiveOpen(null);
    void (async () => {
      try {
        const res = await fetch("/api/foundry/live-classes");
        const data = (await res.json()) as {
          courses?: {
            slug: string;
            title: string;
            submissionsOpen?: boolean;
            facilitatorDisplayName?: string | null;
          }[];
          error?: string;
        };
        if (!res.ok) {
          if (!cancelled) setLiveOpenErr(data.error || "Could not load open classes.");
          return;
        }
        const rows = Array.isArray(data.courses) ? data.courses : [];
        if (!cancelled) {
          setLiveOpen(
            rows.map((c) => ({
              slug: String(c.slug ?? ""),
              title: String(c.title ?? ""),
              submissionsOpen: c.submissionsOpen !== false,
              facilitatorDisplayName:
                typeof c.facilitatorDisplayName === "string" &&
                c.facilitatorDisplayName.trim().length > 0
                  ? c.facilitatorDisplayName.trim()
                  : null,
            })),
          );
        }
      } catch {
        if (!cancelled) setLiveOpenErr("Could not load open classes.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!courseSlug) {
      setCatalog(null);
      setCatalogErr(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setCatalogErr(null);
      try {
        const res = await fetch(
          `/api/foundry/cohort-picker?slug=${encodeURIComponent(courseSlug)}`,
        );
        const data = (await res.json()) as {
          courses?: { slug: string; title: string; submissionsOpen: boolean }[];
          facilitatorDisplayName?: string | null;
          error?: string;
        };
        if (!res.ok) {
          if (!cancelled) setCatalogErr(data.error || "Could not load cohort list.");
          return;
        }
        if (!cancelled) {
          setCatalog({
            courses: Array.isArray(data.courses) ? data.courses : [],
            facilitatorDisplayName:
              typeof data.facilitatorDisplayName === "string"
                ? data.facilitatorDisplayName
                : null,
          });
        }
      } catch {
        if (!cancelled) setCatalogErr("Could not load cohort list.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseSlug]);

  async function lookupSubmission() {
    const id = lookupId.trim();
    if (!id) return;
    setLookupBusy(true);
    setLookupErr(null);
    setLookupResult(null);
    try {
      const res = await fetch(
        `/api/foundry/my-submission?id=${encodeURIComponent(id)}`,
      );
      const data = (await res.json()) as {
        id?: string;
        submittedAt?: string;
        result?: SavedGrade["result"];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Not found.");
      setLookupResult({
        submissionId: data.id ?? id,
        submittedAt: data.submittedAt,
        result: data.result,
      });
    } catch (e) {
      setLookupErr(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLookupBusy(false);
    }
  }

  const openForSubmit = hub?.submissionsOpen !== false;
  const activeSlug = courseSlug ?? hub?.assessmentSlug ?? null;
  const deckHref = activeSlug ? learnerDeckPath(activeSlug) : hub?.deckHref ?? "/foundry/day03";
  const facilitatorLabel =
    hub?.facilitatorDisplayName?.trim() ||
    (hub?.facilitatorEmail ? hub.facilitatorEmail.split("@")[0] : "");

  return (
    <div className="min-h-screen bg-[#07080d] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-400">
            {hub?.programName ?? "Qubators AI Foundry"}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Class hub</h1>
          {facilitatorLabel ? (
            <p className="mt-2 text-sm text-cyan-200/90">
              Instructor · <span className="font-semibold text-white">{facilitatorLabel}</span>
            </p>
          ) : null}
          <p className={`${facilitatorLabel ? "mt-1" : "mt-2"} text-sm text-slate-400`}>
            {courseSlug
              ? "Your cohort assignment, submit portal, and private workbook."
              : "Your facilitator's class — slides, submit portal, and private workbook."}
          </p>
          {!courseSlug ? (
            <p className="mt-1 text-xs text-slate-500">
              Pick your facilitator&apos;s link{" "}
              <span className="font-mono text-slate-400">/learn/&lt;slug&gt;</span> — each cohort has its
              own assignment deck and rubric, not the generic program hub alone.
            </p>
          ) : null}
          {courseSlug ? (
            <p className="mt-3 rounded-lg border border-cyan-500/25 bg-cyan-950/20 px-3 py-2 text-xs leading-relaxed text-cyan-100/95">
              <strong className="text-white">This page is your cohort home — it does not auto-open the slides.</strong>{" "}
              Scroll to <strong className="font-medium text-slate-200">Open slides &amp; submit portal</strong> when you
              want the deck; that opens{" "}
              <span className="font-mono text-slate-500">{learnerDeckPath(courseSlug)}</span> in the same tab
              (different page, not a redirect from this URL).
            </p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">
            The <strong className="font-medium text-slate-400">assessment title</strong> on your hub (e.g.
            what appears next to “Your course”) is set by your facilitator in their trainer console — not by
            the shared slide deck alone.
          </p>
          {hubUrl ? (
            <p className="mt-3 font-mono text-[10px] text-slate-600 break-all">
              This cohort: {hubUrl}
            </p>
          ) : null}
        </header>

        {err ? (
          <p className="rounded-lg border border-red-500/30 bg-red-950/35 px-3 py-2 text-sm text-red-300">
            {err}
          </p>
        ) : null}

        {catalogErr && courseSlug ? (
          <p className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
            {catalogErr}
          </p>
        ) : null}

        {liveOpenErr ? (
          <p className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
            {liveOpenErr}
          </p>
        ) : null}

        {liveOpen === null && !liveOpenErr ? (
          <p className="text-xs text-slate-600">Loading open cohorts…</p>
        ) : null}

        {!courseSlug && liveOpen && liveOpen.length > 0 ? (
          <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/85">
              Open cohorts · accepting submissions
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Every live class hub in this program right now. Use the cohort your facilitator sent;
              picking the wrong slug sends work to someone else&apos;s inbox.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {liveOpen.map((c) => {
                const here =
                  !!courseSlug && courseSlug.toLowerCase() === c.slug.toLowerCase();
                return (
                  <li key={c.slug}>
                    <Link
                      href={`/learn/${encodeURIComponent(c.slug)}`}
                      prefetch={false}
                      onClick={() => persistLearnerCourseSlug(c.slug)}
                      className={`flex h-full min-h-[5.5rem] flex-col rounded-xl border p-4 transition hover:bg-white/[0.04] ${
                        here
                          ? "border-cyan-400/50 bg-cyan-950/40 ring-1 ring-cyan-400/30"
                          : "border-emerald-500/20 bg-[#0c1410]"
                      }`}
                    >
                      <p className="font-semibold text-white">{c.title}</p>
                      <p className="mt-1 font-mono text-xs text-emerald-300/95">{c.slug}</p>
                      {c.facilitatorDisplayName ? (
                        <p className="mt-2 text-[11px] text-slate-500">
                          Instructor ·{" "}
                          <span className="text-slate-400">{c.facilitatorDisplayName}</span>
                        </p>
                      ) : null}
                      <p className="mt-auto pt-3 text-[11px] text-emerald-200/85">
                        {here ? "You are here" : "Open this class hub →"}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {catalog && courseSlug && catalog.courses.length > 1 ? (
          <section className="rounded-2xl border border-white/10 bg-[#0c1018] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Cohort picker
            </p>
            {catalog.facilitatorDisplayName ? (
              <p className="mt-2 text-xs text-slate-500">
                Trainer ·{" "}
                <span className="text-slate-300">{catalog.facilitatorDisplayName}</span>
              </p>
            ) : null}
            <p className="mt-2 text-sm text-slate-300">
              Your trainer assigned more than one course link. Tap the cohort you were told to join —
              grading uses the slug on that hub, not whichever link you clicked first.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {catalog.courses.map((c) => {
                const here = courseSlug?.toLowerCase() === c.slug.toLowerCase();
                return (
                  <li key={c.slug}>
                    {!c.submissionsOpen ? (
                      <div className="flex h-full flex-col rounded-xl border border-stone-600/35 bg-black/20 p-4 opacity-70">
                        <p className="font-semibold text-slate-300">{c.title}</p>
                        <p className="mt-1 font-mono text-xs text-stone-500">{c.slug}</p>
                        <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-amber-300">
                          Submissions closed
                        </p>
                      </div>
                    ) : (
                      <Link
                        href={`/learn/${encodeURIComponent(c.slug)}`}
                        prefetch={false}
                        onClick={() => persistLearnerCourseSlug(c.slug)}
                        className={`flex h-full flex-col rounded-xl border p-4 transition hover:bg-white/[0.04] ${
                          here
                            ? "border-cyan-400/50 bg-cyan-950/40 ring-1 ring-cyan-400/30"
                            : "border-white/12 bg-[#111520]"
                        }`}
                      >
                        <p className="font-semibold text-white">{c.title}</p>
                        <p className="mt-1 font-mono text-xs text-emerald-300/95">{c.slug}</p>
                        <p className="mt-auto pt-3 text-[11px] text-cyan-200/85">
                          {here ? "You are here — open slides below" : "Open this class hub →"}
                        </p>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {hubLoadFailed ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
            <p>{hubLoadFailed}</p>
            <p className="mt-2 text-xs text-amber-200/85">
              Use the exact link from your facilitator: hub path{" "}
              <code className="rounded bg-black/30 px-1 font-mono">/learn/your-course-slug</code>{" "}
              or <code className="rounded bg-black/30 px-1 font-mono">/class?course=…</code>, or slides
              with <code className="rounded bg-black/30 px-1 font-mono">?assessment=…</code>.
            </p>
          </div>
        ) : null}

        {!hub && !err && !hubLoadFailed ? (
          <p className="text-sm text-slate-500">Loading class info…</p>
        ) : null}

        {hub ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300/80">
                {courseSlug ? "Your course" : siteDefaultBanner(hub)}
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {hub.assessmentTitle ?? "Day 03 — AI Builder"}
              </p>
              {hub.assessmentSlug ? (
                <p className="mt-1 font-mono text-xs text-slate-500">
                  Slug · {hub.assessmentSlug}
                </p>
              ) : null}
              {courseSlug && hub.assessmentIntro?.trim() ? (
                <div className="mt-4 rounded-xl border border-orange-500/25 bg-[#0c0e14] p-4 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
                  {hub.assessmentIntro.trim()}
                </div>
              ) : null}
              {courseSlug ? (
                <p className="mt-2 text-xs text-slate-500">
                  If this title doesn&apos;t match what your facilitator called the class, ask them to
                  update the <strong className="font-medium text-slate-400">assessment title</strong> in
                  their trainer console — it is separate from the shared Day&nbsp;03 slides.
                </p>
              ) : null}
              {hub.facilitatorEmail ? (
                <p className="mt-1 text-xs text-slate-400">
                  Grading inbox · {hub.facilitatorEmail}
                </p>
              ) : null}
              {!courseSlug && hub.mode === "builtin" ? (
                <p className="mt-2 text-xs text-amber-200/90">
                  This generic hub loads the shared program deck (no facilitator rubric tied here).
                  For your facilitator&apos;s course, open their link —{" "}
                  <code className="rounded bg-black/40 px-1 font-mono">/learn/your-course</code>,{" "}
                  <code className="rounded bg-black/40 px-1 font-mono">/class?course=…</code>, or
                  slides with{" "}
                  <code className="rounded bg-black/40 px-1 font-mono">?assessment=…</code>.
                </p>
              ) : null}
              <p className="mt-3 text-sm">
                {openForSubmit ? (
                  <span className="text-emerald-300">Submissions open</span>
                ) : (
                  <span className="text-amber-300">
                    Submissions closed — contact your facilitator
                  </span>
                )}
              </p>
            </div>

            <div className="grid gap-3">
              <a
                href={deckHref}
                onClick={() => {
                  if (activeSlug) persistLearnerCourseSlug(activeSlug);
                }}
                className="block rounded-xl bg-orange-500 px-5 py-4 text-center text-sm font-semibold text-[#0a0a0c] hover:bg-orange-400"
              >
                Open slides &amp; submit portal
              </a>
              <Link
                href={hub.workbookPath}
                className="block rounded-xl border border-white/15 px-5 py-4 text-center text-sm font-medium text-slate-200 hover:bg-white/5"
              >
                Class workbook (notes on this device)
              </Link>
            </div>

            <p className="text-xs text-slate-500">
              {courseSlug ? (
                <>
                  Link opens{" "}
                  <code className="rounded bg-white/10 px-1 font-mono text-[11px]">
                    {deckHref}
                  </code>{" "}
                  so your facilitator&apos;s rubric stays attached even if chats shorten links.
                </>
              ) : (
                <>
                  Opens the shared deck at{" "}
                  <code className="rounded bg-white/10 px-1 font-mono text-[11px]">
                    {deckHref}
                  </code>
                  — add{" "}
                  <code className="rounded bg-white/10 px-1 font-mono text-[11px]">
                    ?assessment=your-course
                  </code>{" "}
                  for a facilitator rubric, or ask for a full class link.
                </>
              )}
            </p>
          </div>
        ) : null}

        {lastGrade?.result ? (
          <div className="rounded-2xl border border-white/10 bg-[#111520] p-5 text-sm">
            <p className="font-semibold text-white">Last grade on this device</p>
            <p className="mt-2 font-mono text-2xl text-cyan-200">
              {lastGrade.result.total_score}/20 · {lastGrade.result.grade}
            </p>
            <p className="mt-2 text-slate-400">{lastGrade.result.verdict}</p>
            {lastGrade.submissionId ? (
              <p className="mt-3 font-mono text-[10px] text-slate-600">
                Ref {lastGrade.submissionId.slice(0, 8)}…
              </p>
            ) : null}
            {activeSlug || hub?.deckHref ? (
              <a
                href={deckHref}
                onClick={() => {
                  if (activeSlug) persistLearnerCourseSlug(activeSlug);
                }}
                className="mt-4 inline-block text-xs text-cyan-300 underline"
              >
                Open deck to submit again
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-[#111520] p-5 text-sm">
          <p className="font-semibold text-white">Have a submission reference?</p>
          <p className="mt-1 text-xs text-slate-500">
            Paste the id from your receipt to view your grade summary (no login).
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="e.g. a1b2c3d4-…"
              className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 font-mono text-xs text-slate-100"
            />
            <button
              type="button"
              disabled={lookupBusy || !lookupId.trim()}
              onClick={() => void lookupSubmission()}
              className="rounded-lg border border-cyan-400/40 px-4 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-45"
            >
              {lookupBusy ? "Looking…" : "View grade"}
            </button>
          </div>
          {lookupErr ? (
            <p className="mt-2 text-xs text-red-400">{lookupErr}</p>
          ) : null}
          {lookupResult?.result ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="font-mono text-xl text-cyan-200">
                {lookupResult.result.total_score}/20 · {lookupResult.result.grade}
              </p>
              <p className="mt-2 text-slate-400">{lookupResult.result.verdict}</p>
              <p className="mt-2 text-xs text-amber-200/90">
                {lookupResult.result.level_up_tip}
              </p>
            </div>
          ) : null}
        </div>

        <p className="text-center text-xs text-slate-600">
          <Link href="/training/facilitator/login" className="text-slate-500 hover:text-slate-400">
            Facilitator sign-in
          </Link>
        </p>
      </div>
    </div>
  );
}

function siteDefaultBanner(hub: HubConfig): string {
  if (hub.mode === "builtin") return "Program deck";
  return "This week";
}
