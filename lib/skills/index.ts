import { extractDemandSeries } from "@/lib/forecasting/models";
import type { AnalysisSkill } from "./types";
import type { RiskLevel, UploadedDataset } from "@/types/scm";

const riskFromScore = (score: number): RiskLevel => (score > 78 ? "critical" : score > 62 ? "high" : score > 40 ? "medium" : "low");
const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  dhaka: { lat: 23.8103, lng: 90.4125 },
  chattogram: { lat: 22.3569, lng: 91.7832 },
  sylhet: { lat: 24.8949, lng: 91.8687 },
  rajshahi: { lat: 24.3745, lng: 88.6042 },
  khulna: { lat: 22.8456, lng: 89.5403 },
  barishal: { lat: 22.701, lng: 90.3535 },
  rangpur: { lat: 25.7439, lng: 89.2752 },
  mymensingh: { lat: 24.7471, lng: 90.4203 }
};

export const historicalSalesSkill: AnalysisSkill = ({ forecast }) => ({
  id: "historical-sales",
  title: "Historical Sales Data",
  riskLevel: forecast.accuracy < 75 ? "high" : forecast.accuracy < 85 ? "medium" : "low",
  recommendation: "Use recent trend and weighted moving average as the primary demand baseline.",
  insights: [
    forecast.points.length ? "Historical sales are calculated from demand-bearing rows in the current uploaded file." : "No demand-bearing historical rows were found in the current file.",
    "Festival and promotion columns are included when they exist in the uploaded sales rows."
  ],
  chartData: forecast.points,
  tableData: forecast.points,
  kpis: [{ label: "Sales growth", value: `${salesGrowth(forecast.points)}%`, tone: forecast.accuracy < 75 ? "high" : "medium" }],
  description: "Historical sales converts imported monthly demand into trend, moving average, and forecast baseline views.",
  calculationRules: ["Forecast Error = Actual Demand - Forecasted Demand.", "Moving average uses the previous three periods when available.", "Weighted moving average favors the newest period with a 50/30/20 split."]
});

export const marketTrendSkill: AnalysisSkill = ({ request, webSearch, forecast }) => {
  const trendRows = rowsByType(request.uploadedDatasets, ["Market Trend Data"]);
  const chartRows = trendRows.length
    ? trendRows.map((row, index) => ({
        period: String(valueFor(row, ["Period", "Month", "Date", "Week"]) ?? `T${index + 1}`),
        trendIndex: numberFor(row, ["TrendIndex", "Trend Score", "DemandScore", "Score", "Index"], 0),
        source: String(valueFor(row, ["Source", "Title", "Channel"]) ?? "Imported file")
      }))
    : forecast.points.map((point) => ({ period: point.period, trendIndex: point.adjustedForecast, demand: point.actual }));
  return {
    id: "market-trends",
    title: "Market Trends",
    riskLevel: riskFromScore(webSearch.trendSignals.marketTrendIndex),
    recommendation: "Use current file trend rows and latest demand movement to refresh the forecast after each upload.",
    insights: [trendRows.length ? "Market trend rows are generated from the current uploaded file." : "No market trend sheet was found; trend view is derived from current imported demand movement.", "File analysis does not call live search."],
    chartData: chartRows,
    tableData: trendRows.length ? trendRows : chartRows,
    description: "Market trend analysis uses uploaded trend rows when available, otherwise current file demand movement.",
    calculationRules: ["Trend index rows are read from the current workbook when present.", "If trend rows are absent, imported demand movement is used.", "File analysis never silently calls Tavily."]
  };
};

