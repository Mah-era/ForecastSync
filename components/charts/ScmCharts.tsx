"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ReferenceLine,
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

  if (skill.id === "historical-sales") {
    const hasRevenue = data.some((d) => "revenueBDT" in d && Number(d.revenueBDT) > 0);
    const hasActual = data.some((d) => "actual" in d);
    if (hasRevenue) {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" />
            <YAxis yAxisId="left" orientation="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="right" dataKey="revenueBDT" fill="#ccfbf1" name="Revenue BDT" isAnimationActive={false} />
            <Line yAxisId="left" type="monotone" dataKey="unitsSold" stroke="#0f766e" strokeWidth={2} name="Units Sold" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }
    if (hasActual) {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="actual" fill="#94a3b8" name="Actual Demand" isAnimationActive={false} />
            <Line type="monotone" dataKey="adjustedForecast" stroke="#0f766e" strokeWidth={2} name="Adjusted Forecast" isAnimationActive={false} />
            <Line type="monotone" dataKey="weightedMovingAverage" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" name="Weighted MA" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }
  }

  if (skill.id === "forecast-accuracy") {
    const hasErrorData = data.some((d) => "forecastError" in d);
    if (hasErrorData) {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" />
            <YAxis yAxisId="left" orientation="left" />
            <YAxis yAxisId="right" orientation="right" unit="%" />
            <Tooltip />
            <Legend />
            <ReferenceLine yAxisId="left" y={0} stroke="#64748b" strokeDasharray="3 3" />
            <Bar yAxisId="left" dataKey="forecastError" name="Forecast Error" isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell key={index} fill={Number(entry.forecastError) >= 0 ? "#0f766e" : "#ef4444"} />
              ))}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="absolutePercentageError" stroke="#dc2626" strokeWidth={2} name="APE %" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip />
          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
          <Bar dataKey="error" name="Forecast Error" isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={index} fill={Number(entry.error) >= 0 ? "#0f766e" : "#ef4444"} />
            ))}
          </Bar>
          <Line type="monotone" dataKey="absolutePercentageError" stroke="#dc2626" strokeWidth={2} name="APE %" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (skill.id === "inventory-levels") {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" />
          <YAxis dataKey="metric" type="category" width={140} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" name="Units" isAnimationActive={false}>
            {data.map((entry, index) => {
              const metric = String((entry as Record<string, unknown>).metric ?? "").toLowerCase();
              const fill = metric.includes("current") ? "#0f766e"
                : metric.includes("gap") ? "#ef4444"
                : metric.includes("safety") ? "#f59e0b"
                : metric.includes("reorder") ? "#2563eb"
                : "#94a3b8";
              return <Cell key={index} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (skill.id === "economic-conditions") {
    const hasInflation = data.some((d) => "inflation" in d && Number(d.inflation) > 0);
    if (hasInflation) {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="indicator" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="inflation" stroke="#dc2626" strokeWidth={2} name="Inflation %" isAnimationActive={false} />
            <Line type="monotone" dataKey="risk" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="Economic Risk" isAnimationActive={false} />
            <Line type="monotone" dataKey="demand" stroke="#0f766e" strokeWidth={2} name="Demand Impact" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      );
    }
  }

  if (skill.id === "lead-time") {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" unit=" days" />
          <YAxis dataKey="stage" type="category" width={130} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="days" name="Lead Time Days" isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={index} fill={Number(entry.days) > 21 ? "#ef4444" : Number(entry.days) > 14 ? "#f59e0b" : "#0f766e"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (skill.id === "seasonality") {
    const hasSeasonalIndex = data.some((d) => "seasonalityIndex" in d);
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="demand" fill="#ccfbf1" name="Demand" isAnimationActive={false} />
          <Line yAxisId="right" type="monotone" dataKey="festivalLift" stroke="#f59e0b" strokeWidth={2} name="Festival Lift %" isAnimationActive={false} />
          {hasSeasonalIndex && <Line yAxisId="right" type="monotone" dataKey="seasonalityIndex" stroke="#0f766e" strokeWidth={2} strokeDasharray="4 4" name="Seasonality Index" isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    );
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
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" unit="%" />
          <Tooltip />
          <Legend />
          <Area yAxisId="left" type="monotone" dataKey="trendIndex" stroke="#0f766e" fill="#ccfbf1" name="Demand Index" isAnimationActive={false} />
          {data.some((d) => "growthPct" in d) && (
            <Line yAxisId="right" type="monotone" dataKey="growthPct" stroke="#f59e0b" strokeWidth={2} name="Growth %" isAnimationActive={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (skill.id.includes("promotion")) {
    const hasUplift = data.some((d) => "promotion" in d && "demand" in d);
    if (hasUplift) {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="promotion" name="Discount / Promotion %" unit="%" />
            <YAxis dataKey="demand" name="Demand" />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data} fill="#f59e0b" isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }
  }

  if (skill.id.includes("competitor")) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="competitor" />
          <Radar dataKey="promotionIntensity" stroke="#dc2626" fill="#fecaca" fillOpacity={0.7} name="Promotion Intensity" isAnimationActive={false} />
          {data.some((d) => "price" in d && Number(d.price) > 0) && (
            <Radar dataKey="price" stroke="#2563eb" fill="#bfdbfe" fillOpacity={0.4} name="Price" isAnimationActive={false} />
          )}
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
