"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ForecastPoint, SkillResult } from "@/types/scm";

const colors = ["#0f766e", "#f59e0b", "#2563eb", "#dc2626", "#7c3aed", "#16a34a"];

export function ForecastChart({ data }: { data: ForecastPoint[] }) {
  const actualData = data.filter((point) => !point.isFuture);
  const futureData = data.filter((point) => point.isFuture);
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={[...actualData, ...futureData]}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="period" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="actual" fill="#94a3b8" name="Actual" isAnimationActive={false} />
        <Line type="monotone" dataKey="adjustedForecast" stroke="#0f766e" strokeWidth={3} name="Adjusted forecast" isAnimationActive={false} />
        <Line type="monotone" dataKey="trendForecast" stroke="#99f6e4" strokeWidth={2} strokeDasharray="5 5" name="12-month future forecast" isAnimationActive={false} />
        <Line type="monotone" dataKey="weightedMovingAverage" stroke="#f59e0b" strokeWidth={2} name="Weighted MA" isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function SkillChart({ skill }: { skill: SkillResult }) {
  const data = skill.chartData as Record<string, number | string>[];
  if (!data.length) {
    return <div className="grid h-64 place-items-center rounded-md border border-dashed border-border bg-slate-50 text-sm text-muted-foreground">Relevant data not found</div>;
  }
  if (skill.id.includes("customer")) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="demand" nameKey="region" outerRadius={96} label isAnimationActive={false}>
            {data.map((_, index) => (
              <Cell key={index} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (skill.id.includes("market")) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="trendIndex" stroke="#0f766e" fill="#ccfbf1" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  if (skill.id.includes("promotion")) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="promotion" name="Promotion" />
          <YAxis dataKey="demand" name="Demand" />
          <Tooltip />
          <Scatter data={data} fill="#f59e0b" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }
  if (skill.id.includes("competitor")) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="competitor" />
          <Radar dataKey="promotionIntensity" stroke="#dc2626" fill="#fecaca" fillOpacity={0.7} isAnimationActive={false} />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xAxisKey(data[0])} />
        <YAxis />
        <Tooltip />
        <Bar dataKey={primaryNumberKey(data[0])} fill="#0f766e" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function xAxisKey(row: Record<string, number | string>) {
  const preferred = ["period", "month", "metric", "stage", "indicator", "priority", "source", "label", "type"];
  return preferred.find((key) => key in row) ?? Object.keys(row)[0] ?? "label";
}

function primaryNumberKey(row: Record<string, number | string>) {
  const preferred = [
    "actual",
    "adjustedForecast",
    "demand",
    "value",
    "score",
    "days",
    "risk",
    "inflation",
    "qualityScore",
    "rows",
    "recommendedStock",
    "reorderPoint"
  ];
  const preferredKey = preferred.find((key) => typeof row?.[key] === "number");
  if (preferredKey) return preferredKey;
  return Object.keys(row ?? {}).find((key) => typeof row?.[key] === "number" && !["index", "lat", "lng", "latitude", "longitude"].includes(key.toLowerCase())) ?? "value";
}
