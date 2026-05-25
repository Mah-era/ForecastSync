import { buildForecast } from "@/lib/forecasting/models";
import { skills } from "@/lib/skills";
import type { AnalysisRequest, AnalysisResult, InputFactor, OutputSection, UploadedDataset } from "@/types/scm";

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
  const webSearch = {
    query: "Online search is handled by the separate Search By Choice pathway.",
    provider: "unavailable" as const,
    summary: "File analysis uses uploaded data only.",
    sources: [],
    trendSignals: { marketTrendIndex: 50, competitorPressure: 35, economicRisk: 35, seasonalLift: 10, promotionPressure: 30 }
  };
  const forecast = buildForecast(datasets, webSearch);
  const skillResults = skills.map((skill) => skill({ request: normalizedRequest, webSearch, forecast }));
  const visibleSkills = skillResults.filter((skill) => shouldShowSkill(skill.title, request.inputFactors, request.outputSections));
  const alerts = [
    forecast.accuracy < 80 ? { level: "high" as const, message: `Forecast accuracy is ${forecast.accuracy}%; review source quality and recent demand shifts.` } : null,
    webSearch.trendSignals.competitorPressure > 60 ? { level: "high" as const, message: "Competitor pressure is elevated; monitor pricing and launches before promotions." } : null,
    webSearch.trendSignals.seasonalLift > 18 ? { level: "medium" as const, message: "Festival and seasonal demand lift detected; increase pre-season stock cover." } : null,
    forecast.recommendedStock > 12000 ? { level: "medium" as const, message: "Recommended stock is above normal cover; check warehouse capacity and cash flow." } : null
  ].filter(Boolean) as AnalysisResult["alerts"];

  const finalRecommendation = `Based on historical sales, seasonality, competitor activity, current inventory, lead time, and economic pressure, demand for ${request.selection.productName || "the selected product"} is expected to reach ${forecast.nextPeriodForecast} units next period. Recommended action: increase available stock to ${forecast.recommendedStock} units, place purchase orders 18 to 22 days earlier, maintain safety stock of ${forecast.safetyStock} units, and monitor competitor pricing before launching discounts.`;

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
      `Replenish to ${forecast.recommendedStock} units before the next demand peak.`,
      `Set reorder point at ${forecast.reorderPoint} units.`,
      "Review Ramadan, Eid, winter, summer, and local festival calendar before locking monthly forecast.",
      "Track competitor price and promotion changes weekly.",
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
