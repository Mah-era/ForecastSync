export type DemandPoint = { period: string; actual: number };

export type ForecastMethodName = "Simple Average" | "Moving Average" | "Weighted Moving Average" | "Exponential Smoothing";

export type ForecastRow = {
  period: string;
  actual: number;
  forecast: number;
  error: number;
  absoluteError: number;
  squaredError: number;
  percentageError: number;
  absolutePercentageError: number;
};

export type MethodSummary = {
  method: ForecastMethodName;
  forecastValue: number;
  mad: number;
  mse: number;
  rmse: number;
  mpe: number;
  mape: number;
  accuracy: number;
  bestUseCase: string;
  rows: ForecastRow[];
};

export const defaultDemandSeries: DemandPoint[] = [
  { period: "Jan", actual: 1040 },
  { period: "Feb", actual: 1110 },
  { period: "Mar", actual: 1190 },
  { period: "Ramadan", actual: 1450 },
  { period: "Eid", actual: 1580 },
  { period: "Jun", actual: 1290 },
  { period: "Jul", actual: 1180 },
  { period: "Aug", actual: 1215 },
  { period: "Sep", actual: 1280 },
  { period: "Oct", actual: 1360 },
  { period: "Nov", actual: 1420 },
  { period: "Dec", actual: 1510 }
];

export function calculateForecastMethods(series: DemandPoint[], movingWindow: number, alpha: number): MethodSummary[] {
  return [
    summarizeMethod("Simple Average", buildSimpleAverageRows(series), "Stable products with no strong trend or seasonality."),
    summarizeMethod("Moving Average", buildMovingAverageRows(series, movingWindow), "Short-term planning when recent demand is more relevant."),
    summarizeMethod("Weighted Moving Average", buildWeightedMovingAverageRows(series), "Demand that is changing and recent periods deserve more weight."),
    summarizeMethod("Exponential Smoothing", buildExponentialSmoothingRows(series, alpha), "Operational forecasting that needs a smooth but responsive forecast.")
  ];
}

export function detectPatterns(series: DemandPoint[]) {
  const values = series.map((point) => point.actual);
  const firstHalf = average(values.slice(0, Math.ceil(values.length / 2)));
  const secondHalf = average(values.slice(Math.floor(values.length / 2)));
  const trendRatio = firstHalf ? (secondHalf - firstHalf) / firstHalf : 0;
  const changes = values.slice(1).map((value, index) => value - values[index]);
  const volatility = average(changes.map(Math.abs)) / Math.max(1, average(values));
  const highMonths = values.filter((value) => value > average(values) * 1.12).length;
  return {
    trendDetected: Math.abs(trendRatio) > 0.08,
    seasonalityDetected: highMonths >= 2,
    randomVariationLevel: volatility > 0.18 ? "High" : volatility > 0.09 ? "Medium" : "Low",
    stableLevelPattern: Math.abs(trendRatio) <= 0.05 && volatility < 0.08
  };
}

export function bestMethod(summaries: MethodSummary[]) {
  return summaries.reduce((best, item) => (item.mape < best.mape ? item : best), summaries[0]);
}

function buildSimpleAverageRows(series: DemandPoint[]) {
  return series.map((point, index) => {
    const history = series.slice(0, index).map((item) => item.actual);
    return buildRow(point, history.length ? average(history) : point.actual);
  });
}

function buildMovingAverageRows(series: DemandPoint[], windowSize: number) {
  return series.map((point, index) => {
    const history = series.slice(Math.max(0, index - windowSize), index).map((item) => item.actual);
    return buildRow(point, history.length ? average(history) : point.actual);
  });
}

function buildWeightedMovingAverageRows(series: DemandPoint[]) {
  const weights = [0.5, 0.3, 0.2];
  return series.map((point, index) => {
    const history = series.slice(Math.max(0, index - 3), index).map((item) => item.actual).reverse();
    const weightTotal = weights.slice(0, history.length).reduce((sum, weight) => sum + weight, 0);
    const forecast = history.length ? history.reduce((sum, value, weightIndex) => sum + value * weights[weightIndex], 0) / weightTotal : point.actual;
    return buildRow(point, forecast);
  });
}

function buildExponentialSmoothingRows(series: DemandPoint[], alpha: number) {
  let previousForecast = series[0]?.actual ?? 0;
  return series.map((point, index) => {
    if (index === 0) return buildRow(point, point.actual);
    const forecast = alpha * series[index - 1].actual + (1 - alpha) * previousForecast;
    previousForecast = forecast;
    return buildRow(point, forecast);
  });
}

function summarizeMethod(method: ForecastMethodName, rows: ForecastRow[], bestUseCase: string): MethodSummary {
  const mad = average(rows.map((row) => row.absoluteError));
  const mse = average(rows.map((row) => row.squaredError));
  const rmse = Math.sqrt(mse);
  const mpe = average(rows.map((row) => row.percentageError));
  const mape = average(rows.map((row) => row.absolutePercentageError));
  return {
    method,
    forecastValue: Math.round(rows.at(-1)?.forecast ?? 0),
    mad: round(mad),
    mse: round(mse),
    rmse: round(rmse),
    mpe: round(mpe),
    mape: round(mape),
    accuracy: round(Math.max(0, 100 - mape)),
    bestUseCase,
    rows
  };
}

function buildRow(point: DemandPoint, forecast: number): ForecastRow {
  const error = point.actual - forecast;
  const absoluteError = Math.abs(error);
  const percentageError = point.actual ? (error / point.actual) * 100 : 0;
  return {
    period: point.period,
    actual: point.actual,
    forecast: Math.round(forecast),
    error: Math.round(error),
    absoluteError: Math.round(absoluteError),
    squaredError: Math.round(error ** 2),
    percentageError: round(percentageError),
    absolutePercentageError: round(Math.abs(percentageError))
  };
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number) {
  return Number(value.toFixed(2));
}
