"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Assessment = {
  id: string;
  title: string;
  slug: string;
  subgroupOptions: string[];
  minPromptChars: number;
  minOutputChars: number;
  studentUrlHint: string;
  /** When false, learners cannot POST new grades for this slug. */
  submissionsOpen: boolean;
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

export default function FacilitatorDashboard() {
  const router = useRouter();
  const [me, setMe] = useState<{ email: string; displayName: string } | null>(
    null,
  );
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lockBusy, setLockBusy] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [subOpts, setSubOpts] = useState(
    "Bethel, Carmel, Eden, Gilead, Goshen, Hebron, Israel, Zion, Other / not listed",
  );
  const [intro, setIntro] = useState("");
  const [graderInstructions, setGraderInstructions] = useState("");
  const [mp, setMp] = useState(40);
  const [mo, setMo] = useState(80);

  const load = useCallback(async () => {
    setErr(null);
    const m = await fetch("/api/training/facilitator/me", {
      credentials: "include",
    });
    if (m.status === 401) {
      router.replace("/training/facilitator/login");
      return;
    }
    const mj = (await m.json()) as {
      email: string;
      displayName?: string;
      error?: string;
    };
    if (!m.ok) throw new Error(mj.error || "Session error.");
    setMe({ email: mj.email, displayName: mj.displayName || mj.email });

    const a = await fetch("/api/training/facilitator/assessments", {
      credentials: "include",
    });
    const aj = await a.json();
    if (!a.ok) throw new Error(aj.error || "Could not load assessments.");
    const raw = (aj.assessments ?? []) as Partial<Assessment>[];
    setAssessments(
      raw.map((x) => ({
        ...x,
        id: String(x.id),
        title: String(x.title ?? ""),
        slug: String(x.slug ?? ""),
        subgroupOptions: Array.isArray(x.subgroupOptions)
          ? x.subgroupOptions.map(String)
          : [],
        minPromptChars: Number(x.minPromptChars ?? 40),
        minOutputChars: Number(x.minOutputChars ?? 80),
        studentUrlHint: String(x.studentUrlHint ?? ""),
        submissionsOpen: x.submissionsOpen !== false,
      })) as Assessment[],
    );

    const s = await fetch("/api/training/facilitator/submissions", {
      credentials: "include",
    });
    const sj = await s.json();
    if (!s.ok) throw new Error(sj.error || "Could not load submissions.");
    setSubs((sj.submissions ?? []) as Submission[]);
  }, [router]);

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
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Could not update submission window.");
        }
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Update failed.");
      } finally {
        setLockBusy(null);
      }
    },
    [load],
  );

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
    <div className="min-h-screen bg-[#07080d] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
              Trainer console
            </p>
            <h1 className="mt-2 text-2xl font-bold">
              Assessments · {me?.displayName}
            </h1>
            <p className="mt-2 text-sm text-slate-400">{me?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void fetch("/api/training/facilitator/auth/logout", {
                method: "POST",
                credentials: "include",
              }).then(() => router.replace("/training/facilitator/login"));
            }}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
          >
            Log out
          </button>
        </header>

        {err ? (
          <p className="rounded-lg border border-red-500/30 bg-red-950/35 px-3 py-2 text-sm text-red-300">
            {err}
          </p>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-[#111520] p-6">
          <h2 className="text-lg font-semibold text-white">
            Create facilitator assessment
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Students open <code className="rounded bg-white/10 px-1">/foundry/day03</code>{" "}
            with{" "}
            <code className="rounded bg-white/10 px-1">?assessment=your-slug</code>.
          </p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              void (async () => {
                try {
                  const subgroupOptions = subOpts
                    .split(/[,\\n]+/)
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
                    throw new Error(
                      (data as { error?: string }).error || "Save failed.",
                    );
                  await load();
                  setTitle("");
                  setSlug("");
                  setIntro("");
                  setGraderInstructions("");
                  setMp(40);
                  setMo(80);
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
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 text-slate-100"
                  placeholder="Sprint checkpoint"
                />
              </label>
              <label className="block text-xs text-slate-400">
                URL slug
                <input
                  value={slug}
                  onChange={(e) =>
                    setSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    )
                  }
                  required
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 font-mono text-sm text-emerald-200"
                  placeholder="sprint-architecture"
                  minLength={3}
                />
              </label>
            </div>
            <label className="block text-xs text-slate-400">
              Subgroup list (comma or newline; blank → cohort defaults)
              <textarea
                value={subOpts}
                onChange={(e) => setSubOpts(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 font-mono text-sm text-slate-200"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs text-slate-400">
                Min prompt chars
                <input
                  type="number"
                  min={10}
                  value={mp}
                  onChange={(e) => setMp(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 text-slate-100"
                />
              </label>
              <label className="block text-xs text-slate-400">
                Min output chars
                <input
                  type="number"
                  min={40}
                  value={mo}
                  onChange={(e) => setMo(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 text-slate-100"
                />
              </label>
            </div>
            <label className="block text-xs text-slate-400">
              Context for learner / grader (optional)
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 text-slate-200"
              />
            </label>
            <label className="block text-xs text-slate-400">
              Rubric / grading prose (authority for the AI grader — same JSON result shape)
              <textarea
                value={graderInstructions}
                onChange={(e) => setGraderInstructions(e.target.value)}
                required
                rows={14}
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 font-mono text-[13px] leading-relaxed text-slate-200"
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
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Learner submissions (yours)</h2>
          {!subs.length ? (
            <p className="text-sm text-slate-500">Nothing stored yet.</p>
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
                    {(x.assessmentTitle || x.assessmentSlug || "Assessment") +
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

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Your assessment links</h2>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs text-slate-400 underline hover:text-white"
            >
              Refresh
            </button>
          </div>
          {!assessments.length ? (
            <p className="text-sm text-slate-500">Publish at least one row above.</p>
          ) : (
            <ul className="space-y-2">
              {assessments.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-white/10 bg-[#111520] px-4 py-3 text-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 font-mono text-xs text-emerald-200">
                      <span className="text-base font-semibold text-white">
                        {a.title}
                      </span>
                      <p className="mt-1 break-all">{a.studentUrlHint}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide ${
                          a.submissionsOpen
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {a.submissionsOpen ? "Open" : "Closed"}
                      </span>
                      <button
                        type="button"
                        disabled={lockBusy === a.id || busy}
                        onClick={() => void setAssessmentOpens(a.id, false)}
                        className="rounded-lg border border-red-400/35 bg-red-950/35 px-2.5 py-1 text-[11px] font-semibold text-red-100 hover:bg-red-900/30 disabled:opacity-40"
                      >
                        {lockBusy === a.id ? "…" : "Close"}
                      </button>
                      <button
                        type="button"
                        disabled={lockBusy === a.id || busy}
                        onClick={() => void setAssessmentOpens(a.id, true)}
                        className="rounded-lg border border-emerald-400/35 bg-emerald-950/35 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-900/25 disabled:opacity-40"
                      >
                        {lockBusy === a.id ? "…" : "Re-open"}
                      </button>
                    </div>
                  </div>
                  <details className="mt-3 text-[11px] text-slate-400">
                    <summary className="cursor-pointer font-mono hover:text-emerald-200">
                      Subgroup allow-list
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap text-slate-500">
                      {a.subgroupOptions.join(", ")}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
