import type { AnalysisRequest, ForecastSummary, SkillResult, WebSearchResult } from "@/types/scm";

export interface SkillContext {
  request: AnalysisRequest;
  webSearch: WebSearchResult;
  forecast: ForecastSummary;
}

export type AnalysisSkill = (context: SkillContext) => SkillResult;
