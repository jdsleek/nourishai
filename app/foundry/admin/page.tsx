"use client";

import { useCallback, useEffect, useState } from "react";

type Submission = {
  id: string;
  submittedAt: string;
  fellowName: string;
  subgroup: string;
  ide: string;
  prompt: string;
  output: string;
  assessmentId?: string | null;
  assessmentSlug?: string | null;
  assessmentTitle?: string | null;
  result: {
    total_score: number;
    grade: string;
    breakdown: Record<string, { score: number; feedback: string }>;
    level_up_tip: string;
    verdict: string;
  };
};

function isLegacyScoreScale(totalScore: number) {
  return totalScore > 20;
}

function breakdownCategoryMax(key: string, legacy: boolean): number {
  if (!legacy) return 10;
  if (key === "environment_setup") return 20;
  return 40;
}

const BREAKDOWN_LABELS: Record<string, string> = {
  prompt_quality: "Prompt quality",
  architecture_viability: "Architecture viability",
  environment_setup: "Environment setup (legacy rubric)",
};

function breakdownRows(
  breakdown: Submission["result"]["breakdown"],
  legacy: boolean
): { key: string; label: string; score: number; max: number; feedback: string }[] {
  const preferred = [
    "prompt_quality",
    "architecture_viability",
    "environment_setup",
  ];
  const keys = [
    ...new Set([...preferred, ...Object.keys(breakdown)]),
  ].filter((k) => k in breakdown);
  return keys.map((key) => {
    const v = breakdown[key]!;
    return {
      key,
      label: BREAKDOWN_LABELS[key] ?? key.replace(/_/g, " "),
      score: v.score,
      max: breakdownCategoryMax(key, legacy),
      feedback: v.feedback,
    };
  });
}

type AdminSection = "submissions" | "ideation";

