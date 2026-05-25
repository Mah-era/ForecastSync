export type UploadedDataType =
  | "Historical Sales Data"
  | "Inventory Data"
  | "Customer Demand Data"
  | "Promotion & Discount Data"
  | "Competitor Data"
  | "Economic Data"
  | "Market Trend Data"
  | "Seasonality / Festival Data"
  | "Lead Time Data"
  | "POS / ERP Data"
  | "Expert Opinion / Manual Notes";

export type InputFactor =
  | "Historical Sales Data"
  | "Market Trends"
  | "Seasonality"
  | "Customer Demand Patterns"
  | "Promotions & Discounts"
  | "Economic Conditions"
  | "Competitor Activities"
  | "Inventory Levels"
  | "Lead Time"
  | "Forecasting Methods"
  | "Future 12-Month Forecast"
  | "Technology & Data Tools"
  | "Forecast Accuracy"
  | "Uploaded File Data"
  | "Manual Expert Opinion";

export type OutputSection =
  | "Demand Forecast"
  | "Sales Trend Analysis"
  | "Seasonal Demand Impact"
  | "Festival Demand Impact"
  | "Customer Demand Pattern"
  | "Promotion Impact Analysis"
  | "Competitor Activity Analysis"
  | "Economic Condition Impact"
  | "Inventory Requirement"
  | "Stockout Risk"
  | "Lead Time Analysis"
  | "Forecast Accuracy Report"
  | "Final SCM Recommendation"
  | "Risk Alerts"
  | "Action Plan"
  | "PDF Report"
  | "Excel Report"
  | "CSV Export";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ProductSelection {
  productName: string;
  category: string;
  brand: string;
  region: string;
}

export interface SearchRequest extends ProductSelection {
  sourceCount?: number;
}

export interface UploadedDataset {
  id: string;
  name: string;
  type: UploadedDataType;
  rows: Record<string, unknown>[];
  columns: string[];
  qualityScore: number;
  issues: string[];
  cleaningSummary?: {
    blankRowsRemoved: number;
    duplicateRowsRemoved: number;
    textTrimmed: number;
    numericValuesConverted: number;
    dateValuesNormalized: number;
    negativeDemandRowsFlagged: number;
  };
}

export interface SearchSource {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResult {
  query: string;
  provider: "tavily" | "serpapi" | "bing" | "google-cse" | "unavailable";
  summary: string;
  sources: SearchSource[];
  trendSignals: {
    marketTrendIndex: number;
    competitorPressure: number;
    economicRisk: number;
    seasonalLift: number;
    promotionPressure: number;
  };
}

export interface ForecastPoint {
  period: string;
  actual: number;
  movingAverage: number;
  weightedMovingAverage: number;
  trendForecast: number;
  adjustedForecast: number;
  error: number;
  absoluteError: number;
  absolutePercentageError: number;
  isFuture?: boolean;
}

export interface ForecastMethodMetrics {
  simpleAverage: number;
  exponentialSmoothing: number;
  mad: number;
  mse: number;
  rmse: number;
  mpe: number;
  bias: number;
}

export interface ForecastSummary {
  points: ForecastPoint[];
  futurePoints: ForecastPoint[];
  nextPeriodForecast: number;
  confidenceScore: number;
  mape: number;
  accuracy: number;
  safetyStock: number;
  reorderPoint: number;
  recommendedStock: number;
  methodMetrics: ForecastMethodMetrics;
}

export interface SkillResult {
  id: string;
  title: string;
  riskLevel: RiskLevel;
  recommendation: string;
  insights: string[];
  chartData: object[];
  tableData?: object[];
  kpis?: { label: string; value: string; tone?: RiskLevel }[];
  description?: string;
  calculationRules?: string[];
}

export interface AnalysisRequest {
  selection: ProductSelection;
  inputFactors: InputFactor[];
  outputSections: OutputSection[];
  uploadedDatasets: UploadedDataset[];
  expertNotes?: string;
}

export interface AnalysisResult {
  selection: ProductSelection;
  inputFactors: InputFactor[];
  outputSections: OutputSection[];
  webSearch: WebSearchResult;
  forecast: ForecastSummary;
  skills: SkillResult[];
  alerts: { level: RiskLevel; message: string }[];
  finalRecommendation: string;
  actionPlan: string[];
  generatedAt: string;
}
