"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const PLUM = "#7d2f6b";
const PLUM_LIGHT = "#c56cab";
const AMBER = "#d97706";

type BranchDatum = { name: string; full: string; cases: number; open: number };
type CategoryDatum = { name: string; full: string; cases: number };
type SplitDatum = { name: string; atBranch: number; escalated: number };
type TrendDatum = { name: string; cases: number };

export default function Charts({
  byBranch, byCategory, resolutionSplit, trend,
}: {
  byBranch: BranchDatum[];
  byCategory: CategoryDatum[];
  resolutionSplit: SplitDatum[];
  trend: TrendDatum[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel title="Cases by branch">
        <BarChart data={byBranch} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(l, p) => p?.[0]?.payload?.full ?? String(l)}
          />
          <Bar dataKey="cases" name="Total" fill={PLUM} radius={[4, 4, 0, 0]} />
          <Bar dataKey="open" name="Open" fill={PLUM_LIGHT} radius={[4, 4, 0, 0]} />
        </BarChart>
      </Panel>

      <Panel title="Cases by category">
        <BarChart data={byCategory} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(l, p) => p?.[0]?.payload?.full ?? String(l)}
          />
          <Bar dataKey="cases" name="Cases" radius={[0, 4, 4, 0]}>
            {byCategory.map((_, i) => (
              <Cell key={i} fill={i % 2 === 0 ? PLUM : PLUM_LIGHT} />
            ))}
          </Bar>
        </BarChart>
      </Panel>

      <Panel title="Resolved at branch vs escalated">
        <BarChart data={resolutionSplit} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="atBranch" stackId="a" name="At branch" fill={PLUM} radius={[0, 0, 0, 0]} />
          <Bar dataKey="escalated" stackId="a" name="Escalated" fill={AMBER} radius={[4, 4, 0, 0]} />
        </BarChart>
      </Panel>

      <Panel title="Last 30 days">
        <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="name" interval={5} tick={{ fontSize: 10 }} stroke="#94a3b8" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone" dataKey="cases" name="Cases" stroke={PLUM}
            strokeWidth={2} dot={false}
          />
        </LineChart>
      </Panel>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgb(15 23 42 / 0.08)",
};

function Panel({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}
