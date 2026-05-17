"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type FacTab = "share" | "submissions" | "assessments";

type Assessment = {
  id: string;
  title: string;
  slug: string;
  subgroupOptions: string[];
  minPromptChars: number;
  minOutputChars: number;
  studentUrlHint: string;
  submissionsOpen: boolean;
  isSiteDefault: boolean;
};

type Submission = {
  id: string;
  submittedAt: string;
  fellowName: string;
  subgroup: string;
  assessmentSlug?: string | null;
  assessmentTitle?: string | null;
  result: {
    total_score: number;
    grade: string;
    verdict: string;
  };
};

type Stats = {
  submissionCount: number;
  assessmentCount: number;
  orphanLegacyCount: number;
  siteDefaultSlug: string | null;
  siteDefaultTitle: string | null;
};

const TAB_LABELS: { id: FacTab; label: string }[] = [
  { id: "share", label: "Share with class" },
  { id: "submissions", label: "Submissions" },
  { id: "assessments", label: "Assessments" },
];

function originUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export default function FacilitatorDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<FacTab>("share");
  const [me, setMe] = useState<{ email: string; displayName: string } | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lockBusy, setLockBusy] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [subOpts, setSubOpts] = useState(
    "Bethel, Carmel, Eden, Gilead, Goshen, Hebron, Israel, Zion, Other / not listed",
  );
  const [intro, setIntro] = useState("");
  const [graderInstructions, setGraderInstructions] = useState("");
  const [mp, setMp] = useState(40);
  const [mo, setMo] = useState(80);

  const siteDefault = useMemo(
    () => assessments.find((a) => a.isSiteDefault) ?? assessments[0] ?? null,
    [assessments],
  );

  const load = useCallback(async () => {
    setErr(null);
    const m = await fetch("/api/training/facilitator/me", { credentials: "include" });
    if (m.status === 401) {
      router.replace("/training/facilitator/login");
      return;
    }
    const mj = (await m.json()) as { email: string; displayName?: string; error?: string };
    if (!m.ok) throw new Error(mj.error || "Session error.");
    setMe({ email: mj.email, displayName: mj.displayName || mj.email });

    const a = await fetch("/api/training/facilitator/assessments", { credentials: "include" });
    const aj = await a.json();
    if (!a.ok) throw new Error(aj.error || "Could not load assessments.");
    const raw = (aj.assessments ?? []) as Partial<Assessment & { isSiteDefault?: boolean }>[];
    setAssessments(
      raw.map((x) => ({
        id: String(x.id),
        title: String(x.title ?? ""),
        slug: String(x.slug ?? ""),
        subgroupOptions: Array.isArray(x.subgroupOptions) ? x.subgroupOptions.map(String) : [],
        minPromptChars: Number(x.minPromptChars ?? 40),
        minOutputChars: Number(x.minOutputChars ?? 80),
        studentUrlHint: String(x.studentUrlHint ?? ""),
        submissionsOpen: x.submissionsOpen !== false,
        isSiteDefault: x.isSiteDefault === true,
      })),
    );

    const s = await fetch("/api/training/facilitator/submissions", { credentials: "include" });
    const sj = await s.json();
    if (!s.ok) throw new Error(sj.error || "Could not load submissions.");
    setSubs((sj.submissions ?? []) as Submission[]);
    const st = (sj as { stats?: Stats }).stats;
    if (st) setStats(st);
  }, [router]);

  const claimLegacy = useCallback(async () => {
    setClaimBusy(true);
    setClaimMsg(null);
    try {
      const res = await fetch("/api/training/facilitator/submissions/claim-legacy", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; moved?: number };
      if (!res.ok) throw new Error(data.error || "Claim failed.");
      setClaimMsg(`Attached ${data.moved ?? 0} prior class submission(s) to your course inbox.`);
      await load();
      setTab("submissions");
    } catch (e) {
      setClaimMsg(e instanceof Error ? e.message : "Claim failed.");
    } finally {
      setClaimBusy(false);
    }
  }, [load]);

  const setSiteDefault = useCallback(
    async (id: string) => {
      setLockBusy(id);
      setErr(null);
      try {
        const res = await fetch(
          `/api/training/facilitator/assessments/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ siteDefault: true }),
          },
        );
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Could not set site default.");
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Update failed.");
      } finally {
        setLockBusy(null);
      }
    },
    [load],
  );

  const setAssessmentOpens = useCallback(
    async (id: string, open: boolean) => {
      setLockBusy(id);
      setErr(null);
      try {
        const res = await fetch(
          `/api/training/facilitator/assessments/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ submissionsOpen: open }),
          },
        );
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Could not update submission window.");
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Update failed.");
      } finally {
        setLockBusy(null);
      }
    },
    [load],
  );

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`Copied ${label}`);
      setTimeout(() => setCopyMsg(null), 2000);
    } catch {
      setCopyMsg("Copy failed — select and copy manually.");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Load failed.");
      }
    })();
  }, [load]);

  if (!me && !err) {
    return (
      <div className="min-h-screen bg-[#07080d] px-4 py-24 text-center text-slate-400">
        Loading trainer console…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080d] px-4 py-8 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row">
        <aside className="lg:w-52 lg:shrink-0">
          <header className="mb-4 border-b border-white/10 pb-4 lg:border-none lg:pb-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400">
              Trainer console
            </p>
            <h1 className="mt-1 text-lg font-bold text-white">{me?.displayName}</h1>
            <p className="text-xs text-slate-500">{me?.email}</p>
            <button
              type="button"
              onClick={() => {
                void fetch("/api/training/facilitator/auth/logout", {
                  method: "POST",
                  credentials: "include",
                }).then(() => router.replace("/training/facilitator/login"));
              }}
              className="mt-3 text-xs text-slate-400 underline hover:text-white"
            >
              Log out
            </button>
          </header>
          <nav className="flex flex-row flex-wrap gap-1 lg:flex-col" aria-label="Trainer sections">
            {TAB_LABELS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  tab === t.id
                    ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/35"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {t.label}
                {t.id === "submissions" && stats ? (
                  <span className="ml-2 font-mono text-xs text-orange-300">
                    {stats.submissionCount}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-6">
          {err ? (
            <p className="rounded-lg border border-red-500/30 bg-red-950/35 px-3 py-2 text-sm text-red-300">
              {err}
            </p>
          ) : null}

          {tab === "share" ? (
            <section className="space-y-4">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5">
                <h2 className="text-lg font-semibold text-cyan-100">Class deck &amp; portal</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Your students use the <strong>site home page</strong> (slides 1–7 + submit portal).
                  When you mark an assessment as <strong>site default</strong>, grades from that URL
                  without <code className="rounded bg-black/40 px-1 font-mono text-xs">?assessment=</code>{" "}
                  attach to your course automatically.
                </p>
                {siteDefault ? (
                  <div className="mt-4 space-y-3">
                    <p className="font-mono text-xs text-emerald-300">
                      Site default: {siteDefault.title} ({siteDefault.slug})
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => void copyText(originUrl("/"), "class deck URL")}
                        className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-[#041018] hover:bg-cyan-500"
                      >
                        Copy class URL (home / slides)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void copyText(
                            originUrl(
                              `/foundry/day03?assessment=${encodeURIComponent(siteDefault.slug)}`,
                            ),
                            "slug URL",
                          )
                        }
                        className="rounded-lg border border-cyan-400/40 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-900/30"
                      >
                        Copy URL with ?assessment=
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-amber-200/90">
                    Publish an assessment under <strong>Assessments</strong>, then click{" "}
                    <strong>Use as site default</strong> so the home page counts as your course.
                  </p>
                )}
                {copyMsg ? <p className="mt-2 text-xs text-cyan-200/80">{copyMsg}</p> : null}
              </div>

              {(stats?.orphanLegacyCount ?? 0) > 0 ? (
                <div className="rounded-2xl border border-amber-500/35 bg-amber-950/25 p-5">
                  <h3 className="font-semibold text-amber-100">
                    {stats!.orphanLegacyCount} submission(s) from class not in your inbox yet
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">
                    These were graded on the deck before they were linked to your facilitator course.
                    One click attaches them to your <strong>site default</strong> assessment.
                  </p>
                  <button
                    type="button"
                    disabled={claimBusy || !siteDefault}
                    onClick={() => void claimLegacy()}
                    className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-[#1a1005] disabled:opacity-45"
                  >
                    {claimBusy ? "Working…" : "Attach class submissions to my course"}
                  </button>
                  {claimMsg ? (
                    <p className="mt-3 text-xs text-amber-100/90">{claimMsg}</p>
                  ) : null}
                </div>
              ) : stats && stats.submissionCount > 0 ? (
                <p className="text-sm text-slate-400">
                  {stats.submissionCount} submission(s) in your inbox. Open{" "}
                  <button
                    type="button"
                    className="text-cyan-300 underline"
                    onClick={() => setTab("submissions")}
                  >
                    Submissions
                  </button>{" "}
                  to review.
                </p>
              ) : null}
            </section>
          ) : null}

          {tab === "submissions" ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">Learner submissions</h2>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="text-xs text-slate-400 underline hover:text-white"
                >
                  Refresh
                </button>
              </div>
              {!subs.length ? (
                <div className="rounded-xl border border-white/10 bg-[#111520] p-6 text-sm text-slate-400">
                  <p>No submissions in your course inbox yet.</p>
                  <p className="mt-2">
                    Share the class URL from <strong>Share with class</strong>, or attach prior work
                    if students already submitted on the home deck.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {subs.map((x) => (
                    <li
                      key={x.id}
                      className="rounded-xl border border-white/10 bg-[#111520] px-4 py-3 text-sm"
                    >
                      <p className="font-medium text-white">
                        {x.fellowName}{" "}
                        <span className="font-normal text-slate-400">· {x.subgroup}</span>
                      </p>
                      <p className="font-mono text-xs text-orange-300">
                        {(x.assessmentTitle || x.assessmentSlug || "Course") +
                          ` · ${x.result.total_score}/20 · ${x.result.grade}`}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {new Date(x.submittedAt).toLocaleString()}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">{x.result.verdict}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {tab === "assessments" ? (
            <section className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-[#111520] p-6">
                <h2 className="text-lg font-semibold text-white">Your assessments</h2>
                {!assessments.length ? (
                  <p className="mt-2 text-sm text-slate-500">None yet — create one below.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {assessments.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-lg border border-white/10 bg-[#0c0e14] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-white">{a.title}</p>
                            <p className="mt-1 font-mono text-xs text-emerald-300">{a.slug}</p>
                            {a.isSiteDefault ? (
                              <span className="mt-2 inline-block rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] text-cyan-200">
                                Site default (home URL)
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!a.isSiteDefault ? (
                              <button
                                type="button"
                                disabled={lockBusy === a.id}
                                onClick={() => void setSiteDefault(a.id)}
                                className="rounded border border-cyan-400/40 px-2 py-1 text-[11px] text-cyan-100"
                              >
                                Use as site default
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={lockBusy === a.id}
                              onClick={() => void setAssessmentOpens(a.id, !a.submissionsOpen)}
                              className="rounded border border-white/20 px-2 py-1 text-[11px]"
                            >
                              {a.submissionsOpen ? "Close submits" : "Re-open"}
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#111520] p-6">
                <h2 className="text-lg font-semibold text-white">Create assessment</h2>
                <form
                  className="mt-4 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setBusy(true);
                    void (async () => {
                      try {
                        const subgroupOptions = subOpts
                          .split(/[,\n]+/)
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const res = await fetch("/api/training/facilitator/assessments", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({
                            title,
                            slug,
                            subgroupOptions,
                            assessmentIntro: intro,
                            graderInstructions,
                            minPromptChars: mp,
                            minOutputChars: mo,
                          }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok)
                          throw new Error((data as { error?: string }).error || "Save failed.");
                        await load();
                        setTitle("");
                        setSlug("");
                        setIntro("");
                        setGraderInstructions("");
                        setTab("share");
                      } catch (er) {
                        setErr(er instanceof Error ? er.message : "Save failed.");
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs text-slate-400">
                      Title
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2"
                        placeholder="Sprint checkpoint"
                      />
                    </label>
                    <label className="block text-xs text-slate-400">
                      URL slug
                      <input
                        value={slug}
                        onChange={(e) =>
                          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                        }
                        required
                        minLength={3}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 font-mono text-emerald-200"
                        placeholder="sprint-architecture"
                      />
                    </label>
                  </div>
                  <label className="block text-xs text-slate-400">
                    Rubric / grading instructions (required)
                    <textarea
                      value={graderInstructions}
                      onChange={(e) => setGraderInstructions(e.target.value)}
                      required
                      rows={10}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 font-mono text-[13px]"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy || graderInstructions.trim().length < 20}
                    className="rounded-lg bg-emerald-500 px-6 py-2 font-semibold text-[#08120c] disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Publish assessment"}
                  </button>
                </form>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
