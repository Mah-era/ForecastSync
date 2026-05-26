import type { ForecastPoint, ForecastSummary, UploadedDataset, WebSearchResult } from "@/types/scm";

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const demandKeys = [
  "actual",
  "actualdemand",
  "actualunits",
  "demand",
  "demandunits",
  "forecastdemandunits",
  "quantity",
  "sales",
  "salesunits",
  "unit",
  "units",
  "unitssold"
];
const periodKeys = ["period", "month", "date", "orderdate", "salesdate", "forecastmonth"];
const promotionKeys = ["promotion", "discountpct", "discount", "promoupliftpct", "campaignuplift"];
const festivalKeys = ["festival", "festivalliftpct", "seasonality", "seasonalindex", "seasonallift"];
const inventoryKeys = ["inventory", "currentstock", "stock", "onhand", "stockonhand"];

export function extractDemandSeries(datasets: UploadedDataset[]) {
  const sales =
    datasets.find((dataset) => dataset.type === "Historical Sales Data" && dataset.rows.some(hasDemandValue)) ??
    datasets.find((dataset) => dataset.type === "Forecast Actual Data" && dataset.rows.some(hasDemandValue)) ??
    datasets.find((dataset) => dataset.rows.some(hasDemandValue));
  const rows: Record<string, unknown>[] = sales?.rows?.filter(hasDemandValue) ?? [];
  if (!rows.length) {
    return [];
  }
  return rows.map((row, index) => ({
    period: normalizePeriod(valueByKeys(row, periodKeys) ?? `P${index + 1}`),
    actual: numeric(valueByKeys(row, demandKeys), 0),
    promotion: numeric(valueByKeys(row, promotionKeys), 0),
    festival: numeric(valueByKeys(row, festivalKeys), 0),
    inventory: numeric(valueByKeys(row, inventoryKeys), 0)
  }));
}

function valueByKeys(row: Record<string, unknown>, keys: string[]) {
  const normalized = Object.entries(row).map(([key, value]) => [normalizeKey(key), value] as const);
  return normalized.find(([key, value]) => keys.includes(key) && value !== "")?.[1];
}

function hasDemandValue(row: Record<string, unknown>) {
  return numeric(valueByKeys(row, demandKeys), 0) > 0;
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
}

function stdDev(values: number[]) {
  const avg = average(values);
  return Math.sqrt(average(values.map((value) => (value - avg) ** 2)));
}