export const seasonalitySkill: AnalysisSkill = ({ request, webSearch }) => {
  const seasonalRows = rowsByType(request.uploadedDatasets, ["Seasonality / Festival Data"]);
  const demandSeries = extractDemandSeries(request.uploadedDatasets);
  const chartRows = seasonalRows.length
    ? seasonalRows.map((row, index) => ({
        month: String(valueFor(row, ["Month", "Period", "Festival", "Season"]) ?? `S${index + 1}`),
        demand: numberFor(row, ["Demand", "ForecastDemandUnits", "ActualUnits", "UnitsSold"], 0),
        festivalLift: numberFor(row, ["FestivalLiftPct", "Seasonality", "SeasonalLift", "Lift"], 0)
      }))
    : demandSeries.map((row) => ({ month: row.period, demand: row.actual, festivalLift: row.festival }));
  return {
    id: "seasonality",
    title: "Seasonality",
    riskLevel: riskFromScore(webSearch.trendSignals.seasonalLift),
    recommendation: "Raise pre-season stock cover before Ramadan, Eid, winter, summer, and local festival periods found in the file.",
    insights: [seasonalRows.length ? "Seasonality rows are read from the uploaded workbook." : "Seasonality is derived from festival/seasonality columns in the current sales data.", "Monthly planning should include festival adjustment factors."],
    chartData: chartRows,
    tableData: seasonalRows.length ? seasonalRows : chartRows,
    description: "Seasonality highlights monthly demand lift from the current file's festival and seasonality values.",
    calculationRules: ["Festival lift is used as a percentage multiplier.", "Rows come from the current upload only.", "Planning recommendation raises stock before file-detected peak months."]
  };
};

export const customerDemandSkill: AnalysisSkill = ({ request }) => {
  const regionalData = extractRegionalDemand(request.uploadedDatasets);
  const data = regionalData;
  const topRegion = data.reduce((top, item) => (Number(item.demand) > Number(top.demand) ? item : top), data[0] ?? { region: "No region", demand: 0 });
  return {
    id: "customer-demand",
    title: "Customer Demand Patterns",
    riskLevel: data.some((item) => item.risk === "high") ? "high" : "medium",
    recommendation: `Prioritize ${topRegion.region} replenishment while monitoring regional variability across Bangladesh markets.`,
    insights: [
      regionalData.length ? "Regional demand map is generated from the current uploaded file." : "No regional map data was found in the current file.",
      "Regional variability requires separate inventory buffers."
    ],
    chartData: data,
    tableData: data,
    description: "Customer demand patterns compare demand by Bangladesh region and segment readiness.",
    calculationRules: ["Regional demand is aggregated by city/region rows.", "Higher regional share means higher replenishment priority.", "Dhaka and Chattogram are treated as primary demand centers when present."]
  };
};

export const promotionImpactSkill: AnalysisSkill = ({ request, webSearch }) => {
  const promotionRows = rowsByType(request.uploadedDatasets, ["Promotion & Discount Data"]);
  const demandSeries = extractDemandSeries(request.uploadedDatasets);
  const chartRows = promotionRows.length
    ? promotionRows.map((row, index) => ({
        period: String(valueFor(row, ["Period", "Month", "Campaign", "Date"]) ?? `P${index + 1}`),
        promotion: numberFor(row, ["Promotion", "DiscountPct", "Discount", "PromotionIntensity"], 0),
        demand: numberFor(row, ["Demand", "ActualUnits", "UnitsSold", "ForecastDemandUnits"], 0)
      }))
    : demandSeries.map((row) => ({ period: row.period, promotion: row.promotion, demand: row.actual }));
  return {
    id: "promotion-impact",
    title: "Promotions & Discounts",
    riskLevel: riskFromScore(webSearch.trendSignals.promotionPressure),
    recommendation: "Use promotions selectively when uplift is visible in the uploaded file; avoid discounting into low-stock weeks.",
    insights: [promotionRows.length ? "Promotion rows are read from the uploaded workbook." : "Promotion view is derived from promotion/discount columns in current sales data.", "Discount planning should be linked to reorder timing."],
    chartData: chartRows,
    tableData: promotionRows.length ? promotionRows : chartRows,
    description: "Promotion impact compares current file discount intensity with demand response and stockout exposure.",
    calculationRules: ["Promotion adjustment adds half of discount/festival pressure to demand projection.", "Rows come from the current upload only.", "Discount planning is linked to reorder timing."]
  };
};

