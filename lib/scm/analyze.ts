import { buildForecast, extractDemandSeries } from "@/lib/forecasting/models";
import { skills } from "@/lib/skills";
import type { AnalysisRequest, AnalysisResult, InputFactor, OutputSection, UploadedDataset, WebSearchResult } from "@/types/scm";

const skillInputFactors: Record<string, InputFactor[]> = {
  "Historical Sales Data": ["Historical Sales Data", "Uploaded File Data"],
  "Market Trends": ["Market Trends"],
  "Seasonality": ["Seasonality"],
  "Customer Demand Patterns": ["Customer Demand Patterns"],
  "Promotions & Discounts": ["Promotions & Discounts"],
  "Economic Conditions": ["Economic Conditions"],
  "Competitor Activities": ["Competitor Activities"],
  "Inventory Levels": ["Inventory Levels"],
  "Lead Time": ["Lead Time"],
  "Forecasting Methods": ["Forecasting Methods", "Future 12-Month Forecast"],
  "Technology & Data Tools": ["Technology & Data Tools", "Uploaded File Data"],
  "Forecast Accuracy": ["Forecast Accuracy"],
  "Final SCM Recommendation": ["Manual Expert Opinion", "Forecasting Methods", "Inventory Levels", "Lead Time"]
};

const skillOutputSections: Record<string, OutputSection[]> = {
  "Historical Sales Data": ["Demand Forecast", "Sales Trend Analysis"],
  "Market Trends": ["Sales Trend Analysis"],
  "Seasonality": ["Seasonal Demand Impact", "Festival Demand Impact"],
  "Customer Demand Patterns": ["Customer Demand Pattern"],
  "Promotions & Discounts": ["Promotion Impact Analysis"],
  "Economic Conditions": ["Economic Condition Impact"],
  "Competitor Activities": ["Competitor Activity Analysis"],
  "Inventory Levels": ["Inventory Requirement", "Stockout Risk"],
  "Lead Time": ["Lead Time Analysis"],
  "Forecasting Methods": ["Demand Forecast"],
  "Technology & Data Tools": ["Forecast Accuracy Report"],
  "Forecast Accuracy": ["Forecast Accuracy Report"],
  "Final SCM Recommendation": ["Final SCM Recommendation", "Action Plan", "Risk Alerts"]
};

