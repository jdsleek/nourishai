"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { WeightEntry } from "@/lib/types";

interface Props {
  data: WeightEntry[];
  targetKg?: number;
}

export default function WeightChart({ data, targetKg }: Props) {
  const formatted = data.map((d) => ({
    date: d.date,
    label: new Date(d.date + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    kg: d.weightKg,
  }));

  if (formatted.length === 0) {
    return (
      <div className="grid h-72 place-items-center rounded-xl border border-dashed border-stone-300 text-sm text-stone-500 dark:border-stone-700">
        Log your first weight entry to see the chart.
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="label" fontSize={12} tick={{ fill: "#78716c" }} />
          <YAxis
            domain={["auto", "auto"]}
            fontSize={12}
            tick={{ fill: "#78716c" }}
            unit=" kg"
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e7e5e4",
              fontSize: 13,
            }}
            formatter={(value: number) => [`${value} kg`, "Weight"]}
          />
          {targetKg && (
            <ReferenceLine
              y={targetKg}
              stroke="#16a34a"
              strokeDasharray="4 4"
              label={{
                value: `Goal ${targetKg} kg`,
                position: "insideTopRight",
                fill: "#16a34a",
                fontSize: 11,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="kg"
            stroke="#16a34a"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#16a34a" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