export default function FoundryAdminPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [section, setSection] = useState<AdminSection>("submissions");
  const [ideationHtml, setIdeationHtml] = useState<string | null>(null);
  const [ideationLoading, setIdeationLoading] = useState(false);
  const [ideationErr, setIdeationErr] = useState<string | null>(null);
  const [ideationReloadKey, setIdeationReloadKey] = useState(0);
  const [facEmail, setFacEmail] = useState("");
  const [facPwd, setFacPwd] = useState("");
  const [facDisplay, setFacDisplay] = useState("");
  const [facBusy, setFacBusy] = useState(false);
  const [facMsg, setFacMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!unlocked || section !== "ideation" || !password) return undefined;
    const controller = new AbortController();
    (async () => {
      setIdeationLoading(true);
      setIdeationErr(null);
      try {
        const res = await fetch("/api/foundry/admin/ideation-registry", {
          headers: { "x-foundry-admin-password": password },
          signal: controller.signal,
        });
        const text = await res.text();
        if (controller.signal.aborted) return;
        if (!res.ok) {
          let msg = text;
          try {
            const j = JSON.parse(text) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            /* plain body */
          }
          setIdeationErr(msg.slice(0, 500));
          setIdeationHtml(null);
        } else {
          setIdeationHtml(text);
          setIdeationErr(null);
        }
      } catch (e: unknown) {
        const name =
          typeof e === "object" && e !== null ? (e as { name?: string }).name : undefined;
        if (name === "AbortError") return;
        setIdeationErr(e instanceof Error ? e.message : "Load failed.");
        setIdeationHtml(null);
      } finally {
        if (!controller.signal.aborted) setIdeationLoading(false);
      }
    })();
    return () => controller.abort();
  }, [unlocked, section, password, ideationReloadKey]);

  const bootstrapFacilitator = useCallback(async () => {
    setFacBusy(true);
    setFacMsg(null);
    try {
      const res = await fetch("/api/foundry/admin/facilitators", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-foundry-admin-password": password,
        },
        body: JSON.stringify({
          email: facEmail.trim(),
          password: facPwd,
          displayName: facDisplay.trim() || facEmail.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok)
        throw new Error(data.error || res.statusText || "Create failed.");
      setFacMsg("Facilitator created. They sign in at /training/facilitator/login.");
      setFacPwd("");
      setFacEmail("");
      setFacDisplay("");
    } catch (e) {
      setFacMsg(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setFacBusy(false);
    }
  }, [facDisplay, facEmail, facPwd, password]);

  const deleteOne = useCallback(
    async (pwd: string, submissionId: string) => {
      setError(null);
      setDeletingId(submissionId);
      try {
        const res = await fetch(
          `/api/foundry/admin/submissions?id=${encodeURIComponent(submissionId)}`,
          {
            method: "DELETE",
            headers: { "x-foundry-admin-password": pwd },
          }
        );
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || res.statusText || "Delete failed.");
        }
        setError(null);
        setSubs((prev) => prev.filter((x) => x.id !== submissionId));
        setExpanded((id) => (id === submissionId ? null : id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed.");
      } finally {
        setDeletingId(null);
      }
    },
    [],
  );

  const load = useCallback(async (pwd: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/foundry/admin/submissions", {
        headers: { "x-foundry-admin-password": pwd },
      });
      const data = (await res.json()) as {
        submissions?: Submission[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not load submissions.");
      }
      setSubs(data.submissions || []);
      setUnlocked(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      setUnlocked(false);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8 border-b border-white/10 pb-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
            Qubators AI Foundry
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">
            Instructor view — Day 03 submissions & cohort ideation
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Organizer / admin inbox: submissions from learners on the portal (legacy
            built-in rubric and facilitator-authored assessments) plus the cohort
            ideation registry. Requires{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs">
              DATABASE_URL
            </code>
            ,
            {" "}
            <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs">
              FOUNDRY_ADMIN_PASSWORD
            </code>
            ,
            {" "}
            <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs">
              FACILITATOR_SESSION_SECRET
            </code>{" "}
            for facilitator dashboards.
          </p>
        </header>

        {!unlocked ? (
          <form
            className="mx-auto max-w-md space-y-4 rounded-xl border border-white/10 bg-[#111520] p-6"
            onSubmit={(e) => {
              e.preventDefault();
              void load(password);
            }}
          >
            <label className="block text-sm font-medium text-slate-300">
              Admin password
            </label>
            <input
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-3 text-slate-100 outline-none focus:border-orange-400"
              placeholder="Enter password"
            />
            {error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-lg bg-orange-500 py-3 font-semibold text-[#0a0a0c] disabled:opacity-50"
            >
              {loading ? "Checking…" : "Unlock"}
            </button>
          </form>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                {section === "submissions" ? (
                  <p className="font-mono text-sm text-cyan-300">
                    {subs.length} submission{subs.length === 1 ? "" : "s"}
                  </p>
                ) : (
                  <p className="font-mono text-sm text-slate-500">
                    Cohort ideation (from CSV rebuild)
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setUnlocked(false);
                    setSubs([]);
                    setPassword("");
                    setSection("submissions");
                    setIdeationHtml(null);
                    setIdeationErr(null);
                  }}
                  className="text-sm text-slate-400 underline hover:text-white"
                >
                  Lock
                </button>
                {section === "submissions" ? (
                  <button
                    type="button"
                    disabled={loading || deletingId !== null}
                    onClick={() => void load(password)}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
                  >
                    Refresh submissions
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={ideationLoading || deletingId !== null}
                    onClick={() => setIdeationReloadKey((k) => k + 1)}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
                  >
                    Reload registry HTML
                  </button>
                )}
              </div>
              <div
                role="tablist"
                aria-label="Admin section"
                className="flex flex-wrap gap-2"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={section === "submissions"}
                  onClick={() => setSection("submissions")}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    section === "submissions"
                      ? "border-orange-400/70 bg-orange-500/15 text-orange-100"
                      : "border-white/15 text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  Portal submissions
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={section === "ideation"}
                  onClick={() => setSection("ideation")}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    section === "ideation"
                      ? "border-orange-400/70 bg-orange-500/15 text-orange-100"
                      : "border-white/15 text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  QAF ideation registry
                </button>
              </div>
            </div>

            {section === "submissions" ? (
              <details className="mb-6 rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-4 text-sm">
                <summary className="cursor-pointer font-semibold text-emerald-200">
                  Organizer: create facilitator account
                </summary>
                <p className="mt-2 text-slate-400">
                  Sends credentials securely over HTTPS once. Requires Postgres on the
                  host. Share{" "}
                  <code className="rounded bg-white/10 px-1 font-mono text-xs">
                    /training/facilitator/login
                  </code>{" "}
                  with trainers.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-slate-400">
                    Email
                    <input
                      type="email"
                      value={facEmail}
                      onChange={(e) => setFacEmail(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 text-slate-100"
                    />
                  </label>
                  <label className="block text-xs text-slate-400">
                    Display name
                    <input
                      type="text"
                      value={facDisplay}
                      onChange={(e) => setFacDisplay(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 text-slate-100"
                    />
                  </label>
                </div>
                <label className="mt-3 block text-xs text-slate-400">
                  Initial password (≥ 10 chars; facilitator changes later if you rotate)
                  <input
                    type="password"
                    value={facPwd}
                    onChange={(e) => setFacPwd(e.target.value)}
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 text-slate-100"
                  />
                </label>
                <button
                  type="button"
                  disabled={facBusy || !facEmail || facPwd.length < 10 || !password}
                  onClick={() => void bootstrapFacilitator()}
                  className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-[#08120c] disabled:opacity-45"
                >
                  {facBusy ? "Saving…" : "Create facilitator"}
                </button>
                {facMsg ? (
                  <p className="mt-3 whitespace-pre-wrap text-xs text-emerald-200/90">
                    {facMsg}
                  </p>
                ) : null}
              </details>
            ) : null}

            {error ? (
              <p className="mb-4 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            ) : null}

            {section === "submissions" ? (
              subs.length === 0 ? (
                <p className="text-slate-400">No submissions stored yet.</p>
              ) : (
                <ul className="space-y-4">
                  {subs.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-xl border border-white/10 bg-[#111520] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">
                            {s.fellowName}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            <span className="text-orange-300">{s.subgroup}</span>
                            {" · "}
                            <time dateTime={s.submittedAt}>
                              {new Date(s.submittedAt).toLocaleString()}
                            </time>
                          </p>
                          <p className="mt-1 text-xs font-mono text-slate-500">
                            {s.assessmentSlug
                              ? `Assessment: ${s.assessmentTitle || s.assessmentSlug} · slug ${s.assessmentSlug}`
                              : "Assessment: legacy built‑in Foundry / Day‑03 rubric"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xl font-bold text-white">
                            {s.result.total_score}
                          </span>
                          <span className="text-slate-500">
                            /{isLegacyScoreScale(s.result.total_score) ? 100 : 20}
                          </span>
                          <p className="font-mono text-sm text-amber-300">
                            {s.result.grade}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">
                        {s.result.verdict}
                      </p>
                      <p className="mt-2 font-mono text-[10px] text-slate-600">
                        id {s.id}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          className="text-xs font-mono text-cyan-400 hover:underline"
                          onClick={() =>
                            setExpanded((id) => (id === s.id ? null : s.id))
                          }
                        >
                          {expanded === s.id ? "Hide details ↑" : "Show full text ↓"}
                        </button>
                        <button
                          type="button"
                          disabled={loading || deletingId !== null}
                          className="rounded-md border border-red-500/50 bg-red-950/40 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-900/35 disabled:opacity-40"
                          onClick={() => {
                            if (
                              !confirm(
                                `Permanently delete submission for "${s.fellowName}" (${s.subgroup})? This cannot be undone.`,
                              )
                            ) {
                              return;
                            }
                            void deleteOne(password, s.id);
                          }}
                        >
                          {deletingId === s.id ? "Deleting…" : "Delete submission"}
                        </button>
                      </div>
                      {expanded === s.id ? (
                        <div className="mt-4 space-y-4 border-t border-white/10 pt-4 text-sm">
                          <div>
                            <h3 className="font-mono text-xs uppercase text-slate-500">
                              Workspace
                            </h3>
                            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-slate-300">
                              {s.ide}
                            </pre>
                          </div>
                          <div>
                            <h3 className="font-mono text-xs uppercase text-slate-500">
                              Prompt
                            </h3>
                            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-slate-300">
                              {s.prompt}
                            </pre>
                          </div>
                          <div>
                            <h3 className="font-mono text-xs uppercase text-slate-500">
                              Architecture output
                            </h3>
                            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-slate-300">
                              {s.output}
                            </pre>
                          </div>
                          <div>
                            <h3 className="font-mono text-xs uppercase text-slate-500">
                              Rubric
                            </h3>
                            <ul className="mt-2 space-y-2 text-slate-400">
                              {breakdownRows(
                                s.result.breakdown,
                                isLegacyScoreScale(s.result.total_score),
                              ).map((row) => (
                                <li key={row.key}>
                                  <strong className="text-slate-300">
                                    {row.label}
                                  </strong>
                                  : {row.score}/{row.max} — {row.feedback}
                                </li>
                              ))}
                            </ul>
                            <p className="mt-3 text-amber-200/90">
                              Tip: {s.result.level_up_tip}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )
            )
            : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Regenerated from CSV with{" "}
                  <code className="rounded bg-white/10 px-1 font-mono">
                    npm run build:qaf-registry
                  </code>{" "}
                  — template lives in{" "}
                  <code className="rounded bg-white/10 px-1 font-mono">
                    registry/qaf-product-ideation-registry.html
                  </code>
                  .
                </p>
                {ideationLoading ? (
                  <p className="text-sm text-slate-400">Loading registry…</p>
                ) : null}
                {ideationErr ? (
                  <p className="rounded-lg border border-red-500/40 bg-red-950/35 px-3 py-2 text-sm text-red-300">
                    {ideationErr}
                  </p>
                ) : null}
                {ideationHtml ? (
                  <iframe
                    title="QAF product ideation registry"
                    sandbox="allow-scripts allow-same-origin"
                    srcDoc={ideationHtml}
                    className="min-h-[80vh] w-full rounded-xl border border-white/10 bg-[#080a10]"
                  />
                ) : !ideationLoading && !ideationErr ? (
                  <p className="text-sm text-slate-500">
                    Nothing loaded yet — try Reload registry HTML if this stays blank.
                  </p>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
