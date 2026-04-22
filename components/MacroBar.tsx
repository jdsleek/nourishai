"use client";

interface Props {
  label: string;
  current: number;
  target: number;
  unit?: string;
  colorClass?: string;
}

export default function MacroBar({
  label,
  current,
  target,
  unit = "g",
  colorClass = "bg-brand-500",
}: Props) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const over = current > target;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-stone-700 dark:text-stone-300">
          {label}
        </span>
        <span className="tabular-nums text-stone-500 dark:text-stone-400">
          {Math.round(current)}
          {unit} / {target}
          {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
        <div
          className={`${over ? "bg-rose-500" : colorClass} h-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
