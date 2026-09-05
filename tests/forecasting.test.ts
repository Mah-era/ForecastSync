import test from "node:test";
import assert from "node:assert/strict";
import { ANALYSIS_HISTORY_VERSION, parseAnalysisHistory } from "../lib/analysis/history";
import { buildForecast } from "../lib/forecasting/models";
import { runDemandAnalysis } from "../lib/scm/analyze";
import { getWebSearchAvailability } from "../lib/web-search/search";
import type { AnalysisRequest, UploadedDataset, WebSearchResult } from "../types/scm";

const offlineSearch: WebSearchResult = {
  query: "test",
  provider: "unavailable",
  summary: "Offline baseline",
  sources: [],
  trendSignals: { marketTrendIndex: 50, competitorPressure: 35, economicRisk: 35, seasonalLift: 10, promotionPressure: 30 }
};

const demandRows = Array.from({ length: 12 }, (_, index) => ({
  Month: `2025-${String(index + 1).padStart(2, "0")}-01`,
  ProductName: "Baseline Tea",
  Brand: "ForecastSync Lab",
  Demand: 100 + index * 4
}));

const dataset: UploadedDataset = {
  id: "baseline-sales",
  name: "baseline.csv",
  type: "Historical Sales Data",
  rows: demandRows,
  columns: Object.keys(demandRows[0]),
  qualityScore: 100,
  issues: []
};

test("stable demand meets the documented accuracy baseline", () => {
  const forecast = buildForecast([dataset], offlineSearch);
  assert.equal(forecast.points.length, 12);
  assert.equal(forecast.futurePoints.length, 12);
  assert.ok(forecast.accuracy >= 85, `Expected at least 85% accuracy, received ${forecast.accuracy}%`);
  assert.ok(forecast.nextPeriodForecast > 0);
});

test("the full analysis pipeline produces decision outputs", async () => {
  const request: AnalysisRequest = {
    selection: { productName: "Baseline Tea", category: "Beverage", brand: "ForecastSync Lab", region: "Bangladesh" },
    inputFactors: ["Historical Sales Data", "Forecasting Methods", "Forecast Accuracy", "Future 12-Month Forecast"],
    outputSections: ["Demand Forecast", "Forecast Accuracy Report", "Final SCM Recommendation", "Risk Alerts", "Action Plan"],
    uploadedDatasets: [dataset]
  };
  const result = await runDemandAnalysis(request);
  assert.ok(result.skills.length >= 3);
  assert.equal(result.forecast.futurePoints.length, 12);
  assert.ok(result.finalRecommendation.length > 20);
  assert.ok(result.actionPlan.length > 0);
});

test("provider readiness is explicit", () => {
  assert.equal(getWebSearchAvailability({} as NodeJS.ProcessEnv).available, false);
  assert.equal(getWebSearchAvailability({ TAVILY_API_KEY: "configured" } as NodeJS.ProcessEnv).provider, "tavily");
});

test("history rejects old or malformed analysis versions", () => {
  const valid = { id: "one", version: ANALYSIS_HISTORY_VERSION, createdAt: "2025-01-01T00:00:00.000Z", label: "Tea", result: { forecast: {} } };
  const old = { ...valid, id: "old", version: 0 };
  assert.deepEqual(parseAnalysisHistory(JSON.stringify([valid, old, null])).map((item) => item.id), ["one"]);
});
