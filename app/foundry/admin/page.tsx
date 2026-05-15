"use client";

import { useCallback, useState } from "react";

type Submission = {
  id: string;
  submittedAt: string;
  fellowName: string;
  subgroup: string;
  ide: string;
  prompt: string;
  output: string;
  result: {
    total_score: number;
    grade: string;
    breakdown: Record<string, { score: number; feedback: string }>;
    level_up_tip: string;
    verdict: string;
  };
};

export default function FoundryAdminPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

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
            Instructor view — Day 03 submissions
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Not linked in the public app. Authorized staff only. Default access
            password is set server-side; override with{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs">
              FOUNDRY_ADMIN_PASSWORD
            </code>{" "}
            on Railway if needed.
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
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <p className="font-mono text-sm text-cyan-300">
                {subs.length} submission{subs.length === 1 ? "" : "s"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setUnlocked(false);
                  setSubs([]);
                  setPassword("");
                }}
                className="text-sm text-slate-400 underline hover:text-white"
              >
                Lock
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void load(password)}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
              >
                Refresh
              </button>
            </div>

            {subs.length === 0 ? (
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
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xl font-bold text-white">
                          {s.result.total_score}
                        </span>
                        <span className="text-slate-500">/100</span>
                        <p className="font-mono text-sm text-amber-300">
                          {s.result.grade}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">
                      {s.result.verdict}
                    </p>
                    <button
                      type="button"
                      className="mt-3 text-xs font-mono text-cyan-400 hover:underline"
                      onClick={() =>
                        setExpanded((id) => (id === s.id ? null : s.id))
                      }
                    >
                      {expanded === s.id ? "Hide details ↑" : "Show full text ↓"}
                    </button>
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
                            {Object.entries(s.result.breakdown).map(
                              ([k, v]) => (
                                <li key={k}>
                                  <strong className="text-slate-300">
                                    {k}
                                  </strong>
                                  : {v.score} — {v.feedback}
                                </li>
                              )
                            )}
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
