import type { AnalysisResult } from "@/types/scm";

export const ANALYSIS_HISTORY_VERSION = 1;
export const ANALYSIS_HISTORY_KEY = "forecastsync.analysis-history.v1";
export const MAX_SAVED_ANALYSES = 8;

export interface AnalysisSnapshot {
  id: string;
  version: typeof ANALYSIS_HISTORY_VERSION;
  createdAt: string;
  label: string;
  result: AnalysisResult;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function createAnalysisSnapshot(result: AnalysisResult): AnalysisSnapshot {
  const parts = [result.selection.productName, result.selection.brand, result.selection.region].filter(Boolean);
  return {
    id: `${result.generatedAt}-${Math.random().toString(36).slice(2, 8)}`,
    version: ANALYSIS_HISTORY_VERSION,
    createdAt: result.generatedAt,
    label: parts.join(" · ") || "Workbook analysis",
    result
  };
}

export function parseAnalysisHistory(raw: string | null): AnalysisSnapshot[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isAnalysisSnapshot).slice(0, MAX_SAVED_ANALYSES);
  } catch {
    return [];
  }
}

export function loadAnalysisHistory(storage: StorageLike): AnalysisSnapshot[] {
  return parseAnalysisHistory(storage.getItem(ANALYSIS_HISTORY_KEY));
}

export function saveAnalysisSnapshot(storage: StorageLike, result: AnalysisResult): AnalysisSnapshot[] {
  const snapshot = createAnalysisSnapshot(result);
  const history = [snapshot, ...loadAnalysisHistory(storage)].slice(0, MAX_SAVED_ANALYSES);
  try {
    storage.setItem(ANALYSIS_HISTORY_KEY, JSON.stringify(history));
    return history;
  } catch {
    return loadAnalysisHistory(storage);
  }
}

function isAnalysisSnapshot(value: unknown): value is AnalysisSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<AnalysisSnapshot>;
  return snapshot.version === ANALYSIS_HISTORY_VERSION && typeof snapshot.id === "string" && typeof snapshot.createdAt === "string" && typeof snapshot.label === "string" && Boolean(snapshot.result?.forecast);
}
