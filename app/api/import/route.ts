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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const type = (formData.get("type")?.toString() || "Historical Sales Data") as UploadedDataType;
    const files = formData.getAll("files").filter(isFileLike);

    if (!files.length) {
      return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
    }

    const datasets = [];
    for (const file of files) {
      if (isExcel(file.name)) {
        datasets.push(...(await parseExcelWorkbook(file, type)));
      } else {
        datasets.push(await parseUpload(file, type));
      }
    }

    return NextResponse.json({ datasets });
  } catch (error) {
    console.error("Import API failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "File import failed on the server." },
      { status: 500 }
    );
  }
}

function isFileLike(item: FormDataEntryValue): item is File {
  return typeof item === "object" && item !== null && "arrayBuffer" in item && "name" in item;
}

function isExcel(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension === "xlsx" || extension === "xls";
}

async function parseExcelWorkbook(file: File, fallbackType: UploadedDataType): Promise<UploadedDataset[]> {
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
      type: inferSheetType(sheet, fallbackType),
      rows,
      columns,
      qualityScore: Math.max(0, Math.round(100 - (blankCells / totalCells) * 100)),
      issues,
      cleaningSummary: cleaned.summary
    };
  });
}

function inferSheetType(sheet: string, fallbackType: UploadedDataType): UploadedDataType {
  if (sheetTypeMap[sheet]) return sheetTypeMap[sheet];

  const normalized = sheet.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (normalized.includes("historical") || normalized.includes("sales") || normalized.includes("actual") || normalized.includes("forecast")) {
    return "Historical Sales Data";
  }
  if (normalized.includes("inventory") || normalized.includes("stock")) return "Inventory Data";
  if (normalized.includes("promo") || normalized.includes("discount") || normalized.includes("campaign")) return "Promotion & Discount Data";
  if (normalized.includes("competitor") || normalized.includes("pricing")) return "Competitor Data";
  if (normalized.includes("economic") || normalized.includes("inflation") || normalized.includes("income")) return "Economic Data";
  if (normalized.includes("lead") || normalized.includes("supplier") || normalized.includes("delay")) return "Lead Time Data";
  if (normalized.includes("regional") || normalized.includes("customer") || normalized.includes("demand") || normalized.includes("location")) {
    return "Customer Demand Data";
  }
  if (normalized.includes("trend") || normalized.includes("search") || normalized.includes("market")) return "Market Trend Data";
  if (normalized.includes("pos") || normalized.includes("erp") || normalized.includes("technology")) return "POS / ERP Data";
  if (normalized.includes("season") || normalized.includes("festival") || normalized.includes("eid") || normalized.includes("ramadan")) {
    return "Seasonality / Festival Data";
  }
  if (normalized.includes("expert") || normalized.includes("manual") || normalized.includes("note") || normalized.includes("scenario")) {
    return "Expert Opinion / Manual Notes";
  }

  return fallbackType === "Historical Sales Data" ? "Expert Opinion / Manual Notes" : fallbackType;
}
