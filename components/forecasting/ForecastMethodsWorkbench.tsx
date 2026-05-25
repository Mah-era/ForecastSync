"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { Activity, ArrowLeft, BarChart3, Boxes, CheckCircle2, Info, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/dashboard/DataTable";
import { CausalDiagram, DelphiLoopDiagram, MapeGauge, QualitativeFlowDiagram } from "@/components/forecasting/diagrams/ForecastDiagrams";
import { bestMethod, calculateForecastMethods, defaultDemandSeries, detectPatterns, type DemandPoint, type ForecastMethodName } from "@/lib/forecasting/advanced";

const patternData = {
  trend: defaultDemandSeries.map((point, index) => ({ period: point.period, value: 900 + index * 55 })),
  seasonality: defaultDemandSeries.map((point, index) => ({ period: point.period, value: 1100 + Math.sin(index * 1.3) * 260 })),
  cycle: Array.from({ length: 16 }).map((_, index) => ({ period: `Y${index + 1}`, value: 1200 + Math.sin(index / 1.7) * 260 })),
  random: defaultDemandSeries.map((point, index) => ({ period: point.period, value: point.actual + (index === 6 ? 420 : index === 8 ? -260 : 0) })),
  level: defaultDemandSeries.map((point, index) => ({ period: point.period, value: 1200 + Math.sin(index * 2.1) * 45, average: 1200 })),
  noise: defaultDemandSeries.map((point, index) => ({ period: point.period, actual: point.actual + Math.sin(index * 4.1) * 90, smoothed: point.actual }))
};

export function ForecastMethodsWorkbench({ initialSeries = defaultDemandSeries }: { initialSeries?: DemandPoint[] }) {
  const [movingWindow, setMovingWindow] = useState(3);
  const [alpha, setAlpha] = useState(0.35);
  const [method, setMethod] = useState<ForecastMethodName>("Weighted Moving Average");
  const summaries = useMemo(() => calculateForecastMethods(initialSeries, movingWindow, alpha), [alpha, initialSeries, movingWindow]);
  const selectedSummary = summaries.find((item) => item.method === method) ?? summaries[0];
  const best = bestMethod(summaries);
  const patterns = detectPatterns(initialSeries);

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-border bg-white px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <a href="/" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"><ArrowLeft size={16} />Back to ForecastSync</a>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="low">ForecastSync SCM module</Badge>
              <Badge>Interactive calculator</Badge>
              <Badge>Recharts visuals</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Forecast Methods</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Explain, visualize, and calculate forecasting methods used in demand planning, inventory planning, and SCM decision reporting.
            </p>
          </div>
          <div className="grid min-w-[320px] gap-2 rounded-lg border border-border bg-slate-50 p-4 sm:grid-cols-3">
            <Signal label="Best method" value={best.method} />
            <Signal label="MAPE" value={`${best.mape}%`} />
            <Signal label="Accuracy" value={`${best.accuracy}%`} />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 p-6">
        <ForecastingModelTypes />
        <ForecastingPatterns patterns={patterns} />
        <QuantitativeTechniques
          series={initialSeries}
          summaries={summaries}
          movingWindow={movingWindow}
          setMovingWindow={setMovingWindow}
          alpha={alpha}
          setAlpha={setAlpha}
        />
        <ForecastErrorMeasurement summary={selectedSummary} method={method} setMethod={setMethod} summaries={summaries} />
        <InteractiveCalculator series={initialSeries} movingWindow={movingWindow} alpha={alpha} summaries={summaries} best={best} />
        <VisualComparisonDashboard summaries={summaries} selected={selectedSummary} best={best} />
        <FinalScmInterpretation best={best} patterns={patterns} />
      </div>
    </main>
  );
}

