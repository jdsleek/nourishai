"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type HubConfig = {
  programName: string;
  deckPath: string;
  slugDeckPath?: string;
  workbookPath: string;
  assessmentSlug: string | null;
  assessmentTitle: string | null;
  submissionsOpen: boolean;
  siteDefaultActive: boolean;
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

function readStore(): {
  lastGrade?: SavedGrade;
} {
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

export default function ClassHubPage() {
  const [hub, setHub] = useState<HubConfig | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastGrade, setLastGrade] = useState<SavedGrade | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<SavedGrade | null>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);

  const loadHub = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/foundry/class-hub");
    const data = (await res.json()) as HubConfig & { error?: string };
    if (!res.ok) throw new Error(data.error || "Could not load class info.");
    setHub(data);
  }, []);

  useEffect(() => {
    setLastGrade(readStore().lastGrade ?? null);
    void loadHub().catch((e) =>
      setErr(e instanceof Error ? e.message : "Load failed."),
    );
  }, [loadHub]);

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

  const deckHref = hub?.deckPath ?? "/";
  const openForSubmit = hub?.submissionsOpen !== false;

  return (
    <div className="min-h-screen bg-[#07080d] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-lg space-y-8">
        <header>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-400">
            {hub?.programName ?? "Qubators AI Foundry"}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Class hub</h1>
          <p className="mt-2 text-sm text-slate-400">
            Everything you need for this week&apos;s architecture lab — slides,
            submit portal, and your private workbook.
          </p>
        </header>

        {err ? (
          <p className="rounded-lg border border-red-500/30 bg-red-950/35 px-3 py-2 text-sm text-red-300">
            {err}
          </p>
        ) : null}

        {!hub && !err ? (
          <p className="text-sm text-slate-500">Loading class info…</p>
        ) : null}

        {hub ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300/80">
                This week
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {hub.assessmentTitle ?? "Day 03 — AI Builder"}
              </p>
              {hub.assessmentSlug ? (
                <p className="mt-1 font-mono text-xs text-slate-500">
                  Course: {hub.assessmentSlug}
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
              <Link
                href={deckHref}
                className="block rounded-xl bg-orange-500 px-5 py-4 text-center text-sm font-semibold text-[#0a0a0c] hover:bg-orange-400"
              >
                Open class slides &amp; submit portal
              </Link>
              <Link
                href={hub.workbookPath}
                className="block rounded-xl border border-white/15 px-5 py-4 text-center text-sm font-medium text-slate-200 hover:bg-white/5"
              >
                Class workbook (notes on this device)
              </Link>
            </div>
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
            <Link
              href="/"
              className="mt-4 inline-block text-xs text-cyan-300 underline"
            >
              Open deck to submit again
            </Link>
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