export async function runDemandAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
  const datasets: UploadedDataset[] = request.uploadedDatasets;
  const normalizedRequest = { ...request, uploadedDatasets: datasets };
  const fileSignals = buildFileTrendSignals(datasets);
  const webSearch: WebSearchResult = {
    query: "Online search is handled by the separate Search By Choice pathway.",
    provider: "unavailable" as const,
    summary: "File analysis uses uploaded data only. These signal scores are recalculated from the current imported workbook.",
    sources: [],
    trendSignals: fileSignals
  };
  const forecast = buildForecast(datasets, webSearch);
  const skillResults = skills.map((skill) => skill({ request: normalizedRequest, webSearch, forecast }));
  const visibleSkills = skillResults.filter((skill) => shouldShowSkill(skill.title, request.inputFactors, request.outputSections));
  const inventoryStatus = getInventoryStatus(datasets, forecast.reorderPoint, forecast.recommendedStock);
  const leadTime = getAverageLeadTime(datasets);
  const alerts = [
    forecast.accuracy < 80 ? { level: "high" as const, message: `Forecast accuracy is ${forecast.accuracy}%; review source quality and recent demand shifts.` } : null,
    webSearch.trendSignals.competitorPressure > 60 ? { level: "high" as const, message: "Competitor pressure is elevated; monitor pricing and launches before promotions." } : null,
    webSearch.trendSignals.seasonalLift > 18 ? { level: "medium" as const, message: "Festival and seasonal demand lift detected; increase pre-season stock cover." } : null,
    inventoryStatus.currentStock !== null && inventoryStatus.currentStock < forecast.reorderPoint
      ? { level: "high" as const, message: `Current stock (${Math.round(inventoryStatus.currentStock)} units) is below reorder point (${forecast.reorderPoint} units).` }
      : null,
    forecast.recommendedStock > 12000 ? { level: "medium" as const, message: "Recommended stock is above normal cover; check warehouse capacity and cash flow." } : null,
    leadTime && leadTime > 21 ? { level: "medium" as const, message: `Average lead time is ${Math.round(leadTime)} days; purchase orders should be pulled forward.` } : null
  ].filter(Boolean) as AnalysisResult["alerts"];

  const leadTimeText = leadTime ? `${Math.round(leadTime)} days earlier than the expected lead-time window` : "before the next demand peak";
  const inventoryText =
    inventoryStatus.currentStock !== null
      ? `current stock is ${Math.round(inventoryStatus.currentStock)} units against a recommended stock target of ${forecast.recommendedStock} units`
      : `recommended stock target is ${forecast.recommendedStock} units`;
  const finalRecommendation = `Based on the current uploaded file, demand for ${request.selection.productName || "the selected product"} is expected to reach ${forecast.nextPeriodForecast} units next period. Since ${inventoryText}, place purchase orders ${leadTimeText}, maintain safety stock of ${forecast.safetyStock} units, and monitor file-detected competitor, economic, seasonal, and promotion pressure before launching discounts.`;

  return {
    selection: request.selection,
    inputFactors: request.inputFactors,
    outputSections: request.outputSections,
    webSearch,
    forecast,
    skills: visibleSkills,
    alerts,
    finalRecommendation,
    actionPlan: [
      inventoryStatus.currentStock !== null
        ? `Replenish from ${Math.round(inventoryStatus.currentStock)} units to ${forecast.recommendedStock} units before the next demand peak.`
        : `Replenish to ${forecast.recommendedStock} units before the next demand peak.`,
      `Set reorder point at ${forecast.reorderPoint} units.`,
      webSearch.trendSignals.seasonalLift > 0
        ? `Review seasonal/festival lift from the file (${webSearch.trendSignals.seasonalLift}/100 signal) before locking monthly forecast.`
        : "Add seasonality or festival rows if the product has Ramadan, Eid, winter, summer, or local festival demand peaks.",
      webSearch.trendSignals.competitorPressure > 0
        ? `Track competitor pressure from the file (${webSearch.trendSignals.competitorPressure}/100 signal) before approving discounts.`
        : "Add competitor price, promotion, or launch rows to quantify competitor pressure.",
      "Refresh forecast after every major upload."
    ],
    generatedAt: new Date().toISOString()
  };
}

function shouldShowSkill(title: string, inputs: InputFactor[], outputs: OutputSection[]) {
  const requiredInputs = skillInputFactors[title] ?? [];
  const relatedOutputs = skillOutputSections[title] ?? [];
  const inputSelected = requiredInputs.length === 0 || requiredInputs.some((input) => inputs.includes(input));
  const outputSelected = outputs.length === 0 || relatedOutputs.some((output) => outputs.includes(output));
  return inputSelected && outputSelected;
}

