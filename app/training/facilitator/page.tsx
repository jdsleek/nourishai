"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DashboardStatCard,
  DashboardStatGrid,
} from "@/components/foundry/DashboardStatGrid";
import { learnerDeckPath, learnerDeckSubmitPath } from "@/lib/foundry-learner-course";
import type { PortalFormMerged, PortalFormStepKey } from "@/lib/foundry-portal-form";
import {
  DEFAULT_PORTAL_FORM,
  mergePortalForm,
  STEPS_KEYS,
} from "@/lib/foundry-portal-form";
import {
  portalFormFromTemplate,
  PORTAL_TEMPLATE_OPTIONS,
} from "@/lib/foundry-portal-presets";
import { DEFAULT_LEARNER_PROGRESS_CHECKLIST } from "@/lib/foundry-learner-checklist";
import type { PortalExtraAnswerSlot } from "@/lib/foundry-portal-extras";
import { MAX_PORTAL_EXTRA_ANSWER_SLOTS } from "@/lib/foundry-portal-extras";
import type { FoundryGradeResult } from "@/lib/foundry-grade";

function publishChecklistTemplate(): string {
  return DEFAULT_LEARNER_PROGRESS_CHECKLIST.join("\n");
}

type FacTab = "overview" | "share" | "submissions" | "assessments";

type Assessment = {
  id: string;
  title: string;
  slug: string;
  subgroupOptions: string[];
  minPromptChars: number;
  minOutputChars: number;
  assessmentIntro: string;
  graderInstructions: string;
  portalForm: PortalFormMerged;
  extraAnswerSlots: PortalExtraAnswerSlot[];
  studentUrlHint: string;
  submissionsOpen: boolean;
  levelUpUrl: string;
  studentChecklist: string[];
};

type Submission = {
  id: string;
  submittedAt: string;
  fellowName: string;
  subgroup: string;
  prompt: string;
  output: string;
  result: FoundryGradeResult;
  assessmentSlug?: string | null;
  assessmentTitle?: string | null;
};

type Stats = {
  submissionCount: number;
  assessmentCount: number;
  orphanLegacyCount: number;
};

const FACILITATOR_PORTAL_GROUP_TITLE: Record<PortalFormStepKey, string> = {
  name: "Field 01 — Fellow / learner name",
  subgroup: "Field 02 — Subgroup dropdown",
  prompt: "Field 03 — First long answer (e.g. prompt they pasted)",
  output: "Field 04 — Second long answer (e.g. model reply)",
};

const TAB_LABELS: { id: FacTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "share", label: "Share with class" },
  { id: "submissions", label: "Submissions" },
  { id: "assessments", label: "Assessments" },
];

function facilitatorRubricMayBeVague(instr: string): boolean {
  const t = instr.trim().toLowerCase();
  return (
    t.length >= 34 &&
    !/score|rubric|criterion|criteria|grading|evaluate|dimension|scale|prompt|architecture|output/i.test(
      t,
    )
  );
}

function originUrl(path: string) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function facilitatorClassHubPath(slug: string) {
  return `/learn/${encodeURIComponent(slug)}`;
}

function freshExtraPortalSlot(): PortalExtraAnswerSlot {
  const id =
    typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
      ? `q${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`
      : `q${Date.now().toString(36)}`;
  return { id, label: "", hint: "", placeholder: "", required: false };
}