export const economicConditionSkill: AnalysisSkill = ({ request, webSearch }) => {
  const rows = rowsByType(request.uploadedDatasets, ["Economic Data"]);
  const demandSeries = extractDemandSeries(request.uploadedDatasets);
  const chartRows = rows.length
    ? rows.map((row, index) => ({
        indicator: String(valueFor(row, ["Indicator", "Metric", "Period", "Month"]) ?? `E${index + 1}`),
        inflation: numberFor(row, ["Inflation", "InflationRate", "CPI"], 0),
        demand: numberFor(row, ["Demand", "ForecastDemandUnits", "ActualUnits", "UnitsSold"], 0),
        risk: numberFor(row, ["Risk", "EconomicRisk", "Score"], webSearch.trendSignals.economicRisk)
      }))
    : demandSeries.map((row) => ({
        indicator: row.period,
        inflation: 0,
        demand: row.actual,
        risk: webSearch.trendSignals.economicRisk,
        note: "No economic sheet in current file; demand row retained for file-linked view."
      }));
  return {
    id: "economic-conditions",
    title: "Economic Conditions",
    riskLevel: riskFromScore(webSearch.trendSignals.economicRisk),
    recommendation: "Maintain value-pack availability and monitor inflation-driven price sensitivity found in the current file.",
    insights: [rows.length ? "Economic rows are read from the uploaded workbook." : "No economic data rows were found in the current file.", "Purchasing power changes should be used as a forecast adjustment."],
    chartData: chartRows,
    tableData: rows.length ? rows : chartRows,
    description: "Economic conditions connect uploaded inflation and purchasing power rows with demand risk.",
    calculationRules: ["Economic rows come from the current upload only.", "Higher economic risk reduces adjusted forecast.", "Value-pack recommendation is triggered under price sensitivity."]
  };
};

export const competitorActivitySkill: AnalysisSkill = ({ request, webSearch }) => {
  const rows = rowsByType(request.uploadedDatasets, ["Competitor Data"]);
  const brandRows = groupDemandByBrand(request.uploadedDatasets);
  const demandSeries = extractDemandSeries(request.uploadedDatasets);
  const chartRows = rows.length
    ? rows.map((row, index) => ({
        competitor: String(valueFor(row, ["Competitor", "CompetitorName", "Brand", "Company"]) ?? `Competitor ${index + 1}`),
        price: numberFor(row, ["Price", "CompetitorPrice", "CompetitorPriceBDT", "AvgPrice"], 0),
        promotionIntensity: numberFor(row, ["PromotionIntensity", "Promotion", "DiscountPct", "Discount"], flagScore(row, ["PromoActive", "PromotionActive"], 65)),
        launchScore: numberFor(row, ["LaunchScore", "Launch", "NewProduct"], flagScore(row, ["LaunchEvent", "NewProductLaunch"], 80))
      }))
    : brandRows.length
      ? brandRows.map((row) => ({
          competitor: row.brand,
          price: 0,
          promotionIntensity: row.demandShare,
          launchScore: webSearch.trendSignals.competitorPressure,
          demand: row.demand
        }))
      : demandSeries.slice(-6).map((row) => ({
          competitor: row.period,
          price: 0,
          promotionIntensity: webSearch.trendSignals.competitorPressure,
          launchScore: 0,
          demand: row.actual
        }));
  return {
    id: "competitor-activities",
    title: "Competitor Activities",
    riskLevel: riskFromScore(webSearch.trendSignals.competitorPressure),
    recommendation: "Monitor competitor pricing and launches from the uploaded file before finalizing inventory and discount plans.",
    insights: [rows.length ? "Competitor rows are read from the uploaded workbook." : "No competitor sheet was found; this view uses current-file brand demand mix where available.", "Competitor promotions can suppress baseline demand."],
    chartData: chartRows,
    tableData: rows.length ? rows : chartRows,
    description: "Competitor activity tracks uploaded pricing, launches, promotions, and market pressure.",
    calculationRules: ["Competitor rows come from the current upload only.", "Higher pressure reduces adjusted forecast.", "Pricing watch is recommended before promotion approval."]
  };
};