function ForecastingModelTypes() {
  const timeline = defaultDemandSeries.map((point, index) => ({ ...point, forecast: index > 7 ? point.actual + 130 : null }));
  const causal = defaultDemandSeries.map((point, index) => ({ factor: 10 + index * 6, demand: point.actual }));
  return (
    <section className="grid gap-4">
      <SectionTitle title="Forecasting Model Types" description="Four common model families used in SCM demand planning." />
      <div className="grid gap-4 xl:grid-cols-2">
        <MethodCard title="Time Series Forecasting" definition="Uses past demand or sales data patterns to predict future demand." rules={["Historical line uses actual demand by month.", "Forecasted line begins after the vertical marker.", "Best when demand pattern is visible in past sales."]}>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <ReferenceLine x="Aug" stroke="#334155" label="Forecast starts" />
              <Line dataKey="actual" stroke="#0f766e" strokeWidth={3} name="Historical sales" isAnimationActive={false} />
              <Line dataKey="forecast" stroke="#99f6e4" strokeWidth={3} strokeDasharray="5 5" name="Forecasted demand" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </MethodCard>
        <MethodCard title="Causal / Associative Forecasting" definition="Uses related factors such as price, income, promotion, weather, inflation, economy, and competitor activity to predict demand." rules={["Scatter points compare related business factor vs demand.", "Trend line shows directional relationship.", "Useful when promotion, price, inflation, or income drives demand."]}>
          <ResponsiveContainer width="100%" height={180}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="factor" name="Promotion / price / inflation" />
              <YAxis dataKey="demand" name="Demand" />
              <Tooltip />
              <Scatter data={causal} fill="#0f766e" isAnimationActive={false} />
              <Line dataKey="demand" data={causal} stroke="#f59e0b" dot={false} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
          <CausalDiagram />
        </MethodCard>
        <MethodCard title="Qualitative Forecasting" definition="Based on expert opinion, market research, customer surveys, sales team judgment, and industry knowledge." rules={["Inputs are non-numeric judgment signals.", "Best for new products or weak historical data.", "Should be combined with market research and sales feedback."]}>
          <QualitativeFlowDiagram />
        </MethodCard>
        <MethodCard title="Delphi Method" definition="Forecasting through repeated anonymous expert feedback until a common opinion is reached." rules={["Experts provide repeated feedback rounds.", "A summary is shared between rounds.", "Consensus forecast is used when opinions converge."]}>
          <DelphiLoopDiagram />
        </MethodCard>
      </div>
    </section>
  );
}

function ForecastingPatterns({ patterns }: { patterns: ReturnType<typeof detectPatterns> }) {
  const cards = [
    { title: "Trend", description: "Long-term upward or downward movement.", data: patternData.trend, keys: ["value"] },
    { title: "Seasonality", description: "Repeated daily, weekly, monthly, or yearly pattern with Ramadan, Eid, winter, and summer markers.", data: patternData.seasonality, keys: ["value"] },
    { title: "Cyclical Variation", description: "Long-term wave-like movement caused by business or economic cycles.", data: patternData.cycle, keys: ["value"] },
    { title: "Irregular / Random Variation", description: "Unexpected changes caused by sudden events.", data: patternData.random, keys: ["value"] },
    { title: "Level / Horizontal Pattern", description: "Data moves around a stable average without clear trend.", data: patternData.level, keys: ["value", "average"] },
    { title: "Noise", description: "Small random fluctuations around the main signal.", data: patternData.noise, keys: ["actual", "smoothed"] }
  ];
  return (
    <section className="grid gap-4">
      <SectionTitle title="Forecasting Data Patterns" description="Detect demand components before selecting the forecasting method." />
      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="relative pr-12"><h3 className="font-semibold">{card.title}</h3><p className="text-sm text-muted-foreground">{card.description}</p><InfoTip title={card.title} description={card.description} rules={["Mini chart is illustrative of the named demand pattern.", "Pattern detection panel uses simple heuristic logic.", "Use pattern type to choose an appropriate forecasting method."]} /></CardHeader>
            <CardContent>
              <MiniLineChart data={card.data} keys={card.keys} />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="relative pr-12"><h3 className="font-semibold">Pattern Detection Panel</h3><InfoTip title="Pattern Detection Panel" description="Analyzes the demand series with simple heuristics to flag trend, seasonality, random variation, and stable-level behavior." rules={["Trend compares first-half average against second-half average.", "Seasonality checks repeated high demand months.", "Random variation uses average absolute month-to-month change."]} /></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Signal label="Trend detected" value={patterns.trendDetected ? "Yes" : "No"} />
          <Signal label="Seasonality detected" value={patterns.seasonalityDetected ? "Yes" : "No"} />
          <Signal label="Random variation" value={patterns.randomVariationLevel} />
          <Signal label="Stable level pattern" value={patterns.stableLevelPattern ? "Yes" : "No"} />
        </CardContent>
      </Card>
    </section>
  );
}

