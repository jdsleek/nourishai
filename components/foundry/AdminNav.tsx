"use client";

export type AdminNavSection =
  | "submissions"
  | "facilitators"
  | "assessments"
  | "ideation";

const ITEMS: { id: AdminNavSection; label: string; hint: string }[] = [
  { id: "submissions", label: "All submissions", hint: "Cohort inbox" },
  { id: "facilitators", label: "Facilitators", hint: "Accounts & roster" },
  { id: "assessments", label: "Assessments", hint: "Locks & legacy tools" },
  { id: "ideation", label: "Ideation registry", hint: "QAF CSV rebuild" },
];

export function AdminNav({
  section,
  onSection,
  submissionCount,
  facilitatorCount,
}: {
  section: AdminNavSection;
  onSection: (s: AdminNavSection) => void;
  submissionCount: number;
  facilitatorCount: number;
}) {
  return (
    <nav
      className="flex w-full flex-col gap-1 rounded-xl border border-white/10 bg-[#0c0e14] p-2 lg:w-56 lg:shrink-0"
      aria-label="Organizer sections"
    >
      <p className="px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">
        Organizer
      </p>
      {ITEMS.map((item) => {
        const active = section === item.id;
        let badge: string | null = null;
        if (item.id === "submissions") badge = String(submissionCount);
        if (item.id === "facilitators") badge = String(facilitatorCount);

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSection(item.id)}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
              active
                ? "bg-orange-500/15 text-orange-100 ring-1 ring-orange-400/40"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span>
              <span className="block font-semibold">{item.label}</span>
              <span className="block text-[10px] text-slate-500">{item.hint}</span>
            </span>
            {badge !== null ? (
              <span className="font-mono text-xs text-cyan-300">{badge}</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