export const inventoryPlanningSkill: AnalysisSkill = ({ request, forecast }) => {
  const rows = rowsByType(request.uploadedDatasets, ["Inventory Data"]);
  const currentStock = sumPositive(rows, ["CurrentStock", "Stock", "OnHand", "Inventory", "AvailableStock"]);
  const gap = currentStock === null ? 0 : forecast.recommendedStock - currentStock;
  const chartData = [
    ...(currentStock !== null ? [{ metric: "Current Stock", value: Math.round(currentStock) }] : []),
    { metric: "Safety Stock", value: forecast.safetyStock },
    { metric: "Reorder Point", value: forecast.reorderPoint },
    { metric: "Recommended Stock", value: forecast.recommendedStock },
    ...(currentStock !== null ? [{ metric: "Stock Gap", value: Math.max(0, Math.round(gap)) }] : [])
  ];
  const riskLevel: RiskLevel = currentStock !== null && currentStock < forecast.reorderPoint ? "high" : forecast.recommendedStock > 12500 ? "medium" : "low";
  return {
    id: "inventory-levels",
    title: "Inventory Levels",
    riskLevel,
    recommendation:
      currentStock !== null
        ? `Current file stock is ${Math.round(currentStock)} units. Keep ${forecast.safetyStock} units of safety stock and target ${forecast.recommendedStock} units.`
        : `Keep at least ${forecast.safetyStock} units of safety stock and set reorder point near ${forecast.reorderPoint} units.`,
    insights: [
      rows.length ? "Inventory rows are read from the uploaded workbook." : "No inventory sheet was found; stock targets are calculated from current-file demand variability.",
      "Current stock is compared with lead-time demand, not only next-month demand."
    ],
    chartData,
    tableData: rows.length ? rows : chartData,
    kpis: [
      { label: "Current stock", value: currentStock === null ? "No file data" : `${Math.round(currentStock)} units`, tone: riskLevel },
      { label: "Reorder point", value: `${forecast.reorderPoint} units`, tone: riskLevel }
    ],
    description: "Inventory planning turns current-file stock, demand variability, and lead time into stock targets.",
    calculationRules: ["Safety Stock = service level factor x demand variability x square root of lead time.", "Reorder Point = average demand during lead time + safety stock.", "Recommended stock = next forecast + safety stock."]
  };
};

export const leadTimeSkill: AnalysisSkill = ({ request }) => {
  const rows = rowsByType(request.uploadedDatasets, ["Lead Time Data"]);
  const chartRows = rows.length
    ? rows.map((row, index) => ({
        stage: String(valueFor(row, ["Stage", "LeadTimeStage", "Process", "Supplier"]) ?? `Stage ${index + 1}`),
        days: numberFor(row, ["Days", "LeadTimeDays", "AverageLeadTime", "TotalLeadTimeDays", "PurchaseLeadDays", "ProductionLeadDays", "ShippingLeadDays", "DeliveryLeadDays", "DelayDays"], 0)
      }))
    : [{ stage: "No lead-time rows in current file", days: 0, note: "Upload lead-time data to calculate supplier timing." }];
  return {
    id: "lead-time",
    title: "Lead Time",
    riskLevel: chartRows.some((row) => row.days > 21) ? "high" : rows.length ? "medium" : "low",
    recommendation: "Place purchase orders before the demand peak using lead-time stages from the current file.",
    insights: [rows.length ? "Lead-time rows are read from the uploaded workbook." : "No lead-time data rows were found in the current file.", "Inbound, warehouse, and last-mile timelines should be monitored separately."],
    chartData: chartRows,
    tableData: rows.length ? rows : chartRows,
    description: "Lead time breaks the uploaded supply path into purchase, production, transport, and receiving stages.",
    calculationRules: ["Lead-time rows come from the current upload only.", "Delay risk increases with longer inbound timelines.", "Purchase orders are pulled forward before demand peaks."]
  };
};