function QuantitativeTechniques({
  series,
  summaries,
  movingWindow,
  setMovingWindow,
  alpha,
  setAlpha
}: {
  series: DemandPoint[];
  summaries: ReturnType<typeof calculateForecastMethods>;
  movingWindow: number;
  setMovingWindow: (value: number) => void;
  alpha: number;
  setAlpha: (value: number) => void;
}) {
  const simple = summaries.find((item) => item.method === "Simple Average")!;
  const moving = summaries.find((item) => item.method === "Moving Average")!;
  const weighted = summaries.find((item) => item.method === "Weighted Moving Average")!;
  const smoothing = summaries.find((item) => item.method === "Exponential Smoothing")!;
  const weightedRows = series.slice(-3).reverse().map((point, index) => {
    const weights = [0.5, 0.3, 0.2];
    return { period: point.period, demand: point.actual, weight: weights[index], weightedDemand: Math.round(point.actual * weights[index]) };
  });
  return (
    <section className="grid gap-4">
      <SectionTitle title="Quantitative Forecasting Techniques" description="Calculate method outputs and compare how each technique behaves." />
      <div className="grid gap-4 xl:grid-cols-2">
        <TechniqueCard title="Simple Average Method" summary={simple} rules={["Forecast = average of all previous demand values.", "Horizontal average line shows the baseline.", "Best when demand is stable."]}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <ReferenceLine y={simple.forecastValue} stroke="#f59e0b" label="Average" />
              <Bar dataKey="actual" fill="#0f766e" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </TechniqueCard>
        <TechniqueCard title="Moving Average Method" summary={moving} rules={["Forecast = average of the latest selected periods.", "Window options are 3, 4, and 6 periods.", "Shorter windows react faster to recent demand."]}>
          <div className="mb-3 flex gap-2">
            {[3, 4, 6].map((window) => <Button key={window} variant={movingWindow === window ? "primary" : "secondary"} onClick={() => setMovingWindow(window)}>{window}-period</Button>)}
          </div>
          <ActualForecastLine rows={moving.rows} />
        </TechniqueCard>
        <TechniqueCard title="Weighted Moving Average Method" summary={weighted} rules={["Recent periods receive higher weight.", "Weights are 0.5, 0.3, and 0.2.", "Weights add up to 1."]}>
          <DataTable rows={weightedRows} />
        </TechniqueCard>
        <TechniqueCard title="Exponential Smoothing Method" summary={smoothing} rules={["Forecast = alpha x last actual + (1-alpha) x last forecast.", "Alpha ranges from 0.1 to 0.9.", "Higher alpha reacts faster to new demand changes."]}>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-muted-foreground">Alpha: {alpha.toFixed(1)}</span>
            <input className="w-full" type="range" min="0.1" max="0.9" step="0.1" value={alpha} onChange={(event) => setAlpha(Number(event.target.value))} />
          </label>
          <ActualForecastLine rows={smoothing.rows} />
        </TechniqueCard>
      </div>
    </section>
  );
}

