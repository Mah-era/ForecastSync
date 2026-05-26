import Papa from "papaparse";
import * as XLSX from "xlsx";
import { cleanImportedRows } from "@/lib/file-import/cleaning";
import type { UploadedDataset, UploadedDataType } from "@/types/scm";

export const uploadTypes: UploadedDataType[] = [
  "Historical Sales Data",
  "Inventory Data",
  "Customer Demand Data",
  "Promotion & Discount Data",
  "Competitor Data",
  "Economic Data",
  "Market Trend Data",
  "Seasonality / Festival Data",
  "Lead Time Data",
  "POS / ERP Data",
  "Expert Opinion / Manual Notes"
];

export async function parseUpload(file: File, type: UploadedDataType): Promise<UploadedDataset> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  let rows: Record<string, unknown>[] = [];

  if (extension === "csv") {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
    rows = parsed.data;
  } else if (extension === "json") {
    const json = JSON.parse(await file.text());
    rows = Array.isArray(json) ? json : json.rows ?? [];
  } else if (["xlsx", "xls"].includes(extension ?? "")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const firstSheet = workbook.SheetNames[0];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet]);
  } else {
    throw new Error("Unsupported file type. Upload CSV, Excel, or JSON.");
  }

  const cleaned = cleanImportedRows(rows);
  rows = cleaned.rows.map((row) => ({ SourceSheet: file.name, ...row }));
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const missingCells = rows.reduce(
    (sum, row) => sum + columns.filter((column) => row[column] === null || row[column] === undefined || row[column] === "").length,
    0
  );
  const totalCells = Math.max(1, rows.length * Math.max(1, columns.length));
  const qualityScore = Math.max(0, Math.round(100 - (missingCells / totalCells) * 100));
  const issues = [
    rows.length === 0 ? "No rows detected." : "",
    columns.length === 0 ? "No columns detected." : "",
    missingCells > 0 ? `${missingCells} blank cells detected.` : "",
    cleaned.summary.blankRowsRemoved ? `${cleaned.summary.blankRowsRemoved} blank rows removed.` : "",
    cleaned.summary.duplicateRowsRemoved ? `${cleaned.summary.duplicateRowsRemoved} duplicate rows removed.` : "",
    cleaned.summary.numericValuesConverted ? `${cleaned.summary.numericValuesConverted} numeric text values converted.` : "",
    cleaned.summary.dateValuesNormalized ? `${cleaned.summary.dateValuesNormalized} date values normalized.` : "",
    cleaned.summary.negativeDemandRowsFlagged ? `${cleaned.summary.negativeDemandRowsFlagged} negative demand/return rows flagged.` : "",
    cleaned.summary.outlierRowsFlagged ? `${cleaned.summary.outlierRowsFlagged} outlier demand spikes flagged.` : ""
  ].filter(Boolean);

  return {
    id: crypto.randomUUID(),
    name: file.name,
    type,
    rows,
    columns,
    qualityScore,
    issues,
    cleaningSummary: cleaned.summary
  };
}