export const forecastingMethodSkill: AnalysisSkill = ({ forecast }) => ({
  id: "forecasting-methods",
  title: "Forecasting Methods",
  riskLevel: "low",
  recommendation: "Blend weighted moving average with trend, seasonal, promotion, competitor, economic, inventory, and lead-time adjustments.",
  insights: ["AI/ML forecasting is prepared as a connector-ready placeholder.", "Accuracy and confidence are recalculated after each analysis run."],
  chartData: [...forecast.points, ...forecast.futurePoints],
  tableData: forecast.points.map((point) => ({
    period: point.period,
    movingAverage: point.movingAverage,
    weightedMovingAverage: point.weightedMovingAverage,
    trendForecast: point.trendForecast,
    adjustedForecast: point.adjustedForecast
  })).concat([
    { period: "Simple Average", movingAverage: forecast.methodMetrics.simpleAverage, weightedMovingAverage: 0, trendForecast: 0, adjustedForecast: 0 },
    { period: "Exponential Smoothing", movingAverage: forecast.methodMetrics.exponentialSmoothing, weightedMovingAverage: 0, trendForecast: 0, adjustedForecast: 0 },
    { period: "MAD", movingAverage: forecast.methodMetrics.mad, weightedMovingAverage: 0, trendForecast: 0, adjustedForecast: 0 },
    { period: "MSE", movingAverage: forecast.methodMetrics.mse, weightedMovingAverage: 0, trendForecast: 0, adjustedForecast: 0 },
    { period: "RMSE", movingAverage: forecast.methodMetrics.rmse, weightedMovingAverage: 0, trendForecast: 0, adjustedForecast: 0 },
    { period: "MPE", movingAverage: forecast.methodMetrics.mpe, weightedMovingAverage: 0, trendForecast: 0, adjustedForecast: 0 },
    { period: "Bias", movingAverage: forecast.methodMetrics.bias, weightedMovingAverage: 0, trendForecast: 0, adjustedForecast: 0 }
  ]),
  description: "Forecasting methods compare moving average, weighted moving average, trend, and adjusted forecast outputs.",
  calculationRules: ["Trend forecast adds 45% of recent month-to-month change.", "Adjusted forecast applies seasonal, promotion, competitor, and economic multipliers.", "Future 12-month forecast extends the latest trend with light seasonal patterns."]
});

export const technologyDataSkill: AnalysisSkill = ({ request }) => ({
  id: "technology-data",
  title: "Technology & Data Tools",
  riskLevel: request.uploadedDatasets.some((dataset) => dataset.qualityScore < 70) ? "high" : "low",
  recommendation: "Connect ERP, POS, supplier, inventory, and live web search feeds through the MCP connector layer as data maturity improves.",
  insights: ["Uploaded files are validated and scored.", "MCP-ready connector interfaces are included for future integrations."],
  chartData: request.uploadedDatasets.map((dataset) => ({ source: dataset.name, score: dataset.qualityScore, rows: dataset.rows.length })),
  tableData: request.uploadedDatasets.map((dataset) => ({
    file: dataset.name,
    type: dataset.type,
    rows: dataset.rows.length,
    qualityScore: dataset.qualityScore,
    issues: dataset.issues.join("; ") || "None"
  })),
  description: "Technology and data tools measure source coverage, file health, cleaning status, and connector readiness.",
  calculationRules: ["Quality score penalizes blank cells and visible data issues.", "Cleaning removes blank rows, duplicate rows, and converts numeric/date text.", "MCP connector placeholders remain separate from imported file analysis."]
});

