import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { cleanImportedRows } from "@/lib/file-import/cleaning";
import { parseUpload } from "@/lib/file-import/parsers";
import type { UploadedDataset, UploadedDataType } from "@/types/scm";

const sheetTypeMap: Record<string, UploadedDataType> = {
  Historical_Sales: "Historical Sales Data",
  Inventory: "Inventory Data",
  Promotions: "Promotion & Discount Data",
  Competitors: "Competitor Data",
  Economic: "Economic Data",
  Lead_Time: "Lead Time Data",
  Forecast_Actual: "Historical Sales Data",
  Regional_Demand_Map: "Customer Demand Data",
  Customer_Patterns: "Customer Demand Data",
  Technology_Data: "POS / ERP Data",
  Web_Search_Seeds: "Market Trend Data",
  Manual_Expert_Opinion: "Expert Opinion / Manual Notes"
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const type = (formData.get("type")?.toString() || "Historical Sales Data") as UploadedDataType;
  const files = formData.getAll("files").filter((item): item is File => item instanceof File);

  if (!files.length) {
    return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
  }

  const datasets = [];
  for (const file of files) {
    if (isExcel(file.name)) {
      datasets.push(...(await parseExcelWorkbook(file)));
    } else {
      datasets.push(await parseUpload(file, type));
    }
  }

  return NextResponse.json({ datasets });
}

function isExcel(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension === "xlsx" || extension === "xls";
}

async function parseExcelWorkbook(file: File): Promise<UploadedDataset[]> {
  const workbook = XLSX.read(await file.arrayBuffer());
  const sheets = workbook.SheetNames;

  return sheets.map((sheet) => {
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheet], { defval: "" });
    const cleaned = cleanImportedRows(rawRows);
    const rows = cleaned.rows;
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const blankCells = rows.reduce(
      (sum, row) => sum + columns.filter((column) => row[column] === null || row[column] === undefined || row[column] === "").length,
      0
    );
    const totalCells = Math.max(1, rows.length * Math.max(1, columns.length));
    const issues = [
      blankCells ? `${blankCells} blank cells detected.` : "",
      cleaned.summary.blankRowsRemoved ? `${cleaned.summary.blankRowsRemoved} blank rows removed.` : "",
      cleaned.summary.duplicateRowsRemoved ? `${cleaned.summary.duplicateRowsRemoved} duplicate rows removed.` : "",
      cleaned.summary.numericValuesConverted ? `${cleaned.summary.numericValuesConverted} numeric text values converted.` : "",
      cleaned.summary.dateValuesNormalized ? `${cleaned.summary.dateValuesNormalized} date values normalized.` : "",
      cleaned.summary.negativeDemandRowsFlagged ? `${cleaned.summary.negativeDemandRowsFlagged} negative demand/return rows flagged.` : ""
    ].filter(Boolean);
    return {
      id: crypto.randomUUID(),
      name: `${file.name} / ${sheet}`,
      type: sheetTypeMap[sheet] ?? "Historical Sales Data",
      rows,
      columns,
      qualityScore: Math.max(0, Math.round(100 - (blankCells / totalCells) * 100)),
      issues,
      cleaningSummary: cleaned.summary
    };
  });
}
