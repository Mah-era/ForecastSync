import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { runDemandAnalysis } from "../lib/scm/analyze";
import type { AnalysisRequest, UploadedDataType, UploadedDataset } from "../types/scm";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length && !process.env[key]) {
      process.env[key] = valueParts.join("=");
    }
  }
}

const fixtureRoot = path.join("Test_Files", "EXCEL", "Demand Planning Forecasting Tests");
const files = existsSync(fixtureRoot)
  ? readdirSync(fixtureRoot)
      .filter((file) => file.endsWith(".xlsx"))
      .map((file) => path.join(fixtureRoot, file))
      .sort()
  : [];

if (!files.length) {
  throw new Error("No Excel test files found under Test_Files/EXCEL/Demand Planning Forecasting Tests.");
}

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

function workbookToDatasets(filePath: string): { datasets: UploadedDataset[]; selection: AnalysisRequest["selection"]; notes: string } {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const scenarioRows = XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(workbook.Sheets.Scenario_Info ?? {}, { defval: "" });
  const scenario = Object.fromEntries(scenarioRows.map((row) => [row.Field, row.Value]));
  const datasets = workbook.SheetNames.filter((sheet) => sheetTypeMap[sheet]).map((sheet) => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheet], { defval: "" });
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const blankCells = rows.reduce(
      (sum, row) => sum + columns.filter((column) => row[column] === null || row[column] === undefined || row[column] === "").length,
      0
    );
    const totalCells = Math.max(1, rows.length * Math.max(1, columns.length));
    return {
      id: `${path.basename(filePath)}-${sheet}`,
      name: `${path.basename(filePath)} / ${sheet}`,
      type: sheetTypeMap[sheet],
      rows,
      columns,
      qualityScore: Math.max(0, Math.round(100 - (blankCells / totalCells) * 100)),
      issues: blankCells ? [`${blankCells} blank cells detected.`] : []
    };
  });

  return {
    datasets,
    selection: {
      productName: String(scenario.Product ?? firstValue(datasets, "ProductName") ?? "Unknown Product"),
      category: String(scenario.Category ?? firstValue(datasets, "Category") ?? "Unknown Category"),
      brand: String(scenario.Brand ?? firstValue(datasets, "Brand") ?? "Unknown Brand"),
      region: "Bangladesh"
    },
    notes: String(scenario.Quality ?? "")
  };
}

function firstValue(datasets: UploadedDataset[], column: string) {
  for (const dataset of datasets) {
    const value = dataset.rows.find((row) => row[column])?.[column];
    if (value) return value;
  }
  return "";
}

async function main() {
  const summaries = [];
  for (const file of files) {
    const fixture = workbookToDatasets(file);
    const request: AnalysisRequest = {
      selection: fixture.selection,
      inputFactors: [
        "Historical Sales Data",
        "Market Trends",
        "Seasonality",
        "Customer Demand Patterns",
        "Promotions & Discounts",
        "Economic Conditions",
        "Competitor Activities",
        "Inventory Levels",
        "Lead Time",
        "Forecasting Methods",
        "Technology & Data Tools",
      "Forecast Accuracy",
      "Uploaded File Data",
        "Manual Expert Opinion"
      ],
      outputSections: [
        "Demand Forecast",
        "Sales Trend Analysis",
        "Seasonal Demand Impact",
        "Festival Demand Impact",
        "Customer Demand Pattern",
        "Promotion Impact Analysis",
        "Competitor Activity Analysis",
        "Economic Condition Impact",
        "Inventory Requirement",
        "Stockout Risk",
        "Lead Time Analysis",
        "Forecast Accuracy Report",
        "Final SCM Recommendation",
        "Risk Alerts",
        "Action Plan"
      ],
      uploadedDatasets: fixture.datasets,
      expertNotes: fixture.notes
    };
    const result = await runDemandAnalysis(request);
    summaries.push({
      file: path.basename(file),
      product: result.selection.productName,
      forecast: result.forecast.nextPeriodForecast,
      accuracy: result.forecast.accuracy,
      datasets: fixture.datasets.length,
      skills: result.skills.length,
      webProvider: result.webSearch.provider,
      alerts: result.alerts.length
    });
  }

  const failed = summaries.filter((summary) => summary.webProvider !== "unavailable" || summary.forecast <= 0 || summary.skills < 10 || summary.accuracy < 0 || summary.accuracy > 100);
  console.log(JSON.stringify({ total: summaries.length, failed: failed.length, summaries }, null, 2));
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
