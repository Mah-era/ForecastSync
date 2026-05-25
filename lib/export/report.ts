import type { AnalysisResult } from "@/types/scm";

export function toCsv(rows: Record<string, unknown>[]) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [columns.join(","), ...rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n");
}

export function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportAnalysisExcel(result: AnalysisResult) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.forecast.points), "Forecast");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.skills.flatMap((skill) => skill.tableData ?? skill.chartData)), "Module Data");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(result.alerts), "Alerts");
  XLSX.writeFile(workbook, `${result.selection.productName || "demand"}-forecast-report.xlsx`);
}
