"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatBucketLabel, formatNumber } from "@/lib/format";
import type { TrendRow, Granularity } from "@/lib/data";

type Series = { id: string; name: string; color: string };

export function TrafficChart({
  data,
  series,
  granularity = "day",
}: {
  data: TrendRow[];
  series: Series[];
  granularity?: Granularity;
}) {
  const labelFmt = (v: string) => formatBucketLabel(String(v), granularity);
  if (data.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-muted">
        Нет данных за выбранный период
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient
              key={s.id}
              id={`grad-${s.id}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#263150" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={labelFmt}
          stroke="#9aa7c2"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          stroke="#9aa7c2"
          fontSize={12}
          tickLine={false}
          tickFormatter={(v) => formatNumber(v)}
          width={50}
        />
        <Tooltip
          contentStyle={{
            background: "#131a2e",
            border: "1px solid #263150",
            borderRadius: 12,
            color: "#e8edf7",
          }}
          labelFormatter={(l) => labelFmt(String(l))}
          formatter={(value, name) => [formatNumber(Number(value)), String(name)]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Area
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.name}
            stackId="1"
            stroke={s.color}
            fill={`url(#grad-${s.id})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
