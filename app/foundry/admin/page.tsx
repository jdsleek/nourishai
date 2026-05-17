"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminNav, type AdminNavSection } from "@/components/foundry/AdminNav";
import {
  DashboardStatCard,
  DashboardStatGrid,
} from "@/components/foundry/DashboardStatGrid";

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

/** Same learner URLs as facilitator “Share” — admin can copy full absolute links. */
function facilitatorLearnerDeckPath(slug: string) {
  return `/foundry/day03?assessment=${encodeURIComponent(slug)}`;
}

function facilitatorClassHubPath(slug: string) {
  return `/learn/${encodeURIComponent(slug)}`;
}

function adminOriginAbs(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

type AssessmentLockRow = {
  id: string;
  slug: string;
  title: string;
  facilitatorId: string;
  facilitatorEmail: string;
  submissionsOpen: boolean;
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

type AdminSection = AdminNavSection;

/** Must stay in sync with API `confirm` checker */
const LEGACY_LINK_CONFIRM_PHRASE = "LINK_ALL_LEGACY_SUBMISSIONS";

type FacAdminRow = {
  id: string;
  email: string;
  displayName: string;
  assessmentCount: number;
};

export default function FoundryAdminPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assessmentDeletingId, setAssessmentDeletingId] = useState<string | null>(
    null,
  );
  const [section, setSection] = useState<AdminSection>("overview");
  const [ideationHtml, setIdeationHtml] = useState<string | null>(null);
  const [ideationLoading, setIdeationLoading] = useState(false);
  const [ideationErr, setIdeationErr] = useState<string | null>(null);
  const [ideationReloadKey, setIdeationReloadKey] = useState(0);
  const [facEmail, setFacEmail] = useState("");
  const [facPwd, setFacPwd] = useState("");
  const [facDisplay, setFacDisplay] = useState("");
  const [facBusy, setFacBusy] = useState(false);
  const [facMsg, setFacMsg] = useState<string | null>(null);
  const [locks, setLocks] = useState<AssessmentLockRow[]>([]);
  const [locksLoading, setLocksLoading] = useState(false);
  const [locksErr, setLocksErr] = useState<string | null>(null);
  const [lockToggling, setLockToggling] = useState<string | null>(null);
  const [facilitators, setFacilitators] = useState<FacAdminRow[]>([]);
  const [facDirLoading, setFacDirLoading] = useState(false);
  const [facDirErr, setFacDirErr] = useState<string | null>(null);
  const [updEmail, setUpdEmail] = useState("");
  const [updPwd, setUpdPwd] = useState("");
  const [updDisplay, setUpdDisplay] = useState("");
  const [updApplyDisplay, setUpdApplyDisplay] = useState(false);
  const [updBusy, setUpdBusy] = useState(false);
  const [updMsg, setUpdMsg] = useState<string | null>(null);
  const [moveOwnerChoice, setMoveOwnerChoice] = useState<Record<string, string>>(
    {},
  );
  const [ownerMoveBusy, setOwnerMoveBusy] = useState<string | null>(null);
  const [legacyCount, setLegacyCount] = useState<number | null>(null);
  const [legacyTargetId, setLegacyTargetId] = useState("");
  const [legacyMsg, setLegacyMsg] = useState<string | null>(null);
  const [legacyBusy, setLegacyBusy] = useState(false);
  const [legacyConfirm, setLegacyConfirm] = useState("");
  const [linkCopyMsg, setLinkCopyMsg] = useState<string | null>(null);

  const linkedSubmissionCount = useMemo(
    () => subs.filter((s) => s.assessmentSlug || s.assessmentId).length,
    [subs],
  );
  const openAssessmentCount = useMemo(
    () => locks.filter((l) => l.submissionsOpen).length,
    [locks],
  );
  const latestSubmissionLabel = useMemo(() => {
    if (!subs.length) return "—";
    const latest = subs.reduce((a, b) =>
      new Date(a.submittedAt) > new Date(b.submittedAt) ? a : b,
    );
    return new Date(latest.submittedAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [subs]);

  const copyPublicTrainingUrl = useCallback(
    async (relativePath: string, label: string) => {
      try {
        await navigator.clipboard.writeText(adminOriginAbs(relativePath));
        setLinkCopyMsg(`Copied ${label}`);
        window.setTimeout(() => setLinkCopyMsg(null), 2200);
      } catch {
        setLinkCopyMsg("Copy failed — select text manually.");
        window.setTimeout(() => setLinkCopyMsg(null), 3200);
      }
    },
    [],
  );

  const loadLegacyStats = useCallback(async (pwd: string) => {
    try {
      const res = await fetch("/api/foundry/admin/submissions-link-legacy", {
        headers: { "x-foundry-admin-password": pwd },
      });
      const data = (await res.json()) as { legacyCount?: number; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load legacy stats.");
      setLegacyCount(Number(data.legacyCount ?? 0));
    } catch {
      setLegacyCount(null);
    }
  }, []);

  const loadLocks = useCallback(async (pwd: string) => {
    setLocksLoading(true);
    setLocksErr(null);
    try {
      const res = await fetch("/api/foundry/admin/assessment-locks", {
        headers: { "x-foundry-admin-password": pwd },
      });
      const data = (await res.json()) as {
        assessments?: AssessmentLockRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not load assignment locks.");
      }
      setLocks(data.assessments || []);
    } catch (e) {
      setLocksErr(e instanceof Error ? e.message : "Lock list failed.");
      setLocks([]);
    } finally {
      setLocksLoading(false);
    }
  }, []);

  const loadFacilitators = useCallback(async (pwd: string) => {
    setFacDirLoading(true);
    setFacDirErr(null);
    try {
      const res = await fetch("/api/foundry/admin/facilitators", {
        headers: { "x-foundry-admin-password": pwd },
      });
      const data = (await res.json()) as {
        facilitators?: FacAdminRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not load facilitators.");
      }
      setFacilitators(data.facilitators || []);
    } catch (e) {
      setFacDirErr(e instanceof Error ? e.message : "Facilitator list failed.");
      setFacilitators([]);
    } finally {
      setFacDirLoading(false);
    }
  }, []);

  const toggleAssessmentLock = useCallback(
    async (
      pwd: string,
      assessmentId: string,
      submissionsOpen: boolean,
    ) => {
      setLockToggling(assessmentId);
      setLocksErr(null);
      try {
        const res = await fetch("/api/foundry/admin/assessment-locks", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-foundry-admin-password": pwd,
          },
          body: JSON.stringify({ assessmentId, submissionsOpen }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Update failed.");
        }
        setLocks((prev) =>
          prev.map((x) =>
            x.id === assessmentId ? { ...x, submissionsOpen } : x,
          ),
        );
      } catch (e) {
        setLocksErr(e instanceof Error ? e.message : "Toggle failed.");
      } finally {
        setLockToggling(null);
      }
    },
    [],
  );

  const moveAssessmentOwner = useCallback(
    async (pwd: string, assessmentId: string, targetFacilitatorId: string) => {
      setOwnerMoveBusy(assessmentId);
      setLocksErr(null);
      try {
        const res = await fetch("/api/foundry/admin/assessment-owner", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-foundry-admin-password": pwd,
          },
          body: JSON.stringify({ assessmentId, targetFacilitatorId }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Reassign failed.");
        }
        setMoveOwnerChoice((prev) => {
          const next = { ...prev };
          delete next[assessmentId];
          return next;
        });
        await Promise.all([loadLocks(pwd), loadFacilitators(pwd)]);
      } catch (e) {
        setLocksErr(e instanceof Error ? e.message : "Reassign failed.");
      } finally {
        setOwnerMoveBusy(null);
      }
    },
    [loadLocks, loadFacilitators],
  );

  useEffect(() => {
    if (!locks.length) return;
    setLegacyTargetId((prev) => prev || locks[0]!.id);
  }, [locks]);

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
      void loadFacilitators(password);
    } catch (e) {
      setFacMsg(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setFacBusy(false);
    }
  }, [facDisplay, facEmail, facPwd, password, loadFacilitators]);

  const patchFacilitatorCreds = useCallback(async () => {
    const emailTrim = updEmail.trim().toLowerCase();
    if (!emailTrim.includes("@")) {
      setUpdMsg("Enter a facilitator email.");
      return;
    }
    const pwdTrim = updPwd.trim();
    if (pwdTrim.length > 0 && pwdTrim.length < 10) {
      setUpdMsg("New password must be at least 10 characters (or leave blank).");
      return;
    }

    const body: { email: string; password?: string; displayName?: string } = {
      email: emailTrim,
    };
    if (pwdTrim.length >= 10) body.password = pwdTrim;
    if (updApplyDisplay)
      Object.assign(body, { displayName: updDisplay.trim() });

    if (!body.password && !("displayName" in body)) {
      setUpdMsg(
        'Set a new password (≥10 chars) and/or check "Update display name".',
      );
      return;
    }

    setUpdBusy(true);
    setUpdMsg(null);
    try {
      const res = await fetch("/api/foundry/admin/facilitators", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-foundry-admin-password": password,
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText || "Update failed.");
      setUpdMsg("Credentials updated.");
      setUpdPwd("");
      await loadFacilitators(password);
    } catch (e) {
      setUpdMsg(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setUpdBusy(false);
    }
  }, [
    password,
    loadFacilitators,
    updEmail,
    updPwd,
    updDisplay,
    updApplyDisplay,
  ]);

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
      void loadLocks(pwd);
      void loadFacilitators(pwd);
      void loadLegacyStats(pwd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      setUnlocked(false);
    } finally {
      setLoading(false);
    }
  }, [loadLocks, loadFacilitators, loadLegacyStats]);

  const deleteAssessmentRow = useCallback(
    async (pwd: string, row: AssessmentLockRow) => {
      const msg = [
        `Delete assessment "${row.title}" (${row.slug})?`,
        "",
        "Learner URLs for this slug stop working until someone publishes an assessment with the same slug.",
        "",
        "Submissions tied to this course remain in the ledger but lose their assessment link (shown as unlinked — like legacy imports).",
        "",
        "This cannot be undone.",
      ].join("\n");
      if (!window.confirm(msg)) return;

      setAssessmentDeletingId(row.id);
      setLocksErr(null);
      try {
        const res = await fetch(
          `/api/foundry/admin/assessments/${encodeURIComponent(row.id)}`,
          {
            method: "DELETE",
            headers: { "x-foundry-admin-password": pwd },
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          submissionsUnlinked?: number;
        };
        if (!res.ok) {
          throw new Error(data.error || res.statusText || "Delete failed.");
        }
        setMoveOwnerChoice((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
        await load(pwd);
        const n =
          typeof data.submissionsUnlinked === "number" ? data.submissionsUnlinked : 0;
        if (n > 0) {
          window.alert(
            `Assessment deleted · ${n} submission(s) are now unlinked (still visible in ledger).`,
          );
        }
      } catch (e) {
        setLocksErr(e instanceof Error ? e.message : "Delete failed.");
      } finally {
        setAssessmentDeletingId(null);
      }
    },
    [load],
  );

  const runLegacyDryRunOrLink = useCallback(
    async (pwd: string, mode: "dry" | "commit") => {
      if (!legacyTargetId) {
        setLegacyMsg("Choose a facilitator assessment slug first.");
        return;
      }
      setLegacyBusy(true);
      setLegacyMsg(null);
      try {
        if (mode === "dry") {
          const res = await fetch("/api/foundry/admin/submissions-link-legacy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-foundry-admin-password": pwd,
            },
            body: JSON.stringify({
              toAssessmentId: legacyTargetId,
              dryRun: true,
            }),
          });
          const data = (await res.json()) as {
            wouldLink?: number;
            error?: string;
          };
          if (!res.ok)
            throw new Error(data.error || "Preview failed.");
          setLegacyMsg(
            `Dry run: ${data.wouldLink ?? 0} legacy row(s) would attach to selected assessment.`,
          );
          await loadLegacyStats(pwd);
          return;
        }
        const res = await fetch("/api/foundry/admin/submissions-link-legacy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-foundry-admin-password": pwd,
          },
          body: JSON.stringify({
            toAssessmentId: legacyTargetId,
            dryRun: false,
            confirm: legacyConfirm.trim(),
          }),
        });
        const data = (await res.json()) as {
          moved?: number;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Link failed.");
        setLegacyMsg(
          `Attached ${data.moved ?? 0} legacy cohort row(s); trainers who own this assessment inbox will see them after refresh.`,
        );
        await loadLegacyStats(pwd);
        await load(pwd);
      } catch (e) {
        setLegacyMsg(e instanceof Error ? e.message : "Operation failed.");
      } finally {
        setLegacyBusy(false);
      }
    },
    [legacyTargetId, legacyConfirm, loadLegacyStats, load],
  );

  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8 border-b border-white/10 pb-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
            Qubators AI Foundry
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">Organizer console</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Cohort submissions, facilitator accounts, assessment controls, and the
            private ideation registry. Sign in with your organizer password.
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
              Organizer password
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
                <p className="font-mono text-sm text-cyan-300">
                  {section === "overview"
                    ? "Cohort snapshot"
                    : section === "submissions"
                      ? `${subs.length} submission${subs.length === 1 ? "" : "s"}`
                      : section === "facilitators"
                        ? `${facilitators.length} facilitator${facilitators.length === 1 ? "" : "s"}`
                        : section === "assessments"
                          ? `${locks.length} assessment${locks.length === 1 ? "" : "s"}`
                          : "Ideation registry"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setUnlocked(false);
                    setSubs([]);
                    setLocks([]);
                    setLocksErr(null);
                    setFacilitators([]);
                    setFacDirErr(null);
                    setMoveOwnerChoice({});
                    setUpdMsg(null);
                    setLegacyCount(null);
                    setLegacyTargetId("");
                    setLegacyMsg(null);
                    setLegacyConfirm("");
                    setPassword("");
                    setSection("overview");
                    setIdeationHtml(null);
                    setIdeationErr(null);
                    setLinkCopyMsg(null);
                  }}
                  className="text-sm text-slate-400 underline hover:text-white"
                >
                  Close admin panel
                </button>
                {section === "ideation" ? (
                  <button
                    type="button"
                    disabled={ideationLoading || deletingId !== null}
                    onClick={() => setIdeationReloadKey((k) => k + 1)}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
                  >
                    Reload registry HTML
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={loading || deletingId !== null}
                    onClick={() => {
                      void load(password);
                      void loadLocks(password);
                      void loadFacilitators(password);
                      void loadLegacyStats(password);
                    }}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
                  >
                    Refresh data
                  </button>
                )}
              </div>
            </div>

            {linkCopyMsg ? (
              <p className="mb-4 rounded-lg border border-cyan-500/30 bg-cyan-950/25 px-3 py-2 text-xs text-cyan-100">
                {linkCopyMsg}
              </p>
            ) : null}

            <div className="flex flex-col gap-6 lg:flex-row">
              <AdminNav
                section={section}
                onSection={setSection}
                submissionCount={subs.length}
                facilitatorCount={facilitators.length}
              />
              <div className="min-w-0 flex-1">
            {section === "overview" ? (
              <section className="mb-8 space-y-6">
                <DashboardStatGrid>
                  <DashboardStatCard
                    label="Total submissions"
                    value={subs.length}
                    hint={`${linkedSubmissionCount} linked to a facilitator course`}
                    tone="cyan"
                    onClick={() => setSection("submissions")}
                  />
                  <DashboardStatCard
                    label="Unlinked (deck-only)"
                    value={legacyCount ?? "—"}
                    hint={
                      (legacyCount ?? 0) > 0
                        ? "Needs legacy link under Assessments"
                        : "All rows tied to a course"
                    }
                    tone={(legacyCount ?? 0) > 0 ? "amber" : "emerald"}
                    onClick={() => setSection("assessments")}
                  />
                  <DashboardStatCard
                    label="Facilitators"
                    value={facilitators.length}
                    hint="Trainer accounts"
                    tone="orange"
                    onClick={() => setSection("facilitators")}
                  />
                  <DashboardStatCard
                    label="Assessments"
                    value={locks.length}
                    hint={`${openAssessmentCount} accepting new submits`}
                    tone="slate"
                    onClick={() => setSection("assessments")}
                  />
                </DashboardStatGrid>
                <div className="rounded-xl border border-white/10 bg-[#111520] p-5 text-sm">
                  <p className="font-semibold text-white">Latest activity</p>
                  <p className="mt-2 text-slate-400">
                    Most recent submission:{" "}
                    <span className="text-slate-200">{latestSubmissionLabel}</span>
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSection("submissions")}
                      className="rounded-lg border border-cyan-400/35 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-950/40"
                    >
                      Review submissions
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection("facilitators")}
                      className="rounded-lg border border-orange-400/35 px-3 py-1.5 text-xs text-orange-100 hover:bg-orange-950/30"
                    >
                      Manage facilitators
                    </button>
                    {(legacyCount ?? 0) > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSection("assessments")}
                        className="rounded-lg border border-amber-400/35 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-950/30"
                      >
                        Link {legacyCount} unlinked row(s)
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {section === "assessments" ? (
              <div className="mb-6 rounded-xl border border-amber-500/25 bg-amber-950/10 p-4 text-sm">
                <p className="font-semibold text-amber-200">
                  Assignment submission window (facilitator assessments)
                </p>
                <p className="mt-2 text-slate-400">
                  Closing an assignment stops <strong className="text-slate-200">new</strong>{" "}
                  submissions for that learner link (
                  <code className="rounded bg-white/10 px-1 font-mono text-xs">
                    /learn/[course-slug]
                  </code>
                  ,{" "}
                  <code className="rounded bg-white/10 px-1 font-mono text-xs">
                    ?assessment=slug
                  </code>
                  ).{" "}
                  <strong className="text-slate-200">Delete assignment</strong> removes the Postgres
                  row so the slug can be re‑used (e.g. wipe a test assessment). Ledger submissions that
                  pointed at it remain visible but lose their course link{" "}
                  <span className="text-slate-500">
                    (same as clearing{" "}
                    <code className="font-mono text-[11px]">assessment_id</code>).
                  </span>{" "}
                  Built‑in legacy Day 03 deck (no slug) is always open unless you deprecate it in
                  product.
                </p>
                {locksErr ? (
                  <p className="mt-2 text-sm text-red-400">{locksErr}</p>
                ) : null}
                {locksLoading ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Loading assignment rules…
                  </p>
                ) : locks.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">
                    No facilitator-created assessments yet.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {locks.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#0c0e14] p-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">{a.title}</p>
                            <p className="mt-1 font-mono text-xs text-slate-400">
                              slug <span className="text-cyan-300">{a.slug}</span>
                              {" · "}
                              {a.facilitatorEmail}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-1 font-mono text-xs ${
                              a.submissionsOpen
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-red-500/15 text-red-300"
                            }`}
                          >
                            {a.submissionsOpen ? "Open" : "Closed"}
                          </span>
                          <button
                            type="button"
                            disabled={
                              !!lockToggling ||
                              assessmentDeletingId !== null ||
                              deletingId !== null ||
                              !password ||
                              loading
                            }
                            onClick={() =>
                              void toggleAssessmentLock(
                                password,
                                a.id,
                                false,
                              )
                            }
                            className="rounded-lg border border-red-400/35 bg-red-950/35 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-900/30 disabled:opacity-40"
                          >
                            {lockToggling === a.id ? "Updating…" : "Close submits"}
                          </button>
                          <button
                            type="button"
                            disabled={
                              !!lockToggling ||
                              assessmentDeletingId !== null ||
                              deletingId !== null ||
                              !password ||
                              loading
                            }
                            onClick={() =>
                              void toggleAssessmentLock(
                                password,
                                a.id,
                                true,
                              )
                            }
                            className="rounded-lg border border-emerald-400/35 bg-emerald-950/35 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/25 disabled:opacity-40"
                          >
                            Re‑open submits
                          </button>
                          </div>
                        </div>
                        <div className="rounded-lg border border-orange-500/25 bg-orange-950/15 px-3 py-2.5">
                          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-orange-200/90">
                            Copy facilitator learner links ({a.facilitatorEmail})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-md bg-orange-500 px-2.5 py-1 text-[11px] font-semibold text-[#140802] hover:bg-orange-400"
                              onClick={() =>
                                void copyPublicTrainingUrl(
                                  facilitatorLearnerDeckPath(a.slug),
                                  `"${a.slug}" deck URL`,
                                )
                              }
                            >
                              Copy deck URL
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-emerald-400/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-950/40"
                              onClick={() =>
                                void copyPublicTrainingUrl(
                                  facilitatorClassHubPath(a.slug),
                                  `"${a.slug}" class hub URL`,
                                )
                              }
                            >
                              Copy class hub URL
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
                          <span className="shrink-0 text-xs uppercase tracking-wide text-slate-500">
                            Ownership
                          </span>
                          <select
                            className="max-w-xs flex-1 rounded-lg border border-white/15 bg-[#080910] px-2 py-1.5 font-mono text-xs text-slate-200"
                            aria-label={`Move assignment ${a.slug} to another facilitator`}
                            disabled={
                              !!ownerMoveBusy ||
                              assessmentDeletingId !== null ||
                              facDirLoading ||
                              !password ||
                              loading ||
                              facilitators.length === 0
                            }
                            value={moveOwnerChoice[a.id] ?? ""}
                            onChange={(e) =>
                              setMoveOwnerChoice((p) => ({
                                ...p,
                                [a.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Select trainer…</option>
                            {facilitators.map((f) => (
                              <option
                                key={f.id}
                                value={f.id}
                                disabled={f.id === a.facilitatorId}
                              >
                                {f.email} ({f.assessmentCount} assessments)
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={
                              !!ownerMoveBusy ||
                              assessmentDeletingId !== null ||
                              !password ||
                              loading ||
                              !moveOwnerChoice[a.id] ||
                              moveOwnerChoice[a.id] === a.facilitatorId
                            }
                            onClick={() => {
                              const target = moveOwnerChoice[a.id];
                              if (!target) return;
                              void moveAssessmentOwner(password, a.id, target);
                            }}
                            className="rounded-lg border border-sky-500/35 bg-sky-950/30 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-900/35 disabled:opacity-40"
                          >
                            {ownerMoveBusy === a.id ? "Moving…" : "Move"}
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 border-t border-red-500/15 pt-3">
                          <button
                            type="button"
                            disabled={
                              assessmentDeletingId !== null ||
                              !!lockToggling ||
                              !!ownerMoveBusy ||
                              !password ||
                              loading ||
                              deletingId !== null
                            }
                            onClick={() => void deleteAssessmentRow(password, a)}
                            className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-900/35 disabled:opacity-40"
                          >
                            {assessmentDeletingId === a.id ? "Deleting…" : "Delete assignment"}
                          </button>
                          <span className="max-w-xl text-[11px] text-slate-500">
                            Drops the facilitator course row · frees slug for trainer to publish again ·
                            does not erase submission ledger rows.
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {section === "facilitators" ? (
              <div className="mb-6 rounded-xl border border-cyan-500/25 bg-cyan-950/15 p-4 text-sm">
                <p className="font-semibold text-cyan-200">
                  Organizer: facilitator roster
                </p>
                <p className="mt-2 text-slate-400">
                  Trainer accounts ({facilitators.length}). Use{" "}
                  <strong className="text-slate-200">Ownership</strong> on each assignment
                  in the <strong className="text-slate-200">Assessments</strong> tab to move
                  sessions—or similar bundles—under one login without losing submission history
                  (rows stay keyed by assessment id).
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    onClick={() =>
                      void copyPublicTrainingUrl(
                        "/training/facilitator/login",
                        "facilitator sign-in URL",
                      )
                    }
                    className="w-fit rounded-lg border border-cyan-400/40 bg-cyan-950/40 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-900/35"
                  >
                    Copy facilitator sign-in URL
                  </button>
                  <p className="max-w-xl text-[11px] text-slate-500">
                    Learner-facing deck and class hub links: use{" "}
                    <strong className="text-slate-400">Assessments</strong> — each course has{" "}
                    <strong className="text-slate-400">Copy deck URL</strong> and{" "}
                    <strong className="text-slate-400">Copy class hub URL</strong>.
                  </p>
                </div>
                {facDirErr ? (
                  <p className="mt-2 text-sm text-red-400">{facDirErr}</p>
                ) : null}
                {facDirLoading ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Loading facilitators…
                  </p>
                ) : facilitators.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">
                    No facilitator rows yet — create one below or run demo seed locally.
                  </p>
                ) : (
                  <div className="mt-4 overflow-auto rounded-lg border border-white/10">
                    <table className="w-full min-w-[480px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-black/25 text-[10px] uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2 font-medium">Email</th>
                          <th className="px-3 py-2 font-medium">Display</th>
                          <th className="px-3 py-2 font-medium">Assessments</th>
                          <th className="px-3 py-2 font-medium">Id</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facilitators.map((f) => (
                          <tr
                            key={f.id}
                            className="border-b border-white/5 last:border-b-0"
                          >
                            <td className="px-3 py-2 font-mono text-slate-200">{f.email}</td>
                            <td className="px-3 py-2 text-slate-300">{f.displayName}</td>
                            <td className="px-3 py-2 font-mono text-cyan-200/90">
                              {f.assessmentCount}
                            </td>
                            <td className="break-all px-3 py-1.5 font-mono text-[10px] text-slate-600">
                              {f.id}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}

            {section === "assessments" ? (
              <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-950/15 p-4 text-sm">
                <p className="font-semibold text-rose-200">
                  Organizer: cohort legacy submits → facilitator inbox
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Bulk-attach learner rows that graded{" "}
                  <strong className="text-slate-200">without</strong>{" "}
                  <code className="rounded bg-white/10 px-1 font-mono text-[11px]">
                    ?assessment=
                  </code>{" "}
                  (<code className="rounded bg-black/60 px-1 font-mono text-[11px]">assessment_id</code>
                  {""} IS NULL). Trainers owning the selected slug inbox gain them instantly.
                </p>
                <p className="mt-3 font-mono text-xs text-slate-500">
                  Rows pending link:{" "}
                  <span className="text-white">
                    {legacyCount === null ? "—" : legacyCount}
                  </span>
                </p>
                <label className="mt-3 block text-[11px] text-slate-400">
                  Target facilitator assessment
                  <select
                    className="mt-1 block w-full max-w-xl rounded-lg border border-white/15 bg-[#0c0e14] px-2 py-2 font-mono text-xs text-slate-100"
                    value={legacyTargetId}
                    disabled={locks.length === 0 || legacyBusy}
                    onChange={(e) => setLegacyTargetId(e.target.value)}
                  >
                    {locks.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title} · {l.slug} · {l.facilitatorEmail}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <button
                    type="button"
                    disabled={legacyBusy || !password || locks.length === 0}
                    onClick={() => void runLegacyDryRunOrLink(password, "dry")}
                    className="rounded-lg border border-rose-400/35 bg-rose-950/30 px-3 py-2 text-[11px] font-semibold text-rose-100 hover:bg-rose-900/30 disabled:opacity-40"
                  >
                    Preview (dry-run)
                  </button>
                  <label className="flex min-w-[180px] flex-1 flex-col text-[11px] text-slate-400">
                    Type confirm phrase
                    <input
                      value={legacyConfirm}
                      onChange={(e) => setLegacyConfirm(e.target.value)}
                      placeholder={LEGACY_LINK_CONFIRM_PHRASE}
                      disabled={legacyBusy}
                      autoComplete="off"
                      className="mt-1 rounded-lg border border-white/15 bg-[#0c0e14] px-2 py-2 font-mono text-[10px] text-white"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      legacyBusy ||
                      !password ||
                      legacyConfirm.trim() !== LEGACY_LINK_CONFIRM_PHRASE
                    }
                    onClick={() => void runLegacyDryRunOrLink(password, "commit")}
                    className="rounded-lg bg-rose-500 px-3 py-2 text-[11px] font-semibold text-[#1c0510] disabled:opacity-40"
                  >
                    Link legacy rows
                  </button>
                </div>
                {legacyMsg ? (
                  <p className="mt-3 whitespace-pre-wrap text-xs text-rose-200/85">{legacyMsg}</p>
                ) : null}
              </div>
            ) : null}

            {section === "facilitators" ? (
              <details className="mb-6 rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-4 text-sm">
                <summary className="cursor-pointer font-semibold text-emerald-200">
                  Organizer: create facilitator account
                </summary>
                <p className="mt-2 text-slate-400">
                  Sends credentials securely over HTTPS once. Requires Postgres on the
                  host. If you get{" "}
                  <span className="text-amber-200/90">&quot;already exists&quot;</span>, use{" "}
                  <strong className="text-slate-200">Update existing facilitator credentials</strong>{" "}
                  below instead. Share{" "}
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

            {section === "facilitators" ? (
              <details className="mb-6 rounded-xl border border-sky-500/25 bg-sky-950/15 p-4 text-sm">
                <summary className="cursor-pointer font-semibold text-sky-200">
                  Organizer: update existing facilitator credentials
                </summary>
                <p className="mt-2 text-slate-400">
                  Use this when the facilitator row already exists (e.g. you hit “already
                  exists” during create). Set a password you control; never reuse personal
                  passwords that also protect other accounts.
                </p>
                <label className="mt-4 block text-xs text-slate-400">
                  Facilitator email
                  <input
                    type="email"
                    value={updEmail}
                    onChange={(e) => setUpdEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 text-slate-100"
                  />
                </label>
                <label className="mt-3 block text-xs text-slate-400">
                  New password (≥10 chars — leave blank to skip if you only change display)
                  <input
                    type="password"
                    value={updPwd}
                    onChange={(e) => setUpdPwd(e.target.value)}
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 text-slate-100"
                  />
                </label>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={updApplyDisplay}
                    onChange={(e) => setUpdApplyDisplay(e.target.checked)}
                    className="shrink-0"
                  />
                  <span>Update display name (below)</span>
                </label>
                {updApplyDisplay ? (
                  <input
                    type="text"
                    value={updDisplay}
                    onChange={(e) => setUpdDisplay(e.target.value)}
                    placeholder="Display name shown in roster"
                    className="mt-2 block w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 text-slate-100"
                  />
                ) : null}
                <button
                  type="button"
                  disabled={updBusy || !password || !updEmail.trim()}
                  onClick={() => void patchFacilitatorCreds()}
                  className="mt-4 rounded-lg border border-sky-400/50 bg-sky-600 px-4 py-2 font-semibold text-[#081218] hover:bg-sky-500 disabled:opacity-45"
                >
                  {updBusy ? "Saving…" : "Apply update"}
                </button>
                {updMsg ? (
                  <p className="mt-3 whitespace-pre-wrap text-xs text-sky-100/85">
                    {updMsg}
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
            ) : null}

            {section === "ideation" ? (
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
            ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
