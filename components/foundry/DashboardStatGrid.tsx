"use client";

export type StatTone = "cyan" | "orange" | "amber" | "emerald" | "rose" | "slate";

const TONE_RING: Record<StatTone, string> = {
  cyan: "border-cyan-500/30 bg-cyan-950/20",
  orange: "border-orange-500/30 bg-orange-950/20",
  amber: "border-amber-500/30 bg-amber-950/20",
  emerald: "border-emerald-500/30 bg-emerald-950/20",
  rose: "border-rose-500/30 bg-rose-950/20",
  slate: "border-white/10 bg-[#111520]",
};

const TONE_VALUE: Record<StatTone, string> = {
  cyan: "text-cyan-200",
  orange: "text-orange-200",
  amber: "text-amber-200",
  emerald: "text-emerald-200",
  rose: "text-rose-200",
  slate: "text-white",
};

export function DashboardStatCard({
  label,
  value,
  hint,
  tone = "slate",
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatTone;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className={`mt-2 font-mono text-3xl font-bold tabular-nums ${TONE_VALUE[tone]}`}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-slate-400">{hint}</p> : null}
    </>
  );

  const className = `rounded-xl border p-4 text-left transition ${TONE_RING[tone]} ${
    onClick ? "cursor-pointer hover:brightness-110" : ""
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} w-full`}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function DashboardStatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}