export function buildForecast(
  datasets: UploadedDataset[],
  webSearch: WebSearchResult,
  options: { leadTimeDays?: number; serviceLevelFactor?: number } = {}
): ForecastSummary {
  const series = extractDemandSeries(datasets);
  if (!series.length) {
    return {
      points: [],
      futurePoints: [],
      nextPeriodForecast: 0,
      confidenceScore: 0,
      mape: 0,
      accuracy: 0,
      safetyStock: 0,
      reorderPoint: 0,
      recommendedStock: 0,
      methodMetrics: {
        simpleAverage: 0,
        exponentialSmoothing: 0,
        mad: 0,
        mse: 0,
        rmse: 0,
        mpe: 0,
        bias: 0
      }
    };
  }
  const leadTimeDays = options.leadTimeDays ?? 18;
  const serviceLevelFactor = options.serviceLevelFactor ?? 1.65;
  const points: ForecastPoint[] = series.map((row, index) => {
    const history = series.slice(Math.max(0, index - 3), index).map((item) => item.actual);
    const movingAverage = history.length ? average(history) : row.actual;
    const weights = [0.5, 0.3, 0.2];
    const weightedBase = history.slice(-3).reverse();
    const weightedMovingAverage = weightedBase.length
      ? weightedBase.reduce((sum, value, weightIndex) => sum + value * weights[weightIndex], 0) /
        weights.slice(0, weightedBase.length).reduce((sum, value) => sum + value, 0)
      : row.actual;
    const trend = index > 0 ? row.actual - series[index - 1].actual : 0;
    const trendForecast = movingAverage + trend * 0.45;
    const adjustmentMultiplier =
      1 +
      row.festival / 100 +
      row.promotion / 200 +
      webSearch.trendSignals.seasonalLift / 300 -
      webSearch.trendSignals.competitorPressure / 600 -
      webSearch.trendSignals.economicRisk / 700;
    const adjustedForecast = Math.max(0, trendForecast * adjustmentMultiplier);
    const error = row.actual - adjustedForecast;
    const absoluteError = Math.abs(error);
    const absolutePercentageError = row.actual ? (absoluteError / Math.abs(row.actual)) * 100 : 0;
    return {
      period: row.period,
      actual: Math.round(row.actual),
      movingAverage: Math.round(movingAverage),
      weightedMovingAverage: Math.round(weightedMovingAverage),
      trendForecast: Math.round(trendForecast),
      adjustedForecast: Math.round(adjustedForecast),
      error: Math.round(error),
      absoluteError: Math.round(absoluteError),
      absolutePercentageError: Number(absolutePercentageError.toFixed(2))
    };
  });

  const recent = series.slice(-6).map((item) => item.actual);
  const dailyDemand = average(recent) / 30;
  const demandVariability = stdDev(recent) / 30;
  const safetyStock = serviceLevelFactor * demandVariability * Math.sqrt(leadTimeDays);
  const reorderPoint = dailyDemand * leadTimeDays + safetyStock;
  const mape = average(points.map((point) => point.absolutePercentageError));
  const errors = points.map((point) => point.error);
  const absoluteErrors = points.map((point) => point.absoluteError);
  const squaredErrors = errors.map((error) => error ** 2);
  const percentageErrors = points.map((point) => (point.actual ? (point.error / point.actual) * 100 : 0));
  const lastPoint = points[points.length - 1];
  const nextPeriodForecast = Math.max(
    0,
    lastPoint.adjustedForecast *
      (1 + webSearch.trendSignals.marketTrendIndex / 900 + webSearch.trendSignals.seasonalLift / 500)
  );
  const futurePoints = buildFutureForecast(points, webSearch);

  return {
    points,
    futurePoints,
    nextPeriodForecast: Math.round(nextPeriodForecast),
    confidenceScore: Math.max(48, Math.min(96, Math.round(100 - mape - webSearch.trendSignals.economicRisk / 10))),
    mape: Number(mape.toFixed(2)),
    accuracy: Number(Math.max(0, Math.min(100, 100 - mape)).toFixed(2)),
    safetyStock: Math.round(safetyStock),
    reorderPoint: Math.round(reorderPoint),
    recommendedStock: Math.round(nextPeriodForecast + safetyStock),
    methodMetrics: {
      simpleAverage: Math.round(average(series.map((item) => item.actual))),
      exponentialSmoothing: Math.round(exponentialSmoothing(series.map((item) => item.actual), 0.35)),
      mad: Math.round(average(absoluteErrors)),
      mse: Math.round(average(squaredErrors)),
      rmse: Math.round(Math.sqrt(average(squaredErrors))),
      mpe: Number(average(percentageErrors).toFixed(2)),
      bias: Math.round(average(errors))
    }
  };
}

function exponentialSmoothing(values: number[], alpha: number) {
  if (!values.length) return 0;
  return values.slice(1).reduce((forecast, actual) => alpha * actual + (1 - alpha) * forecast, values[0]);
}

function buildFutureForecast(points: ForecastPoint[], webSearch: WebSearchResult): ForecastPoint[] {
  const recent = points.slice(-6);
  const base = recent.at(-1)?.adjustedForecast ?? 0;
  const avgStep = recent.length > 1 ? average(recent.slice(1).map((point, index) => point.adjustedForecast - recent[index].adjustedForecast)) : 0;
  const seasonalPattern = [1.04, 1.06, 1.08, 1.16, 1.2, 1.1, 0.98, 0.96, 1.02, 1.06, 1.1, 1.14];
  const start = nextMonthDate(points.at(-1)?.period);
  return Array.from({ length: 12 }).map((_, index) => {
    const trendBase = Math.max(0, base + avgStep * (index + 1));
    const marketLift = 1 + webSearch.trendSignals.marketTrendIndex / 1800;
    const pressure = 1 - webSearch.trendSignals.competitorPressure / 1600 - webSearch.trendSignals.economicRisk / 1800;
    const adjustedForecast = Math.max(0, trendBase * seasonalPattern[index] * marketLift * pressure);
    return {
      period: formatMonth(addMonths(start, index)),
      actual: 0,
      movingAverage: Math.round(average(recent.map((point) => point.adjustedForecast))),
      weightedMovingAverage: Math.round(trendBase),
      trendForecast: Math.round(trendBase),
      adjustedForecast: Math.round(adjustedForecast),
      error: 0,
      absoluteError: 0,
      absolutePercentageError: 0,
      isFuture: true
    };
  });
}

function nextMonthDate(period?: string) {
  const parsed = period ? new Date(period) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function normalizePeriod(value: unknown) {
  if (typeof value === "number" && value > 30000 && value < 60000) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return String(value);
}