function ForecastErrorMeasurement({ summary, method, setMethod, summaries }: { summary: ReturnType<typeof calculateForecastMethods>[number]; method: ForecastMethodName; setMethod: (value: ForecastMethodName) => void; summaries: ReturnType<typeof calculateForecastMethods> }) {
  return (
    <section className="grid gap-4">
      <SectionTitle title="Forecast Error Measurement" description="Measure bias, absolute deviation, squared error, percentage error, MAPE, and accuracy." />
      <Card>
        <CardHeader className="relative flex flex-row items-center justify-between pr-12">
          <div><h3 className="font-semibold">Error Summary</h3><p className="text-sm text-muted-foreground">Positive error means actual demand was higher than forecast. Negative error means forecast was higher than actual.</p></div>
          <select className="rounded-md border border-border px-3 py-2" value={method} onChange={(event) => setMethod(event.target.value as ForecastMethodName)}>
            {summaries.map((item) => <option key={item.method}>{item.method}</option>)}
          </select>
          <InfoTip title="Forecast Error Measurement" description="Compares forecasted demand against actual demand and converts error into operational accuracy signals." rules={["Error = Actual - Forecast.", "MAD averages absolute errors.", "MSE and RMSE penalize larger errors more.", "MAPE gives scale-free percentage error.", "Forecast Accuracy = 100% - MAPE."]} />
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ActualForecastLine rows={summary.rows} />
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={summary.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="error" fill="#0f766e" name="Forecast Error / Bias" isAnimationActive={false} />
                <Bar dataKey="absoluteError" fill="#f59e0b" name="MAD input" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={summary.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="squaredError" fill="#2563eb" name="Squared error" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
            <div className="grid gap-3">
              <MapeGauge value={summary.mape} />
              <Signal label="MSE vs RMSE" value={`${summary.mse} / ${summary.rmse}`} />
              <Signal label="Forecast Accuracy" value={`${summary.accuracy}%`} />
            </div>
          </div>
          <DataTable rows={summary.rows} />
        </CardContent>
      </Card>
    </section>
  );
}

function InteractiveCalculator({ summaries, best }: { series: DemandPoint[]; movingWindow: number; alpha: number; summaries: ReturnType<typeof calculateForecastMethods>; best: ReturnType<typeof bestMethod> }) {
  return (
    <section className="grid gap-4">
      <SectionTitle title="Interactive Forecast Calculator" description="Changing moving-average window or alpha recalculates the method comparison instantly." />
      <div className="grid gap-4 md:grid-cols-4">
        {summaries.map((summary) => <Signal key={summary.method} label={summary.method} value={String(summary.forecastValue)} />)}
      </div>
      <Card>
        <CardHeader className="relative pr-12"><h3 className="font-semibold">Recommended Calculator Output</h3><InfoTip title="Recommended Calculator Output" description="Shows the automatically selected method with the lowest MAPE after calculator settings are applied." rules={["All methods are recalculated after changing window or alpha.", "Best method is the lowest MAPE.", "Accuracy equals 100% minus MAPE."]} /></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge tone="low">Best method: {best.method}</Badge>
          <Badge>MAPE {best.mape}%</Badge>
          <Badge>Accuracy {best.accuracy}%</Badge>
          <p className="text-sm text-muted-foreground">Use this method as the planning baseline and refresh after the next POS or inventory update.</p>
        </CardContent>
      </Card>
    </section>
  );
}

function VisualComparisonDashboard({ summaries, selected, best }: { summaries: ReturnType<typeof calculateForecastMethods>; selected: ReturnType<typeof calculateForecastMethods>[number]; best: ReturnType<typeof bestMethod> }) {
  return (
    <section className="grid gap-4">
      <SectionTitle title="Visual Comparison Dashboard" description="Compare all forecast methods together and rank accuracy." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader className="relative pr-12"><h3 className="font-semibold">Actual vs Forecasted Demand</h3><InfoTip title="Actual vs Forecasted Demand" description="Compares selected forecast method against actual demand periods." rules={["Actual line uses demand history.", "Forecast line uses the selected method.", "Gap between lines is the forecast error."]} /></CardHeader><CardContent><ActualForecastLine rows={selected.rows} /></CardContent></Card>
        <Card><CardHeader className="relative pr-12"><h3 className="font-semibold">Method Comparison</h3><InfoTip title="Method Comparison" description="Compares forecast value and MAPE across all available methods." rules={["Lower MAPE is better.", "Forecast value is the latest method forecast.", "Use this chart to compare method behavior quickly."]} /></CardHeader><CardContent><MethodBar summaries={summaries} /></CardContent></Card>
        <Card><CardHeader className="relative pr-12"><h3 className="font-semibold">Forecast Error</h3><InfoTip title="Forecast Error" description="Shows period-level bias for the selected forecast method." rules={["Positive bars mean under-forecast.", "Negative bars mean over-forecast.", "Consistent direction indicates forecast bias."]} /></CardHeader><CardContent><ErrorBar rows={selected.rows} /></CardContent></Card>
        <MapeGauge value={best.mape} />
      </div>
      <DataTable rows={summaries.map(({ rows, ...summary }) => summary)} />
    </section>
  );
}

function FinalScmInterpretation({ best, patterns }: { best: ReturnType<typeof bestMethod>; patterns: ReturnType<typeof detectPatterns> }) {
  return (
    <section className="grid gap-4">
      <SectionTitle title="Final SCM Interpretation Panel" description="Translate forecast results into supply chain decisions." />
      <Card>
        <CardHeader className="relative pr-12"><h3 className="font-semibold">SCM Decision Translation</h3><InfoTip title="SCM Decision Translation" description="Converts forecast accuracy, seasonality, and best-method selection into supply chain planning actions." rules={["Demand planning uses the best MAPE method.", "Inventory recommendation accounts for seasonal peaks.", "Promotion warning appears when inventory risk may be high."]} /></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Interpretation icon={TrendingUp} title="Demand planning recommendation" text={`Use ${best.method} as the demand baseline because it has the lowest MAPE at ${best.mape}%.`} />
          <Interpretation icon={Boxes} title="Inventory planning recommendation" text="Increase stock before seasonal peaks and protect the reorder point with a safety stock buffer." />
          <Interpretation icon={Activity} title="Stockout risk" text={patterns.seasonalityDetected ? "Moderate to high around Eid/Ramadan or other peak months." : "Managed, but monitor recent demand changes."} />
          <Interpretation icon={BarChart3} title="Forecast method recommendation" text={`${best.method} is currently the best method; refresh after new POS and inventory data.`} />
          <Interpretation icon={CheckCircle2} title="Production planning note" text="Align production and purchase timing with lead time plus expected demand lift." />
          <Interpretation icon={Activity} title="Promotion planning note" text="Avoid large promotions when available inventory is below reorder point." />
        </CardContent>
      </Card>
    </section>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-xl font-semibold tracking-tight">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}

function MethodCard({ title, definition, rules, children }: { title: string; definition: string; rules: string[]; children: React.ReactNode }) {
  return <Card className="overflow-hidden"><CardHeader className="relative border-b border-border bg-gradient-to-r from-white to-teal-50/40 pr-12"><h3 className="font-semibold">{title}</h3><p className="text-sm leading-6 text-muted-foreground">{definition}</p><InfoTip title={title} description={definition} rules={rules} /></CardHeader><CardContent className="space-y-3 p-4">{children}</CardContent></Card>;
}

function TechniqueCard({ title, summary, rules, children }: { title: string; summary: ReturnType<typeof calculateForecastMethods>[number]; rules: string[]; children: React.ReactNode }) {
  return <Card className="overflow-hidden"><CardHeader className="relative border-b border-border bg-gradient-to-r from-white to-teal-50/40 pr-12"><h3 className="font-semibold">{title}</h3><p className="text-sm text-muted-foreground">Forecast result: {summary.forecastValue} units · MAPE {summary.mape}%</p><InfoTip title={title} description={`${title} produces a forecast value of ${summary.forecastValue} units with MAPE ${summary.mape}%.`} rules={rules} /></CardHeader><CardContent className="space-y-3 p-4">{children}</CardContent></Card>;
}

function InfoTip({ title, description, rules }: { title: string; description: string; rules: string[] }) {
  return (
    <div className="group absolute right-3 top-3 z-20">
      <button type="button" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-white text-slate-500 shadow-sm hover:text-primary" aria-label={`${title} details`}>
        <Info size={16} />
      </button>
      <div className="pointer-events-none absolute right-0 top-10 hidden w-80 max-w-[calc(100vw-48px)] rounded-md border border-border bg-white p-4 text-left text-sm shadow-lg group-hover:block">
        <h3 className="font-semibold text-slate-950">{title}</h3>
        <p className="mt-2 leading-5 text-muted-foreground">{description}</p>
        <div className="mt-3 font-medium text-slate-800">Rules used</div>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
          {rules.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
      </div>
    </div>
  );
}

function MiniLineChart({ data, keys }: { data: Record<string, unknown>[]; keys: string[] }) {
  return <ResponsiveContainer width="100%" height={160}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="period" /><YAxis hide /><Tooltip />{keys.map((key, index) => <Line key={key} dataKey={key} dot={false} stroke={index ? "#f59e0b" : "#0f766e"} strokeWidth={2} isAnimationActive={false} />)}</LineChart></ResponsiveContainer>;
}

function ActualForecastLine({ rows }: { rows: { period: string; actual: number; forecast: number }[] }) {
  return <ResponsiveContainer width="100%" height={260}><LineChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="period" /><YAxis /><Tooltip /><Line dataKey="actual" stroke="#0f766e" strokeWidth={3} isAnimationActive={false} /><Line dataKey="forecast" stroke="#99f6e4" strokeWidth={3} strokeDasharray="5 5" isAnimationActive={false} /></LineChart></ResponsiveContainer>;
}

function MethodBar({ summaries }: { summaries: ReturnType<typeof calculateForecastMethods> }) {
  return <ResponsiveContainer width="100%" height={260}><BarChart data={summaries}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="method" /><YAxis /><Tooltip /><Bar dataKey="forecastValue" fill="#0f766e" isAnimationActive={false} /><Bar dataKey="mape" fill="#f59e0b" isAnimationActive={false} /></BarChart></ResponsiveContainer>;
}

function ErrorBar({ rows }: { rows: { period: string; error: number }[] }) {
  return <ResponsiveContainer width="100%" height={260}><BarChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="period" /><YAxis /><Tooltip /><Bar dataKey="error" fill="#0f766e" isAnimationActive={false} /></BarChart></ResponsiveContainer>;
}

function Signal({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-white p-4"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>;
}

function Interpretation({ icon: Icon, title, text }: { icon: typeof Activity; title: string; text: string }) {
  return <div className="rounded-md border border-border bg-slate-50 p-4"><div className="flex items-center gap-2 font-semibold"><Icon size={18} className="text-primary" />{title}</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>;
}