export const forecastAccuracySkill: AnalysisSkill = ({ forecast }) => ({
  id: "forecast-accuracy",
  title: "Forecast Accuracy",
  riskLevel: forecast.accuracy < 75 ? "high" : forecast.accuracy < 85 ? "medium" : "low",
  recommendation: `Forecast accuracy is ${forecast.accuracy}%; keep MAPE under 15% for operational planning.`,
  insights: ["Forecast Error = Actual Demand - Forecasted Demand.", "MAPE is averaged from absolute percentage errors."],
  chartData: forecast.points,
  kpis: [
    { label: "MAPE", value: `${forecast.mape}%`, tone: forecast.mape > 20 ? "high" : "medium" },
    { label: "Accuracy", value: `${forecast.accuracy}%`, tone: forecast.accuracy > 85 ? "low" : "medium" }
  ],
  description: "Forecast accuracy compares forecast values against actual imported demand.",
  calculationRules: ["Forecast Error = Actual Demand - Forecasted Demand.", "Absolute Error = absolute value of Forecast Error.", "MAPE is the average absolute percentage error; Accuracy = 100% - MAPE."]
});

export const finalRecommendationSkill: AnalysisSkill = ({ request, forecast, webSearch }) => ({
  id: "final-recommendation",
  title: "Final SCM Recommendation",
  riskLevel: riskFromScore((webSearch.trendSignals.competitorPressure + webSearch.trendSignals.economicRisk) / 2),
  recommendation: `Based on selected inputs for ${request.selection.productName || "the product"}, demand is expected to reach ${forecast.nextPeriodForecast} units next period. Increase stock to ${forecast.recommendedStock} units, place purchase orders earlier than the lead-time average, maintain ${forecast.safetyStock} units of safety stock, and monitor competitor pricing before launching discounts.`,
  insights: ["Recommendation combines forecast, seasonality, competitor pressure, inventory requirements, and economic risk.", "Action priority is highest when seasonal lift and low inventory overlap."],
  chartData: [
    { priority: "Replenish", score: 92 },
    { priority: "Monitor competitors", score: webSearch.trendSignals.competitorPressure },
    { priority: "Adjust promotions", score: webSearch.trendSignals.promotionPressure },
    { priority: "Watch inflation", score: webSearch.trendSignals.economicRisk },
    { priority: "Seasonal stock build", score: webSearch.trendSignals.seasonalLift }
  ],
  description: "Final SCM recommendation combines demand, inventory, lead time, seasonality, competitor, and economic signals into actions.",
  calculationRules: ["Action priority rises when stock risk and demand lift overlap.", "Recommended stock uses forecast plus safety stock.", "Reorder timing uses lead-time coverage before demand peaks."]
});

export const skills = [
  historicalSalesSkill,
  marketTrendSkill,
  seasonalitySkill,
  customerDemandSkill,
  promotionImpactSkill,
  economicConditionSkill,
  competitorActivitySkill,
  inventoryPlanningSkill,
  leadTimeSkill,
  forecastingMethodSkill,
  technologyDataSkill,
  forecastAccuracySkill,
  finalRecommendationSkill
];

function rowsByType(datasets: UploadedDataset[], types: UploadedDataset["type"][]) {
  return datasets.filter((dataset) => types.includes(dataset.type)).flatMap((dataset) => dataset.rows);
}

function salesGrowth(points: { actual: number }[]) {
  if (points.length < 2) return 0;
  const first = points[0].actual;
  const last = points[points.length - 1].actual;
  return first ? Number((((last - first) / first) * 100).toFixed(1)) : 0;
}

