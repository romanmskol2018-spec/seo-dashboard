"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatDateShort, formatPct } from "@/lib/format";
import type { TrendRow } from "@/lib/data";

type Series = { id: string; name: string; color: string };

export function VisibilityChart({
  data,
  series,
}: {
  data: TrendRow[];
  series: Series[];
}) {
  if (data.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-muted">
        Нет данных за выбранный период
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#263150" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateShort}
          stroke="#9aa7c2"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          stroke="#9aa7c2"
          fontSize={12}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
          width={45}
          domain={[0, "auto"]}
        />
        <Tooltip
          contentStyle={{
            background: "#131a2e",
            border: "1px solid #263150",
            borderRadius: 12,
            color: "#e8edf7",
          }}
          labelFormatter={(l) => formatDateShort(String(l))}
          formatter={(value, name) => [formatPct(Number(value)), String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