function buildFileTrendSignals(datasets: UploadedDataset[]): WebSearchResult["trendSignals"] {
  const series = extractDemandSeries(datasets);
  const firstWindow = average(series.slice(0, 3).map((point) => point.actual));
  const lastWindow = average(series.slice(-3).map((point) => point.actual));
  const growthPct = firstWindow ? ((lastWindow - firstWindow) / firstWindow) * 100 : 0;
  const marketTrendIndex = clamp(Math.round(50 + growthPct), 0, 100);

  const promotionRows = rowsByTypes(datasets, ["Promotion & Discount Data"]);
  const promotionValues = [
    ...series.map((point) => point.promotion),
    ...promotionRows.map((row) => numberFor(row, ["Promotion", "PromotionIntensity", "DiscountPct", "Discount", "Uplift", "PromotionUplift"], 0))
  ].filter((value) => value > 0);

  const seasonalRows = rowsByTypes(datasets, ["Seasonality / Festival Data"]);
  const seasonalValues = [
    ...series.map((point) => point.festival),
    ...seasonalRows.map((row) => numberFor(row, ["FestivalLiftPct", "SeasonalLift", "Seasonality", "Lift", "SeasonalIndex"], 0))
  ].filter((value) => value > 0);

  const competitorRows = rowsByTypes(datasets, ["Competitor Data"]);
  const competitorValues = competitorRows.flatMap((row) => [
    numberFor(row, ["PromotionIntensity", "Promotion", "DiscountPct", "Discount"], 0),
    numberFor(row, ["LaunchScore", "Launch", "NewProduct"], 0),
    numberFor(row, ["Pressure", "CompetitorPressure", "Risk", "Score"], 0),
    flagScore(row, ["PromoActive", "PromotionActive"], 65),
    flagScore(row, ["LaunchEvent", "NewProductLaunch"], 80)
  ]).filter((value) => value > 0);

  const economicRows = rowsByTypes(datasets, ["Economic Data"]);
  const economicValues = economicRows.flatMap((row) => [
    numberFor(row, ["Risk", "EconomicRisk", "Score"], 0),
    numberFor(row, ["Inflation", "InflationRate", "CPI"], 0) * 4,
    numberFor(row, ["PriceSensitivity", "PurchasingPowerPressure"], 0)
  ]).filter((value) => value > 0);

  return {
    marketTrendIndex,
    competitorPressure: clamp(Math.round(average(competitorValues)), 0, 100),
    economicRisk: clamp(Math.round(average(economicValues)), 0, 100),
    seasonalLift: clamp(Math.round(average(seasonalValues)), 0, 100),
    promotionPressure: clamp(Math.round(average(promotionValues)), 0, 100)
  };
}

function getInventoryStatus(datasets: UploadedDataset[], reorderPoint: number, recommendedStock: number) {
  const values = rowsByTypes(datasets, ["Inventory Data"]).flatMap((row) => [
    numberOrNull(row, ["CurrentStock", "Stock", "OnHand", "Inventory", "AvailableStock"]),
    numberOrNull(row, ["RequiredStock", "TargetStock", "RecommendedStock"])
  ]);
  const stockValues = values.filter((value): value is number => value !== null && value >= 0);
  const currentStock = stockValues.length ? stockValues.reduce((sum, value) => sum + value, 0) : null;
  return { currentStock, reorderPoint, recommendedStock };
}

function getAverageLeadTime(datasets: UploadedDataset[]) {
  const values = rowsByTypes(datasets, ["Lead Time Data"])
    .map((row) => numberFor(row, ["Days", "LeadTimeDays", "AverageLeadTime", "TotalLeadTimeDays", "PurchaseLeadDays", "ProductionLeadDays", "ShippingLeadDays", "DeliveryLeadDays", "DelayDays"], 0))
    .filter((value) => value > 0);
  return values.length ? average(values) : 0;
}

function rowsByTypes(datasets: UploadedDataset[], types: UploadedDataset["type"][]) {
  return datasets.filter((dataset) => types.includes(dataset.type)).flatMap((dataset) => dataset.rows);
}

function valueFor(row: Record<string, unknown>, keys: string[]) {
  const normalizedKeys = keys.map(normalizeKey);
  const match = Object.keys(row).find((key) => normalizedKeys.includes(normalizeKey(key)));
  return match ? row[match] : undefined;
}

function numberFor(row: Record<string, unknown>, keys: string[], fallback: number) {
  const value = Number(valueFor(row, keys));
  return Number.isFinite(value) ? value : fallback;
}

function numberOrNull(row: Record<string, unknown>, keys: string[]) {
  const value = Number(valueFor(row, keys));
  return Number.isFinite(value) ? value : null;
}

function flagScore(row: Record<string, unknown>, keys: string[], score: number) {
  const value = String(valueFor(row, keys) ?? "").toLowerCase();
  return ["yes", "true", "active", "launch", "launched", "1"].some((term) => value.includes(term)) ? score : 0;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}
