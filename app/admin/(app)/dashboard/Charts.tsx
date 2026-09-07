"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const GOLD = "#e3c46a";
const GOLD_DEEP = "#9a7c1e";
const ROSE = "#e06c75";
const GRID = "#2a2318";
const AXIS = "#8a7f6c";

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
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke={AXIS} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={AXIS} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(l, p) => p?.[0]?.payload?.full ?? String(l)}
          />
          <Bar dataKey="cases" name="Total" fill={GOLD} radius={[4, 4, 0, 0]} />
          <Bar dataKey="open" name="Open" fill={GOLD_DEEP} radius={[4, 4, 0, 0]} />
        </BarChart>
      </Panel>

      <Panel title="Cases by category">
        <BarChart data={byCategory} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke={AXIS} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} stroke={AXIS} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(l, p) => p?.[0]?.payload?.full ?? String(l)}
          />
          <Bar dataKey="cases" name="Cases" radius={[0, 4, 4, 0]}>
            {byCategory.map((_, i) => (
              <Cell key={i} fill={i % 2 === 0 ? GOLD : GOLD_DEEP} />
            ))}
          </Bar>
        </BarChart>
      </Panel>

      <Panel title="Resolved at branch vs escalated">
        <BarChart data={resolutionSplit} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke={AXIS} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={AXIS} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="atBranch" stackId="a" name="At branch" fill={GOLD} radius={[0, 0, 0, 0]} />
          <Bar dataKey="escalated" stackId="a" name="Escalated" fill={ROSE} radius={[4, 4, 0, 0]} />
        </BarChart>
      </Panel>

      <Panel title="Last 30 days">
        <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="name" interval={5} tick={{ fontSize: 10 }} stroke={AXIS} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={AXIS} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone" dataKey="cases" name="Cases" stroke={GOLD}
            strokeWidth={2} dot={false}
          />
        </LineChart>
      </Panel>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #3d2f14",
  background: "#100d09",
  color: "#f8f1e2",
  fontSize: 12,
  boxShadow: "0 4px 16px rgb(0 0 0 / 0.6)",
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
