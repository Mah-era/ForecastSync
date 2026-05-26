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
  Sankey,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
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
  const tableRows = (skill.tableData ?? []) as Record<string, unknown>[];

  const hasChartData = data.length > 0;
  const hasSankeyRows = skill.id === "customer-demand" && tableRows.some((r) => "segment" in r);

  if (!hasChartData && !hasSankeyRows) {
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
    const hasSkuData = data.some((d) => "currentStock" in d);
    if (hasSkuData) {
      return (
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 52)}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" />
            <YAxis dataKey="sku" type="category" width={80} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="currentStock" name="Current Stock" fill="#0f766e" stackId="a" isAnimationActive={false} />
            <Bar dataKey="stockInTransit" name="In Transit" fill="#99f6e4" stackId="a" isAnimationActive={false} />
            <ReferenceLine x={0} stroke="#64748b" />
          </BarChart>
        </ResponsiveContainer>
      );
    }
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
    const hasInflation = data.some((d) => "inflation" in d && Number(d.inflation) > 0) || data.some((d) => "inflationPct" in d);
    if (hasInflation) {
      return (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="indicator" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="inflationPct" stroke="#dc2626" strokeWidth={2} name="Inflation %" isAnimationActive={false} />
            <Line type="monotone" dataKey="economicRisk" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="Economic Risk" isAnimationActive={false} />
            <Line type="monotone" dataKey="demand" stroke="#0f766e" strokeWidth={2} name="Demand Impact" isAnimationActive={false} />
            <Line type="monotone" dataKey="purchasingPowerIndex" stroke="#7c3aed" strokeWidth={2} strokeDasharray="3 3" name="Purchasing Power" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      );
    }
  }

  if (skill.id === "lead-time") {
    const hasStages = data.some((d) => "purchaseLeadDays" in d);
    if (hasStages) {
      return (
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 52)}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" unit=" days" />
            <YAxis dataKey="supplier" type="category" width={120} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="purchaseLeadDays" name="Purchase" fill="#0f766e" stackId="a" isAnimationActive={false} />
            <Bar dataKey="productionLeadDays" name="Production" fill="#f59e0b" stackId="a" isAnimationActive={false} />
            <Bar dataKey="shippingLeadDays" name="Shipping" fill="#2563eb" stackId="a" isAnimationActive={false} />
            <Bar dataKey="deliveryLeadDays" name="Delivery" fill="#7c3aed" stackId="a" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      );
    }
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

  if (skill.id === "customer-demand") {
    const segRows = tableRows.filter((r) => "segment" in r) as Array<{ segment: string; channel: string; region: string; avgBasketUnits: number }>;
    if (segRows.length > 0) {
      const sankeyData = buildSankeyData(segRows);
      if (sankeyData.nodes.length > 1 && sankeyData.links.length > 0) {
        return (
          <div className="overflow-hidden rounded-md border border-border bg-slate-50 p-2">
            <div className="mb-2 flex flex-wrap gap-3 px-1 text-xs text-muted-foreground">
              {["Segment", "Channel", "Region"].map((label, i) => (
                <span key={label} style={{ color: colors[i] }} className="font-medium">{label}</span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <Sankey
                data={sankeyData as never}
                nodeWidth={12}
                nodePadding={10}
                margin={{ left: 0, right: 160, top: 10, bottom: 10 }}
                link={{ stroke: "#ccfbf1", opacity: 0.7 }}
              />
            </ResponsiveContainer>
          </div>
        );
      }
    }
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

  if (skill.id === "promotion-impact" || skill.id.includes("promotion")) {
    const hasBubbleData = data.some((d) => "actualUpliftPct" in d);
    if (hasBubbleData) {
      const avgExpected = data.length
        ? data.reduce((sum, d) => sum + Number(d.expectedUpliftPct ?? 0), 0) / data.length
        : 0;
      return (
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="discountPct" name="Discount %" unit="%" type="number" label={{ value: "Discount %", position: "insideBottom", offset: -12, fontSize: 11 }} />
            <YAxis dataKey="actualUpliftPct" name="Actual Uplift %" unit="%" type="number" />
            <ZAxis dataKey="budgetBDT" range={[40, 600]} name="Budget BDT" />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <ReferenceLine y={avgExpected} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={2} />
            <Scatter data={data} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell key={index} fill={Number(entry.actualUpliftPct) >= Number(entry.expectedUpliftPct ?? 0) ? "#0f766e" : "#ef4444"} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      );
    }
    const hasOldUplift = data.some((d) => "promotion" in d && "demand" in d);
    if (hasOldUplift) {
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

  if (skill.id === "competitor-activities") {
    return <CompetitorTimeline data={data as Record<string, unknown>[]} />;
  }

  if (skill.id === "forecasting-methods") {
    return <MethodComparisonCards data={data as Record<string, unknown>[]} />;
  }

  if (skill.id === "technology-data") {
    return <HealthMatrixTable data={data as Record<string, unknown>[]} />;
  }

  if (skill.id === "final-recommendation") {
    return <DecisionMatrixTable data={data as Record<string, unknown>[]} />;
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

function CompetitorTimeline({ data }: { data: Record<string, unknown>[] }) {
  if (!data.length) return <div className="grid h-40 place-items-center text-sm text-muted-foreground">No competitor data in current file.</div>;
  return (
    <div className="max-h-72 overflow-y-auto rounded-md border border-border">
      <table className="w-full min-w-[560px] text-xs">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            {["Competitor", "Date", "Price BDT", "Promo", "Launch", "Price Drop", "Intensity"].map((h) => (
              <th key={h} className="border-b border-border px-3 py-2 text-left font-semibold text-slate-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const promoActive = row.promoActive === true || row.promoActive === "true" || row.promoActive === 1;
            const launchEvent = row.launchEvent === true || row.launchEvent === "true" || row.launchEvent === 1;
            const priceDrop = row.priceDrop === true || row.priceDrop === "true" || row.priceDrop === 1;
            return (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{String(row.competitorName ?? "—")}</td>
                <td className="px-3 py-2 text-muted-foreground">{String(row.date ?? "—")}</td>
                <td className="px-3 py-2">{Number(row.competitorPriceBDT) > 0 ? Number(row.competitorPriceBDT).toLocaleString() : "—"}</td>
                <td className="px-3 py-2">{promoActive ? <EventTag color="orange" label="Active" /> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2">{launchEvent ? <EventTag color="blue" label="Launch" /> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2">{priceDrop ? <EventTag color="red" label="Drop" /> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2">
                  {Number(row.promotionIntensity) > 0 ? (
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 rounded-full bg-rose-200" style={{ width: `${Math.min(100, Number(row.promotionIntensity))}%`, minWidth: 4 }} />
                      <span>{Number(row.promotionIntensity).toFixed(0)}</span>
                    </div>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EventTag({ color, label }: { color: "orange" | "blue" | "red"; label: string }) {
  const cls = color === "orange" ? "bg-amber-100 text-amber-700" : color === "blue" ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700";
  return <span className={`inline-block rounded px-1.5 py-0.5 font-semibold ${cls}`}>{label}</span>;
}

function MethodComparisonCards({ data }: { data: Record<string, unknown>[] }) {
  if (!data.length) return <div className="grid h-40 place-items-center text-sm text-muted-foreground">No forecast method data.</div>;
  const minMape = Math.min(...data.map((d) => Number(d.mape)));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((method, i) => {
        const isBest = Number(method.mape) === minMape;
        return (
          <div key={i} className={`rounded-md border p-4 ${isBest ? "border-teal-400 bg-teal-50 shadow-sm" : "border-border bg-white"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-slate-800">{String(method.method)}</div>
              {isBest && <span className="shrink-0 rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white">Best</span>}
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {Number(method.forecast) > 0 ? Number(method.forecast).toLocaleString() : "—"}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <div>MAPE: <span className={`font-medium ${Number(method.mape) > 20 ? "text-rose-600" : "text-slate-700"}`}>{Number(method.mape).toFixed(1)}%</span></div>
              <div>Confidence: <span className="font-medium text-slate-700">{Number(method.confidence)}%</span></div>
              <div>MAD: <span className="font-medium text-slate-700">{Number(method.mad).toFixed(0)}</span></div>
              <div>RMSE: <span className="font-medium text-slate-700">{Number(method.rmse).toFixed(0)}</span></div>
              <div className="col-span-2 mt-1 italic text-slate-500">{String(method.useCase)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HealthMatrixTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data.length) return <div className="grid h-40 place-items-center text-sm text-muted-foreground">No data source health data.</div>;
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[600px] text-xs">
        <thead className="bg-slate-50">
          <tr>
            {["Source Type", "Connector", "Status", "Records", "Quality", "Notes"].map((h) => (
              <th key={h} className="border-b border-border px-3 py-2 text-left font-semibold text-slate-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const status = String(row.status ?? "");
            const badgeCls = status === "Available" ? "bg-teal-100 text-teal-700" : status === "Missing" ? "bg-rose-100 text-rose-700" : status === "Needs API Key" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
            const quality = Number(row.dataQualityScore);
            return (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{String(row.sourceType ?? "—")}</td>
                <td className="px-3 py-2 text-muted-foreground">{String(row.connectorType ?? "—")}</td>
                <td className="px-3 py-2"><span className={`inline-block rounded px-2 py-0.5 font-semibold ${badgeCls}`}>{status || "—"}</span></td>
                <td className="px-3 py-2">{Number(row.recordsDetected) > 0 ? Number(row.recordsDetected).toLocaleString() : "—"}</td>
                <td className="px-3 py-2">
                  {quality > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-teal-500" style={{ width: `${quality}%` }} />
                      </div>
                      <span>{quality}%</span>
                    </div>
                  ) : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{String(row.notes ?? "—")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DecisionMatrixTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data.length) return <div className="grid h-40 place-items-center text-sm text-muted-foreground">No decision matrix data.</div>;
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            {["Risk Driver", "Signal", "Risk Level", "Rule Triggered", "Recommended Action", "Priority", "Source Module"].map((h) => (
              <th key={h} className="border-b border-border px-3 py-2 text-left font-semibold text-slate-700 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const level = String(row.riskLevel ?? "").toLowerCase();
            const priority = String(row.priority ?? "").toLowerCase();
            const riskCls = level === "high" ? "bg-rose-100 text-rose-700" : level === "critical" ? "bg-rose-200 text-rose-900" : level === "medium" ? "bg-amber-100 text-amber-700" : "bg-teal-50 text-teal-700";
            const priorityCls = priority === "critical" ? "bg-rose-200 text-rose-900 font-bold" : priority === "high" ? "bg-rose-100 text-rose-700 font-semibold" : priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
            return (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{String(row.riskDriver ?? "—")}</td>
                <td className="px-3 py-2 font-semibold text-slate-900">{Number(row.signalValue) > 0 ? Number(row.signalValue).toFixed(1) : "—"}</td>
                <td className="px-3 py-2"><span className={`inline-block rounded px-2 py-0.5 ${riskCls}`}>{String(row.riskLevel ?? "—")}</span></td>
                <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate" title={String(row.ruleTrigger ?? "")}>{String(row.ruleTrigger ?? "—")}</td>
                <td className="px-3 py-2 text-slate-700 max-w-[200px]">{String(row.recommendedAction ?? "—")}</td>
                <td className="px-3 py-2 whitespace-nowrap"><span className={`inline-block rounded px-2 py-0.5 ${priorityCls}`}>{String(row.priority ?? "—")}</span></td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{String(row.sourceModule ?? "—")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function buildSankeyData(rows: Array<{ segment: string; channel: string; region: string; avgBasketUnits: number }>) {
  const segments = [...new Set(rows.map((r) => r.segment).filter(Boolean))];
  const channels = [...new Set(rows.map((r) => r.channel).filter(Boolean))];
  const regions = [...new Set(rows.map((r) => r.region).filter(Boolean))];

  if (!segments.length || !channels.length || !regions.length) return { nodes: [], links: [] };

  const nodes = [
    ...segments.map((name) => ({ name })),
    ...channels.map((name) => ({ name })),
    ...regions.map((name) => ({ name }))
  ];

  const chanOffset = segments.length;
  const regOffset = segments.length + channels.length;

  const scLinks = new Map<string, number>();
  const crLinks = new Map<string, number>();

  rows.forEach((row) => {
    const val = Math.max(1, row.avgBasketUnits || 1);
    const scKey = `${row.segment}|||${row.channel}`;
    scLinks.set(scKey, (scLinks.get(scKey) ?? 0) + val);
    const crKey = `${row.channel}|||${row.region}`;
    crLinks.set(crKey, (crLinks.get(crKey) ?? 0) + val);
  });

  const links: { source: number; target: number; value: number }[] = [];
  scLinks.forEach((value, key) => {
    const [seg, chan] = key.split("|||");
    const si = segments.indexOf(seg);
    const ci = channels.indexOf(chan);
    if (si !== -1 && ci !== -1) links.push({ source: si, target: ci + chanOffset, value });
  });
  crLinks.forEach((value, key) => {
    const [chan, reg] = key.split("|||");
    const ci = channels.indexOf(chan);
    const ri = regions.indexOf(reg);
    if (ci !== -1 && ri !== -1) links.push({ source: ci + chanOffset, target: ri + regOffset, value });
  });

  return { nodes, links };
}

function xAxisKey(row: Record<string, number | string>) {
  const preferred = ["period", "month", "metric", "stage", "indicator", "priority", "source", "label", "type", "method", "sourceType", "riskDriver", "supplier", "competitorName"];
  return preferred.find((key) => key in row) ?? Object.keys(row)[0] ?? "label";
}

function primaryNumberKey(row: Record<string, number | string>) {
  const preferred = [
    "actual", "adjustedForecast", "demand", "value", "score", "days", "risk",
    "inflation", "qualityScore", "rows", "recommendedStock", "reorderPoint", "forecast", "trendIndex", "signalValue"
  ];
  const preferredKey = preferred.find((key) => typeof row?.[key] === "number");
  if (preferredKey) return preferredKey;
  return Object.keys(row ?? {}).find((key) => typeof row?.[key] === "number" && !["index", "lat", "lng", "latitude", "longitude"].includes(key.toLowerCase())) ?? "value";
}