function csvEscape(cell: unknown): string {
  const s = cell == null ? "" : String(cell);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function submissionRowToCsvLine(s: Submission): string {
  const pq = s.result?.breakdown?.prompt_quality;
  const arch = s.result?.breakdown?.architecture_viability;
  return [
    csvEscape(s.id),
    csvEscape(s.submittedAt),
    csvEscape(s.fellowName),
    csvEscape(s.subgroup),
    csvEscape(s.assessmentSlug ?? ""),
    csvEscape(s.assessmentTitle ?? ""),
    csvEscape(s.result.total_score),
    csvEscape(s.result.grade),
    csvEscape(s.result.verdict),
    csvEscape(pq?.score ?? ""),
    csvEscape(pq?.feedback ?? ""),
    csvEscape(arch?.score ?? ""),
    csvEscape(arch?.feedback ?? ""),
    csvEscape(s.result.level_up_tip ?? ""),
    csvEscape(s.prompt ?? ""),
    csvEscape(s.output ?? ""),
  ].join(",");
}

function triggerFilteredSubmissionsCsvDownload(rows: Submission[], label: string) {
  if (!rows.length || typeof window === "undefined") return;
  const header = [
    "id",
    "submitted_at_iso",
    "learner_name",
    "subgroup",
    "assessment_slug",
    "assessment_title",
    "total_score",
    "grade_band",
    "verdict",
    "prompt_quality_score",
    "prompt_quality_feedback",
    "architecture_score",
    "architecture_feedback",
    "level_up_tip",
    "stored_prompt_blob",
    "architecture_output",
  ];
  const bom = "\uFEFF";
  const body =
    `${bom}${header.join(",")}\r\n` + rows.map((r) => submissionRowToCsvLine(r)).join("\r\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `facilitator-submissions-${label}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function SubmitPortalEditor(props: {
  portal: PortalFormMerged;
  onChangePortal: (next: PortalFormMerged) => void;
  extraSlots: PortalExtraAnswerSlot[];
  onChangeExtraSlots: (next: PortalExtraAnswerSlot[]) => void;
}) {
  const { portal, onChangePortal, extraSlots, onChangeExtraSlots } = props;
  return (
    <div className="space-y-4 rounded-xl border border-orange-400/35 bg-orange-950/18 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-300/95">
          Submit portal (learner-facing form)
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <select
            aria-label="Apply portal wording template"
            className="max-w-[14rem] rounded border border-white/20 bg-[#07080d] px-2 py-1 text-[10px] text-slate-200"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              onChangePortal(portalFormFromTemplate(id));
              e.currentTarget.selectedIndex = 0;
            }}
          >
            <option value="" disabled>
              Template…
            </option>
            {PORTAL_TEMPLATE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded border border-white/20 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/[0.04]"
            onClick={() => onChangePortal(structuredClone(DEFAULT_PORTAL_FORM))}
          >
            Restore built-in wording
          </button>
        </div>
      </div>
      <p className="text-[11px] leading-snug text-slate-400">
        Edit labels, help text under each title, placeholders, and the short error hints that appear if a field
        is empty. Fellows see this in the grading portal before submit.
      </p>
      {STEPS_KEYS.map((step) => (
        <div key={step} className="space-y-2 rounded-lg border border-white/12 bg-black/35 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-orange-400/95">
            {FACILITATOR_PORTAL_GROUP_TITLE[step]}
          </p>
          <label className="block text-[11px] text-slate-500">
            Label (top line)
            <input
              type="text"
              value={portal[step].label}
              onChange={(e) =>
                onChangePortal({
                  ...portal,
                  [step]: {
                    ...portal[step],
                    label: e.target.value,
                  },
                })
              }
              className="mt-1 w-full rounded border border-white/15 bg-[#07080d] px-2 py-1 font-sans text-xs text-white"
            />
          </label>
          <label className="block text-[11px] text-slate-500">
            Help text (shown under title)
            <textarea
              value={portal[step].hint}
              onChange={(e) =>
                onChangePortal({
                  ...portal,
                  [step]: {
                    ...portal[step],
                    hint: e.target.value,
                  },
                })
              }
              rows={3}
              className="mt-1 w-full rounded border border-white/15 bg-[#07080d] px-2 py-2 font-sans text-xs leading-relaxed text-slate-200"
            />
          </label>
          <label className="block text-[11px] text-slate-500">
            Placeholder (gray sample — long fields only)
            <textarea
              value={portal[step].placeholder}
              onChange={(e) =>
                onChangePortal({
                  ...portal,
                  [step]: {
                    ...portal[step],
                    placeholder: e.target.value,
                  },
                })
              }
              rows={step === "name" ? 2 : 4}
              className="mt-1 w-full rounded border border-white/15 bg-[#07080d] px-2 py-2 font-mono text-[11px] leading-relaxed text-slate-200"
            />
          </label>
          <label className="block text-[11px] text-slate-500">
            Error hint (one line if they skip this field)
            <input
              type="text"
              value={portal[step].fieldError}
              onChange={(e) =>
                onChangePortal({
                  ...portal,
                  [step]: {
                    ...portal[step],
                    fieldError: e.target.value,
                  },
                })
              }
              className="mt-1 w-full rounded border border-white/15 bg-[#07080d] px-2 py-1 font-sans text-xs text-white"
            />
          </label>
        </div>
      ))}

      <div className="space-y-3 rounded-lg border border-cyan-500/35 bg-black/35 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-200/95">
            Extra questions (optional · beyond fields 03/04 · max {MAX_PORTAL_EXTRA_ANSWER_SLOTS})
          </p>
          <button
            type="button"
            disabled={extraSlots.length >= MAX_PORTAL_EXTRA_ANSWER_SLOTS}
            onClick={() => onChangeExtraSlots([...extraSlots, freshExtraPortalSlot()])}
            className="rounded border border-cyan-400/40 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/35 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add row
          </button>
        </div>
        {extraSlots.length ? (
          <ul className="space-y-3">
            {extraSlots.map((slot, idx) => (
              <li
                key={slot.id + String(idx)}
                className="space-y-2 rounded border border-white/12 bg-[#07080d]/80 px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[10px] text-slate-500">Row {idx + 1}</p>
                  <button
                    type="button"
                    className="text-[10px] text-rose-300 underline hover:text-rose-100"
                    onClick={() =>
                      onChangeExtraSlots(extraSlots.filter((_, j) => j !== idx))
                    }
                  >
                    Remove
                  </button>
                </div>
                <label className="flex items-start gap-2 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={!!slot.required}
                    onChange={(e) =>
                      onChangeExtraSlots(
                        extraSlots.map((s, j) =>
                          j === idx ? { ...s, required: e.target.checked } : s,
                        ),
                      )
                    }
                    className="mt-0.5"
                  />
                  <span>Required for submit</span>
                </label>
                <label className="block text-[11px] text-slate-500">
                  Question title (shown to learners)
                  <input
                    type="text"
                    value={slot.label}
                    onChange={(e) =>
                      onChangeExtraSlots(
                        extraSlots.map((s, j) =>
                          j === idx ? { ...s, label: e.target.value } : s,
                        ),
                      )
                    }
                    className="mt-1 w-full rounded border border-white/15 bg-[#0c0e14] px-2 py-1 text-xs text-white"
                  />
                </label>
                <label className="block text-[11px] text-slate-500">
                  Help text
                  <textarea
                    value={slot.hint}
                    onChange={(e) =>
                      onChangeExtraSlots(
                        extraSlots.map((s, j) =>
                          j === idx ? { ...s, hint: e.target.value } : s,
                        ),
                      )
                    }
                    rows={2}
                    className="mt-1 w-full rounded border border-white/15 bg-[#0c0e14] px-2 py-2 text-xs text-slate-200"
                  />
                </label>
                <label className="block text-[11px] text-slate-500">
                  Placeholder
                  <textarea
                    value={slot.placeholder}
                    onChange={(e) =>
                      onChangeExtraSlots(
                        extraSlots.map((s, j) =>
                          j === idx ? { ...s, placeholder: e.target.value } : s,
                        ),
                      )
                    }
                    rows={2}
                    className="mt-1 w-full rounded border border-white/15 bg-[#0c0e14] px-2 py-2 font-mono text-[11px] text-slate-200"
                  />
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-slate-500">
            Need more long answers besides the usual two portals? Add rows — each saves as an extra textarea on
            the learner deck until you remove them.
          </p>
        )}
      </div>
    </div>
  );
}

export default function FacilitatorDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<FacTab>("overview");
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
  const [newCourseShare, setNewCourseShare] = useState<{
    title: string;
    slug: string;
  } | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [subOpts, setSubOpts] = useState(
    "Bethel, Carmel, Eden, Gilead, Goshen, Hebron, Israel, Zion, Other / not listed",
  );
  const [intro, setIntro] = useState("");
  const [graderInstructions, setGraderInstructions] = useState("");
  const [mp, setMp] = useState(40);
  const [mo, setMo] = useState(80);
  const [newLevelUpUrl, setNewLevelUpUrl] = useState("");
  const [newStudentChecklistText, setNewStudentChecklistText] =
    useState(publishChecklistTemplate);
  const [newPortalForm, setNewPortalForm] = useState<PortalFormMerged>(() =>
    structuredClone(DEFAULT_PORTAL_FORM),
  );
  const [newExtraSlots, setNewExtraSlots] = useState<PortalExtraAnswerSlot[]>([]);
  /** Inline edit desk + rubric for an existing assessment */
  const [editingDesk, setEditingDesk] = useState<{
    id: string;
    intro: string;
    grader: string;
    portal: PortalFormMerged;
    extraAnswerSlots: PortalExtraAnswerSlot[];
    levelUpUrl: string;
    studentChecklistText: string;
  } | null>(null);
  const [deskSaveBusy, setDeskSaveBusy] = useState(false);

  const primaryAssessment = useMemo(() => assessments[0] ?? null, [assessments]);

  /** Filter inbox by facilitator assessment slug ("", all). */
  const [subsFilterSlug, setSubsFilterSlug] = useState("");
  const filteredSubs = useMemo(() => {
    if (!subsFilterSlug) return subs;
    return subs.filter(
      (x) => (x.assessmentSlug || "").trim() === subsFilterSlug,
    );
  }, [subs, subsFilterSlug]);

  useEffect(() => {
    setSubsFilterSlug((cur) =>
      assessments.some((a) => a.slug === cur) ? cur : "",
    );
  }, [assessments]);
  const canClaimLegacy = assessments.length > 0;
  const openAssessmentCount = useMemo(
    () => assessments.filter((a) => a.submissionsOpen).length,
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
    const raw = (aj.assessments ?? []) as Partial<Assessment>[];
    setAssessments(
      raw.map((x) => ({
        id: String(x.id),
        title: String(x.title ?? ""),
        slug: String(x.slug ?? ""),
        subgroupOptions: Array.isArray(x.subgroupOptions) ? x.subgroupOptions.map(String) : [],
        minPromptChars: Number(x.minPromptChars ?? 40),
        minOutputChars: Number(x.minOutputChars ?? 80),
        assessmentIntro: String(x.assessmentIntro ?? ""),
        graderInstructions: String(x.graderInstructions ?? ""),
        portalForm: mergePortalForm((x as { portalForm?: unknown }).portalForm),
        extraAnswerSlots: structuredClone(
          Array.isArray((x as { extraAnswerSlots?: unknown }).extraAnswerSlots)
            ? ((x as { extraAnswerSlots: PortalExtraAnswerSlot[] }).extraAnswerSlots ?? [])
            : [],
        ),
        studentUrlHint: String(x.studentUrlHint ?? ""),
        submissionsOpen: x.submissionsOpen !== false,
        levelUpUrl: String((x as { levelUpUrl?: string }).levelUpUrl ?? ""),
        studentChecklist: Array.isArray((x as { studentChecklist?: unknown }).studentChecklist)
          ? (x as { studentChecklist: string[] }).studentChecklist.map((s) => String(s))
          : [],
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
      const data = (await res.json()) as {
        error?: string;
        moved?: number;
      };
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

  const saveDeskAndRubric = useCallback(async () => {
    if (!editingDesk) return;
    setDeskSaveBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/training/facilitator/assessments/${encodeURIComponent(editingDesk.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            assessmentIntro: editingDesk.intro,
            graderInstructions: editingDesk.grader.trim(),
            portalForm: editingDesk.portal,
            extraAnswerSlots: editingDesk.extraAnswerSlots,
            levelUpUrl: editingDesk.levelUpUrl,
            studentChecklist: editingDesk.studentChecklistText
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean),
          }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setEditingDesk(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setDeskSaveBusy(false);
    }
  }, [editingDesk, load]);

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

          {newCourseShare ? (
            <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/20 p-4 text-sm">
              <p className="font-semibold text-emerald-100">Course published</p>
              <p className="mt-2 text-slate-300">
                <strong>{newCourseShare.title}</strong> ({newCourseShare.slug}) — send fellows the
                links below — each uses{" "}
                <strong className="text-white">your</strong> facilitator rubric and inbox.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-orange-500 px-3 py-2 text-[11px] font-semibold text-[#1a0803]"
                  onClick={() =>
                    void copyText(
                      originUrl(learnerDeckPath(newCourseShare.slug)),
                      "learner deck link",
                    )
                  }
                >
                  Copy learner deck link
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-emerald-400/40 px-3 py-2 text-[11px] font-semibold text-emerald-100"
                  onClick={() =>
                    void copyText(
                      originUrl(facilitatorClassHubPath(newCourseShare.slug)),
                      "class hub link",
                    )
                  }
                >
                  Copy class hub link
                </button>
              </div>
              <button
                type="button"
                className="mt-3 text-xs text-slate-500 underline hover:text-white"
                onClick={() => setNewCourseShare(null)}
              >
                Dismiss
              </button>
            </div>
          ) : null}

          {tab === "overview" ? (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Your course at a glance</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Submissions and class links for your facilitator account only.
                </p>
              </div>
              <DashboardStatGrid>
                <DashboardStatCard
                  label="In your inbox"
                  value={stats?.submissionCount ?? subs.length}
                  hint="Graded work tied to your assessments"
                  tone="cyan"
                  onClick={() => setTab("submissions")}
                />
                <DashboardStatCard
                  label="Assessments"
                  value={stats?.assessmentCount ?? assessments.length}
                  hint={`${openAssessmentCount} open for new submits`}
                  tone="slate"
                  onClick={() => setTab("assessments")}
                />
                <DashboardStatCard
                  label="Pending attach"
                  value={stats?.orphanLegacyCount ?? 0}
                  hint={
                    (stats?.orphanLegacyCount ?? 0) > 0
                      ? "Class deck grades not in your inbox yet"
                      : "All class work linked"
                  }
                  tone={(stats?.orphanLegacyCount ?? 0) > 0 ? "amber" : "emerald"}
                  onClick={() => setTab("share")}
                />
                <DashboardStatCard
                  label="Primary course"
                  value={primaryAssessment ? primaryAssessment.slug : "—"}
                  hint={
                    primaryAssessment
                      ? "Shortcuts use your oldest-published assignment (avoid test drafts bumping it)"
                      : "Create one under Assessments"
                  }
                  tone="slate"
                  onClick={() => setTab("share")}
                />
              </DashboardStatGrid>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTab("assessments")}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
                >
                  Copy learner links →
                </button>
                <button
                  type="button"
                  onClick={() => setTab("share")}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-[#041018] hover:bg-cyan-500"
                >
                  Share class URL
                </button>
                <button
                  type="button"
                  onClick={() => setTab("submissions")}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
                >
                  View submissions
                </button>
                {(stats?.orphanLegacyCount ?? 0) > 0 && canClaimLegacy ? (
                  <button
                    type="button"
                    onClick={() => setTab("share")}
                    className="rounded-lg border border-amber-400/40 px-4 py-2 text-sm text-amber-100 hover:bg-amber-950/30"
                  >
                    Attach {stats!.orphanLegacyCount} pending
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          {tab === "share" ? (
            <section className="space-y-4">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5">
                <h2 className="text-lg font-semibold text-cyan-100">Class deck &amp; portal</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Slide HTML is shared Qubators Day&nbsp;03 for everyone — your coursework differs by{" "}
                  <strong className="text-white">grading rubric</strong>,{" "}
                  <strong className="text-white">subgroups</strong>, and the optional{" "}
                  <strong className="text-white">class desk</strong> block you publish under{" "}
                  <strong>Assessments</strong>. The public home page (
                  <code className="rounded bg-black/40 px-1 font-mono text-xs">/</code>) loads the deck
                  with the legacy built-in rubric unless students use{" "}
                  <code className="rounded bg-black/40 px-1 font-mono text-xs">
                    /foundry/deck/their-course
                  </code>{" "}
                  (or legacy{" "}
                  <code className="rounded bg-black/40 px-1 font-mono text-xs">
                    ?assessment=their-slug
                  </code>
                  ). Send explicit links — hub{" "}
                  <code className="rounded bg-black/40 px-1 font-mono text-xs">
                    /learn/your-course
                  </code>{" "}
                  or{" "}
                  <code className="rounded bg-black/40 px-1 font-mono text-xs">/class?course=…</code>
                  , or slides at{" "}
                  <code className="rounded bg-black/40 px-1 font-mono text-xs">/foundry/deck/your-course</code>.
                </p>
                {primaryAssessment ? (
                  <div className="mt-4 space-y-3">
                    <p className="font-mono text-xs text-emerald-300">
                      Main-course shortcuts: <strong>{primaryAssessment.title}</strong>{" "}
                      <span className="opacity-95">({primaryAssessment.slug})</span>
                      {" — "}
                      <span className="text-slate-400">
                        your oldest-published assignment; edit a test draft without changing these
                        buttons.
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Every assessment has its own copy buttons under{" "}
                      <strong>Assessments</strong> — use those when you run multiple cohort courses.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          void copyText(
                            originUrl(learnerDeckPath(primaryAssessment.slug)),
                            "learner deck link",
                          )
                        }
                        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-[#0a0704] hover:bg-orange-400"
                      >
                        Copy learner deck link (recommended)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void copyText(
                            originUrl(facilitatorClassHubPath(primaryAssessment.slug)),
                            "class hub link",
                          )
                        }
                        className="rounded-lg border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-950/30"
                      >
                        Copy class hub (path link)
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      More than one course? Each row under <strong>Assessments</strong> has its
                      own learner + hub buttons.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-amber-200/90">
                    Publish an assessment under <strong>Assessments</strong>, then copy deck and hub
                    links from there or below.
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
                    One click attaches them to your{" "}
                    <strong>oldest-published course</strong> inbox (usually your live cohort, not the
                    last draft you touched).
                  </p>
                  {!canClaimLegacy ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-amber-100/95">
                        This account has <strong>no assessments yet</strong>, so there is
                        nowhere to attach these rows. Create one under{" "}
                        <strong>Assessments</strong>, or ask the organizer to assign an
                        existing course (e.g. sprint-architecture) assigned to your email
                        by your program organizer.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab("assessments")}
                        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-[#1a1005]"
                      >
                        Go to Assessments
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={claimBusy}
                      onClick={() => void claimLegacy()}
                      className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-[#1a1005] disabled:opacity-45"
                    >
                      {claimBusy
                        ? "Working…"
                        : "Attach orphaned class submissions"}
                    </button>
                  )}
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-white">Learner submissions</h2>
                  {subs.length ? (
                    <label className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="shrink-0">Show</span>
                      <select
                        className="max-w-[14rem] rounded-lg border border-white/15 bg-[#0c0e14] px-2 py-1.5 font-mono text-[11px] text-slate-200"
                        value={subsFilterSlug}
                        onChange={(e) => setSubsFilterSlug(e.target.value)}
                        aria-label="Filter submissions by course slug"
                      >
                        <option value="">All published courses ({subs.length})</option>
                        {assessments.map((c) => {
                          const n = subs.filter(
                            (s) => (s.assessmentSlug || "").trim() === c.slug,
                          ).length;
                          return (
                            <option key={c.id} value={c.slug}>
                              {c.slug} ({n}) · {c.title.slice(0, 28)}
                              {c.title.length > 28 ? "…" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!filteredSubs.length}
                    onClick={() =>
                      triggerFilteredSubmissionsCsvDownload(
                        filteredSubs,
                        subsFilterSlug || "all-courses",
                      )
                    }
                    className="rounded-lg border border-emerald-400/40 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-950/35 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Download CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="text-xs text-slate-400 underline hover:text-white"
                  >
                    Refresh
                  </button>
                </div>
              </div>
              {!subs.length ? (
                <div className="rounded-xl border border-white/10 bg-[#111520] p-6 text-sm text-slate-400">
                  <p>No submissions in your course inbox yet.</p>
                  <p className="mt-2">
                    Share links from <strong>Share with class</strong>, or learners should open{" "}
                    <code className="font-mono">/foundry/deck/your-course</code>{" "}
                    (legacy{" "}
                    <code className="font-mono">/foundry/day03?assessment=…</code>
                    {""} works too).
                  </p>
                </div>
              ) : !filteredSubs.length ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-950/20 p-4 text-sm text-amber-100/95">
                  No submissions for{" "}
                  <code className="font-mono text-amber-200">{subsFilterSlug}</code>. Pick another
                  filter or remind students their slide link should include{" "}
                  <code className="font-mono text-amber-200">{learnerDeckPath(subsFilterSlug)}</code>
                  {""} or <code className="font-mono">?assessment={subsFilterSlug}</code>.
                </div>
              ) : (
                <ul className="space-y-2">
                  {filteredSubs.map((x) => (
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
                            {a.assessmentIntro.trim() ? (
                              <p className="mt-2 text-xs text-cyan-200/85">
                                Class desk filled — learners see it on the Day 03 slide deck with this
                                link.
                              </p>
                            ) : (
                              <p className="mt-2 text-xs text-slate-500">
                                No class desk yet — add text so your cohort sees their assignment at
                                the top of the deck (not only the generic Qubators slides).
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded border border-cyan-500/35 px-2 py-1 text-[10px] text-cyan-100"
                              onClick={() =>
                                setEditingDesk((cur) =>
                                  cur?.id === a.id
                                    ? null
                                    : {
                                        id: a.id,
                                        intro: a.assessmentIntro,
                                        grader: a.graderInstructions,
                                        portal: structuredClone(a.portalForm),
                                        extraAnswerSlots: structuredClone(a.extraAnswerSlots),
                                        levelUpUrl: a.levelUpUrl,
                                        studentChecklistText: a.studentChecklist.join("\n"),
                                      },
                                )
                              }
                            >
                              {editingDesk?.id === a.id ? "Close editor" : "Desk & assignment"}
                            </button>
                            <a
                              href={originUrl(learnerDeckSubmitPath(a.slug))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded border border-orange-400/50 px-2 py-1 text-[10px] font-semibold text-orange-100 hover:bg-orange-950/40"
                            >
                              Preview submit
                            </a>
                            <button
                              type="button"
                              className="rounded bg-orange-500/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#140802]"
                              onClick={() =>
                                void copyText(
                                  originUrl(learnerDeckPath(a.slug)),
                                  `deck (${a.slug})`,
                                )
                              }
                            >
                              Copy deck
                            </button>
                            <a
                              href={originUrl(facilitatorClassHubPath(a.slug))}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded border border-cyan-400/40 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/35"
                            >
                              Preview hub
                            </a>
                            <button
                              type="button"
                              className="rounded border border-emerald-400/35 px-2 py-1 text-[10px] text-emerald-100"
                              onClick={() =>
                                void copyText(
                                  originUrl(facilitatorClassHubPath(a.slug)),
                                  `hub (${a.slug})`,
                                )
                              }
                            >
                              Copy hub
                            </button>
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
                        {editingDesk?.id === a.id ? (
                          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                            <label className="block text-xs text-slate-400">
                              Class desk · what learners see on the slide deck before your portal
                              (optional)
                              <textarea
                                value={editingDesk.intro}
                                onChange={(e) =>
                                  setEditingDesk((d) =>
                                    d ? { ...d, intro: e.target.value } : null,
                                  )
                                }
                                rows={8}
                                className="mt-1 w-full rounded-lg border border-white/15 bg-[#07080d] px-3 py-2 font-sans text-[13px] leading-relaxed text-slate-100"
                                placeholder="Today’s objectives, readings, Slack link, or document summary — plain text."
                              />
                            </label>
                            <label className="block text-xs text-slate-400">
                              Rubric · grading instructions (required for published courses)
                              <textarea
                                value={editingDesk.grader}
                                onChange={(e) =>
                                  setEditingDesk((d) =>
                                    d ? { ...d, grader: e.target.value } : null,
                                  )
                                }
                                rows={12}
                                className="mt-1 w-full rounded-lg border border-white/15 bg-[#07080d] px-3 py-2 font-mono text-[12px] text-slate-100"
                              />
                            </label>
                            {facilitatorRubricMayBeVague(editingDesk.grader) ? (
                              <p className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-[11px] leading-snug text-amber-100/95">
                                Your rubric is light on scoring language. Mention what to score (dimensions,
                                point guidance, GO/NO-GO thresholds) so the model grades tightly and learners
                                get consistent feedback — especially if portal fields still borrow Day&nbsp;03
                                architecture wording.
                              </p>
                            ) : null}
                            <label className="block text-xs text-slate-400">
                              Optional · “next step” link after grading (https only)
                              <input
                                type="url"
                                value={editingDesk.levelUpUrl}
                                onChange={(e) =>
                                  setEditingDesk((d) =>
                                    d ? { ...d, levelUpUrl: e.target.value } : null,
                                  )
                                }
                                placeholder="https://..."
                                className="mt-1 w-full rounded-lg border border-white/15 bg-[#07080d] px-3 py-2 font-mono text-xs text-emerald-100"
                              />
                            </label>
                            <label className="block text-xs text-slate-400">
                              Optional · class hub checklist (one line per bullet; learners also see curated
                              defaults when this is blank)
                              <textarea
                                value={editingDesk.studentChecklistText}
                                onChange={(e) =>
                                  setEditingDesk((d) =>
                                    d ? { ...d, studentChecklistText: e.target.value } : null,
                                  )
                                }
                                rows={6}
                                className="mt-1 w-full rounded-lg border border-white/15 bg-[#07080d] px-3 py-2 text-[13px] leading-relaxed text-slate-100"
                                placeholder="Use the facilitator’s hosted /learn/your-course link..."
                              />
                            </label>
                            {editingDesk ? (
                              <SubmitPortalEditor
                                portal={editingDesk.portal}
                                onChangePortal={(next) =>
                                  setEditingDesk((d) => (d ? { ...d, portal: next } : null))
                                }
                                extraSlots={editingDesk.extraAnswerSlots}
                                onChangeExtraSlots={(next) =>
                                  setEditingDesk((d) => (d ? { ...d, extraAnswerSlots: next } : null))
                                }
                              />
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={
                                  deskSaveBusy || editingDesk.grader.trim().length < 20
                                }
                                onClick={() => void saveDeskAndRubric()}
                                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#08120c] disabled:opacity-50"
                              >
                                {deskSaveBusy ? "Saving…" : "Save desk, rubric & submit portal"}
                              </button>
                              <button
                                type="button"
                                disabled={deskSaveBusy}
                                onClick={() => setEditingDesk(null)}
                                className="rounded-lg border border-white/20 px-4 py-2 text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
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
                            levelUpUrl: newLevelUpUrl,
                            studentChecklist: newStudentChecklistText
                              .split(/\r?\n/)
                              .map((s) => s.trim())
                              .filter(Boolean),
                            portalForm: newPortalForm,
                            extraAnswerSlots: newExtraSlots,
                          }),
                        });
                        const data = (await res.json().catch(() => ({}))) as {
                          error?: string;
                          assessment?: { slug?: string; title?: string };
                        };
                        if (!res.ok)
                          throw new Error(data.error || "Save failed.");
                        await load();
                        setTitle("");
                        setSlug("");
                        setIntro("");
                        setGraderInstructions("");
                        setNewLevelUpUrl("");
                        setNewStudentChecklistText(publishChecklistTemplate());
                        setNewPortalForm(structuredClone(DEFAULT_PORTAL_FORM));
                        setNewExtraSlots([]);
                        const row = data.assessment;
                        if (row?.slug && row.title) {
                          setNewCourseShare({ slug: row.slug, title: row.title });
                        }
                        setTab("assessments");
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
                    Subgroup list for the portal (comma or line · shown in learner dropdown)
                    <textarea
                      value={subOpts}
                      onChange={(e) => setSubOpts(e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 font-mono text-[12px] text-slate-200"
                      placeholder="Bethel, Carmel, Eden, ..."
                    />
                  </label>

                  <div className="space-y-3 rounded-xl border border-cyan-500/25 bg-cyan-950/15 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-300/95">
                      Set at publish · class hub &amp; deck reminders
                    </p>
                    <p className="text-[11px] leading-snug text-slate-400">
                      Edit this before you publish. These lines ship with the assessment; you can still change
                      them later under Desk &amp; assignment.
                    </p>
                    <label className="block text-xs text-slate-300">
                      Learner checklist · one line per bullet
                      <textarea
                        value={newStudentChecklistText}
                        onChange={(e) => setNewStudentChecklistText(e.target.value)}
                        rows={6}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 text-[13px] leading-relaxed"
                      />
                    </label>
                    <label className="block text-xs text-slate-400">
                      Optional · “next step” link after grading (<code className="font-mono">https</code> only)
                      <input
                        type="url"
                        value={newLevelUpUrl}
                        onChange={(e) => setNewLevelUpUrl(e.target.value)}
                        placeholder="https://..."
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 font-mono text-xs text-emerald-200"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs text-slate-400">
                      Minimum characters · pasted prompt box
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={mp}
                        onChange={(e) => setMp(Math.max(0, Number(e.target.value) || 0))}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 font-mono text-sm"
                      />
                    </label>
                    <label className="block text-xs text-slate-400">
                      Minimum characters in pasted AI-output box
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={mo}
                        onChange={(e) => setMo(Math.max(0, Number(e.target.value) || 0))}
                        className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 font-mono text-sm"
                      />
                    </label>
                  </div>

                  <label className="block text-xs text-slate-400">
                    Class desk · learner-facing assignment brief (optional)
                    <textarea
                      value={intro}
                      onChange={(e) => setIntro(e.target.value)}
                      rows={6}
                      placeholder="What you paste here appears at the top of the shared Day 03 slides for your course URL, and is sent to the grader together with rubric instructions. Use plain text: objectives, readings, cohort links."
                      className="mt-1 w-full rounded-lg border border-white/15 bg-[#0c0e14] px-3 py-2 text-[13px] leading-relaxed"
                    />
                  </label>
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
                  <SubmitPortalEditor
                    portal={newPortalForm}
                    onChangePortal={setNewPortalForm}
                    extraSlots={newExtraSlots}
                    onChangeExtraSlots={setNewExtraSlots}
                  />
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
