export interface CleaningSummary {
  blankRowsRemoved: number;
  duplicateRowsRemoved: number;
  textTrimmed: number;
  numericValuesConverted: number;
  dateValuesNormalized: number;
  negativeDemandRowsFlagged: number;
  outlierRowsFlagged: number;
}

const demandColumns = new Set(["actual", "actualunits", "unitssold", "demand", "quantity", "sales", "forecastdemandunits"]);

export function cleanImportedRows(rows: Record<string, unknown>[]) {
  const summary: CleaningSummary = {
    blankRowsRemoved: 0,
    duplicateRowsRemoved: 0,
    textTrimmed: 0,
    numericValuesConverted: 0,
    dateValuesNormalized: 0,
    negativeDemandRowsFlagged: 0,
    outlierRowsFlagged: 0
  };
  const seen = new Set<string>();
  const cleanedRows: Record<string, unknown>[] = [];

  for (const row of rows) {
    const cleaned: Record<string, unknown> = {};
    let hasValue = false;
    let negativeDemand = false;

    for (const [key, value] of Object.entries(row)) {
      const cleanedValue = cleanValue(key, value, summary);
      cleaned[key] = cleanedValue;
      if (cleanedValue !== "" && cleanedValue !== null && cleanedValue !== undefined) hasValue = true;
      if (isDemandColumn(key) && typeof cleanedValue === "number" && cleanedValue < 0) negativeDemand = true;
    }

    if (!hasValue) {
      summary.blankRowsRemoved += 1;
      continue;
    }

    if (negativeDemand) {
      cleaned.CleaningFlag = "Negative demand/return value detected";
      summary.negativeDemandRowsFlagged += 1;
    }

    const signature = JSON.stringify(cleaned);
    if (seen.has(signature)) {
      summary.duplicateRowsRemoved += 1;
      continue;
    }
    seen.add(signature);
    cleanedRows.push(cleaned);
  }

  flagDemandOutliers(cleanedRows, summary);
  return { rows: cleanedRows, summary };
}

function cleanValue(key: string, value: unknown, summary: CleaningSummary) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed !== value) summary.textTrimmed += 1;
    if (trimmed === "") return "";

    if (isDateColumn(key)) {
      const serial = parseTextNumber(trimmed);
      if (serial !== null && serial > 30000 && serial < 60000) {
        summary.dateValuesNormalized += 1;
        return excelSerialToDate(serial);
      }
      const parsed = Date.parse(trimmed);
      if (Number.isFinite(parsed)) {
        summary.dateValuesNormalized += 1;
        return new Date(parsed).toISOString().slice(0, 10);
      }
    }

    const numeric = parseTextNumber(trimmed);
    if (numeric !== null) {
      summary.numericValuesConverted += 1;
      return numeric;
    }

    return trimmed;
  }

  if (typeof value === "number" && isDateColumn(key) && value > 30000 && value < 60000) {
    summary.dateValuesNormalized += 1;
    return excelSerialToDate(value);
  }

  return value;
}

function parseTextNumber(value: string) {
  const normalized = value
    .replace(/[৳$£€,\s]/g, "")
    .replace(/(bdt|tk|taka|usd|eur|gbp|aud|units?|pcs)$/i, "")
    .replace(/%$/, "")
    .replace(/^\((.+)\)$/, "-$1");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDateColumn(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("date") || normalized === "month" || normalized.includes("updated");
}

function isDemandColumn(key: string) {
  return demandColumns.has(key.toLowerCase().replace(/[^a-z0-9]/g, ""));
}

function flagDemandOutliers(rows: Record<string, unknown>[], summary: CleaningSummary) {
  const demandValues = rows
    .map((row) => demandValue(row))
    .filter((value): value is number => typeof value === "number" && value > 0);
  if (demandValues.length < 4) return;

  const mean = demandValues.reduce((sum, value) => sum + value, 0) / demandValues.length;
  const variance = demandValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / demandValues.length;
  const standardDeviation = Math.sqrt(variance);
  if (!standardDeviation) return;

  rows.forEach((row) => {
    const value = demandValue(row);
    if (typeof value !== "number" || value <= 0) return;
    if ((value - mean) / standardDeviation < 3) return;
    row.CleaningFlag = [row.CleaningFlag, "Outlier demand spike detected"].filter(Boolean).join("; ");
    summary.outlierRowsFlagged += 1;
  });
}

function demandValue(row: Record<string, unknown>) {
  const key = Object.keys(row).find(isDemandColumn);
  const value = key ? Number(row[key]) : 0;
  return Number.isFinite(value) ? value : 0;
}

function excelSerialToDate(value: number) {
  return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
}