function groupDemandByBrand(datasets: UploadedDataset[]) {
  const rows = datasets.flatMap((dataset) => dataset.rows);
  const grouped = new Map<string, number>();
  rows.forEach((row) => {
    const brand = String(valueFor(row, ["Brand", "ProductBrand", "Manufacturer", "Company"]) ?? "").trim();
    const demand = numberFor(row, ["ActualUnits", "UnitsSold", "Demand", "ForecastDemandUnits", "Quantity", "Sales"], 0);
    if (!brand || demand <= 0) return;
    grouped.set(brand, (grouped.get(brand) ?? 0) + demand);
  });
  const total = Array.from(grouped.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(grouped.entries()).map(([brand, demand]) => ({
    brand,
    demand: Math.round(demand),
    demandShare: total ? Math.round((demand / total) * 100) : 0
  }));
}

function sumPositive(rows: Record<string, unknown>[], keys: string[]) {
  let total = 0;
  for (const row of rows) {
    const value = numberFor(row, keys, 0);
    if (value > 0) total += value;
  }
  return total > 0 ? total : null;
}

function flagScore(row: Record<string, unknown>, keys: string[], score: number) {
  const value = String(valueFor(row, keys) ?? "").toLowerCase();
  return ["yes", "true", "active", "launch", "launched", "1"].some((term) => value.includes(term)) ? score : 0;
}

function extractRegionalDemand(datasets: UploadedDataset[]) {
  let regionalRows = datasets
    .filter((dataset) => dataset.type === "Customer Demand Data")
    .flatMap((dataset) => dataset.rows)
    .filter((row) => valueFor(row, ["Region", "region", "City", "city"]));

  if (!regionalRows.length) {
    regionalRows = datasets
      .flatMap((dataset) => dataset.rows)
      .filter((row) => valueFor(row, ["Region", "region", "City", "city"]) && numberFor(row, ["ForecastDemandUnits", "Demand", "ActualUnits", "UnitsSold", "Quantity", "Sales"], 0) > 0);
  }

  const grouped = new Map<string, { region: string; lat: number; lng: number; demand: number; growth: number; risk: RiskLevel }>();
  regionalRows.forEach((row) => {
    const region = String(valueFor(row, ["Region", "region", "City", "city"]) ?? "").trim();
    if (!region) return;
    const key = region.toLowerCase();
    const known = cityCoordinates[key];
    const lat = numberFor(row, ["Latitude", "latitude", "lat"], known?.lat ?? 23.685);
    const lng = numberFor(row, ["Longitude", "longitude", "lng", "lon"], known?.lng ?? 90.3563);
    const demand = numberFor(row, ["ForecastDemandUnits", "Demand", "demand", "DemandScore", "AvgBasketUnits"], 0);
    const growth = numberFor(row, ["Growth", "growth", "GrowthPct", "DemandScore"], 0);
    const level = String(valueFor(row, ["DemandLevel", "Risk", "risk"]) ?? "").toLowerCase();
    const risk: RiskLevel = level.includes("high") || demand > 3500 ? "high" : level.includes("medium") || demand > 2200 ? "medium" : "low";
    const existing = grouped.get(key);
    if (existing) {
      existing.demand += demand;
      existing.growth = Math.max(existing.growth, growth);
      existing.risk = existing.risk === "high" || risk === "high" ? "high" : existing.risk === "medium" || risk === "medium" ? "medium" : "low";
    } else {
      grouped.set(key, { region, lat, lng, demand, growth, risk });
    }
  });
  const groupedRows = Array.from(grouped.values()).filter((item) => item.demand > 0);
  if (groupedRows.length) return groupedRows;

  const demandSeries = extractDemandSeries(datasets);
  const totalDemand = demandSeries.reduce((sum, row) => sum + row.actual, 0);
  return totalDemand > 0
    ? [{ region: "Current file total", lat: 23.685, lng: 90.3563, demand: Math.round(totalDemand), growth: salesGrowth(demandSeries), risk: "medium" as const }]
    : [];
}

function valueFor(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const match = Object.keys(row).find((rowKey) => normalizeKey(rowKey) === normalizeKey(key));
    if (match) return row[match];
  }
  return undefined;
}

function numberFor(row: Record<string, unknown>, keys: string[], fallback: number) {
  const value = Number(valueFor(row, keys));
  return Number.isFinite(value) ? value : fallback;
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}
