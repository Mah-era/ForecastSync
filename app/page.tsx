"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Activity, AlertTriangle, BarChart3, Boxes, CheckCircle2, Download, FileSpreadsheet, Filter, Globe2, GripVertical, Info, LineChart, Loader2, PackageSearch, Search, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/dashboard/DataTable";
import { downloadBlob, exportAnalysisExcel, toCsv } from "@/lib/export/report";
import { formatNumber, riskClass } from "@/lib/utils";
import type { AnalysisRequest, AnalysisResult, InputFactor, OutputSection, ProductSelection, SkillResult, UploadedDataset, WebSearchResult } from "@/types/scm";

const ForecastChart = dynamic(() => import("@/components/charts/ScmCharts").then((module) => module.ForecastChart), {
  ssr: false,
  loading: () => <ChartSkeleton />
});
const SkillChart = dynamic(() => import("@/components/charts/ScmCharts").then((module) => module.SkillChart), {
  ssr: false,
  loading: () => <ChartSkeleton />
});
const BangladeshDemandMap = dynamic(() => import("@/components/maps/BangladeshDemandMap").then((module) => module.BangladeshDemandMap), {
  ssr: false,
  loading: () => <ChartSkeleton />
});
const SupplyChainFlowMap = dynamic(() => import("@/components/maps/BangladeshDemandMap").then((module) => module.SupplyChainFlowMap), {
  ssr: false,
  loading: () => <ChartSkeleton />
});

const inputFactors: InputFactor[] = [
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
  "Future 12-Month Forecast",
  "Technology & Data Tools",
  "Forecast Accuracy",
  "Uploaded File Data",
  "Manual Expert Opinion"
];

const outputSections: OutputSection[] = [
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
  "Action Plan",
  "PDF Report",
  "Excel Report",
  "CSV Export"
];

type ModuleFilterState = { text: string; metric: string; option: string; product: string; category: string; brand: string; region: string; channel: string; source: string };
type DashboardCardSize = "1:1" | "16:4" | "2:1" | "1:2";
const defaultModuleFilter: ModuleFilterState = { text: "", metric: "All metrics", option: "All records", product: "All products", category: "All categories", brand: "All brands", region: "All regions", channel: "All channels", source: "All sources" };

async function readApiJson<T>(response: Response): Promise<T & { error?: string }> {
  const text = await response.text();
  if (!text) return {} as T & { error?: string };

  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return { error: text } as T & { error?: string };
  }
}

export default function Home() {
  const [pathway, setPathway] = useState<"import" | "search" | null>(null);
  const [activeSection, setActiveSection] = useState("Dashboard");
  const [datasets, setDatasets] = useState<UploadedDataset[]>([]);
  const [selection, setSelection] = useState<ProductSelection>({ productName: "", category: "", brand: "", region: "" });
  const [selectedInputs, setSelectedInputs] = useState<InputFactor[]>(inputFactors);
  const [selectedOutputs, setSelectedOutputs] = useState<OutputSection[]>(outputSections);
  const [expertNotes, setExpertNotes] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [marketSearch, setMarketSearch] = useState<WebSearchResult | null>(null);
  const [searchDashboard, setSearchDashboard] = useState(false);
  const [brandFilter, setBrandFilter] = useState("All brands");
  const [moduleFilters, setModuleFilters] = useState<Record<string, ModuleFilterState>>({});
  const [sourceCount, setSourceCount] = useState(10);
  const [dashboardOrder, setDashboardOrder] = useState<string[]>([]);
  const [dashboardSizes, setDashboardSizes] = useState<Record<string, DashboardCardSize>>({});
  const [dashboardChartsReady, setDashboardChartsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [applyingFilters, setApplyingFilters] = useState(false);
  const [renderingMessage, setRenderingMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const waitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const applyPath = () => {
      const section = sectionFromPath(window.location.pathname);
      if (!section) {
        setPathway(null);
        setSearchDashboard(false);
        return;
      }
      if (section === "Search By Choice") {
        setPathway("search");
        setSearchDashboard(false);
        return;
      }
      if (section === "Search Dashboard") {
        setPathway("search");
        setSearchDashboard(true);
        return;
      }
      setPathway("import");
      setActiveSection(section);
    };

    applyPath();
    window.addEventListener("popstate", applyPath);
    return () => window.removeEventListener("popstate", applyPath);
  }, []);

  const currentSkill = useMemo(() => result?.skills.find((skill) => skill.title === activeSection), [activeSection, result]);
  const brandOptions = useMemo(() => extractBrandOptions(datasets), [datasets]);
  const filteredDatasets = useMemo(() => filterDatasetsByBrand(datasets, brandFilter), [brandFilter, datasets]);
  const importedSummary = useMemo(() => summarizeDatasets(filteredDatasets), [filteredDatasets]);
  const currentModuleFilter = currentSkill ? moduleFilters[currentSkill.id] ?? defaultModuleFilter : defaultModuleFilter;
  const currentSkillRows = useMemo(() => {
    const rows = (currentSkill?.tableData ?? currentSkill?.chartData ?? []) as Record<string, unknown>[];
    return filterModuleRows(rows, currentModuleFilter);
  }, [currentModuleFilter, currentSkill]);
  const currentSkillChartRows = useMemo(() => {
    const rows = (currentSkill?.chartData ?? []) as Record<string, unknown>[];
    return filterModuleRows(rows, currentModuleFilter);
  }, [currentModuleFilter, currentSkill]);
  const currentSkillChart = useMemo(() => {
    return currentSkill ? { ...currentSkill, chartData: currentSkillChartRows, tableData: currentSkillRows } : null;
  }, [currentSkill, currentSkillChartRows, currentSkillRows]);
  const visibleNavItems = useMemo(() => {
    if (!result) return ["Import Data"];
    return ["Dashboard", "Import Data", ...result.skills.map((skill) => skill.title)];
  }, [result]);
  const dashboardSkills = useMemo(() => {
    if (!result) return [];
    return [...result.skills].sort((a, b) => {
      const aIndex = dashboardOrder.indexOf(a.id);
      const bIndex = dashboardOrder.indexOf(b.id);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });
  }, [dashboardOrder, result]);

  useEffect(() => {
    if (!result || activeSection !== "Dashboard") {
      setDashboardChartsReady(false);
      return;
    }

    setDashboardChartsReady(false);
    showWaitMessage("Rendering dashboard charts from imported data...", 1400);
    const chartTimer = window.setTimeout(() => setDashboardChartsReady(true), 180);
    return () => {
      window.clearTimeout(chartTimer);
    };
  }, [activeSection, result]);

  function afterClick() {
    return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  function withWaitScreen(message: string, action: () => void, duration = 450) {
    window.setTimeout(() => {
      showWaitMessage(message, duration);
      requestAnimationFrame(() => {
        action();
      });
    }, 0);
  }

  function showWaitMessage(message: string, duration: number) {
    if (waitTimerRef.current) window.clearTimeout(waitTimerRef.current);
    setRenderingMessage(message);
    waitTimerRef.current = window.setTimeout(() => {
      setRenderingMessage("");
      waitTimerRef.current = null;
    }, duration);
  }

  function navigateHome() {
    withWaitScreen("Returning to start...", () => {
      window.history.pushState({}, "", "/");
      setPathway(null);
      setSearchDashboard(false);
    });
  }

  function navigateTo(section: string, nextPathway: "import" | "search" = "import") {
    withWaitScreen(`Opening ${section}...`, () => {
      window.history.pushState({}, "", pathForSection(section));
      setPathway(nextPathway);
      setActiveSection(section);
      if (section !== "Search Dashboard") setSearchDashboard(false);
    });
  }

  function applyModuleFilter(skillId: string, filter: ModuleFilterState) {
    window.setTimeout(() => {
      setApplyingFilters(true);
      showWaitMessage("Applying module filter to current analysis data...", 650);
      requestAnimationFrame(() => {
        startTransition(() => {
          setModuleFilters((current) => ({ ...current, [skillId]: filter }));
        });
        window.setTimeout(() => setApplyingFilters(false), 320);
      });
    }, 0);
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setError("");
    setImporting(true);
    setDatasets([]);
    setResult(null);
    setMarketSearch(null);
    setSearchDashboard(false);
    setBrandFilter("All brands");
    setModuleFilters({});
    setDashboardOrder([]);
    setDashboardSizes({});
    setDashboardChartsReady(false);
    setExpertNotes("");
    setImportStatus(`Processing ${files.length} file${files.length === 1 ? "" : "s"}...`);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));
      formData.append("type", "Historical Sales Data");
      const response = await fetch("/api/import", { method: "POST", body: formData });
      const payload = await readApiJson<{ datasets: UploadedDataset[] }>(response);
      if (!response.ok) throw new Error(payload.error || `Could not import file. Server returned ${response.status}.`);
      if (!Array.isArray(payload.datasets) || !payload.datasets.length) {
        throw new Error("The file imported, but no usable worksheets or rows were found.");
      }
      setDatasets(payload.datasets);
      setSelection(extractSelectionFromDatasets(payload.datasets));
      setImportStatus(`Done. Imported ${payload.datasets.length} file${payload.datasets.length === 1 ? "" : "s"}.`);
      setActiveSection("Import Data");
      window.history.pushState({}, "", pathForSection("Import Data"));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not parse file.");
      setImportStatus("");
    } finally {
      setImporting(false);
    }
  }

  async function analyze() {
    setError("");
    await afterClick();
    setLoading(true);
    try {
      const request: AnalysisRequest = {
        selection,
        inputFactors: selectedInputs,
        outputSections: selectedOutputs,
        uploadedDatasets: filteredDatasets,
        expertNotes
      };
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      const nextResult = await readApiJson<AnalysisResult>(response);
      if (!response.ok) throw new Error(nextResult.error || `Analysis request failed. Server returned ${response.status}.`);
      setResult(nextResult);
      setDashboardOrder(nextResult.skills.map((skill) => skill.id));
      setActiveSection("Dashboard");
      window.history.pushState({}, "", pathForSection("Dashboard"));
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function searchMarket() {
    setError("");
    await afterClick();
    setSearching(true);
    try {
      const response = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...selection, sourceCount }) });
      if (!response.ok) throw new Error("Market search request failed.");
      setMarketSearch(await response.json());
      setSearchDashboard(false);
      window.history.pushState({}, "", pathForSection("Search By Choice"));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Market search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function exportPdf() {
    await afterClick();
    setExporting(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const [html2canvasModule, jsPdfModule] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const element = document.getElementById("pdf-report-root") ?? document.getElementById("report-root");
      if (!element) return;
      const canvas = await html2canvasModule.default(element, { scale: 1.2, useCORS: true, windowWidth: 1200 });
      const pdf = new jsPdfModule.default("p", "mm", "a4");
      const width = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const height = (canvas.height * width) / canvas.width;
      const image = canvas.toDataURL("image/png");
      let remainingHeight = height;
      let position = 0;
      pdf.addImage(image, "PNG", 0, position, width, height);
      remainingHeight -= pageHeight;
      while (remainingHeight > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(image, "PNG", 0, position, width, height);
        remainingHeight -= pageHeight;
      }
      pdf.save(`${selection.productName || "demand"}-scm-report.pdf`);
    } finally {
      setExporting(false);
    }
  }

  async function exportExcel() {
    if (!result) return;
    await afterClick();
    setExporting(true);
    try {
      await exportAnalysisExcel(result);
    } finally {
      setExporting(false);
    }
  }

  function exportCsv() {
    if (!result) return;
    window.setTimeout(() => {
      setExporting(true);
      downloadBlob(toCsv(result.forecast.points as unknown as Record<string, unknown>[]), "forecast-data.csv", "text/csv");
      window.setTimeout(() => setExporting(false), 350);
    }, 0);
  }

  function clearImportData() {
    setDatasets([]);
    setResult(null);
    setImportStatus("");
    setBrandFilter("All brands");
    setSelection({ productName: "", category: "", brand: "", region: "" });
    setExpertNotes("");
    setActiveSection("Import Data");
    setDashboardOrder([]);
    setDashboardSizes({});
    window.history.pushState({}, "", pathForSection("Import Data"));
  }

  function moveDashboardCard(sourceId: string, targetId: string) {
    setRenderingMessage("Reordering dashboard card...");
    window.setTimeout(() => {
      setDashboardOrder((current) => {
        const order = current.length ? [...current] : result?.skills.map((skill) => skill.id) ?? [];
        const sourceIndex = order.indexOf(sourceId);
        const targetIndex = order.indexOf(targetId);
        if (sourceIndex === -1 || targetIndex === -1) return order;
        const [item] = order.splice(sourceIndex, 1);
        order.splice(targetIndex, 0, item);
        return order;
      });
      window.setTimeout(() => setRenderingMessage(""), 250);
    }, 0);
  }

  function clearSearchData() {
    setMarketSearch(null);
    setSearchDashboard(false);
    setSelection({ productName: "", category: "", brand: "", region: "" });
    setExpertNotes("");
    window.history.pushState({}, "", pathForSection("Search By Choice"));
  }

  const kpis = result
    ? [
        { label: "Next Forecast", value: result.forecast.points.length ? formatNumber(result.forecast.nextPeriodForecast) : "Relevant data not found", icon: LineChart, rule: "Uses current-file demand rows and adjusted forecast multipliers." },
        { label: "Accuracy", value: result.forecast.points.length ? `${result.forecast.accuracy}%` : "Relevant data not found", icon: CheckCircle2, rule: "Forecast Accuracy = 100% - MAPE from current-file actual and forecast rows." },
        { label: "Safety Stock", value: result.forecast.points.length ? formatNumber(result.forecast.safetyStock) : "Relevant data not found", icon: Boxes, rule: "Safety stock uses demand variability and lead-time assumption from current analysis." },
        { label: "Stockout Risk", value: stockoutRiskLabel(result), icon: AlertTriangle },
        { label: "Avg Lead Time", value: averageLeadTimeLabel(result), icon: Activity },
        { label: "Competitor Pressure", value: competitorPressureLabel(result), icon: BarChart3, rule: "Calculated only from competitor rows in the current upload." }
      ]
    : [];
  const busyMessage = renderingMessage
    ? renderingMessage
    : importing
    ? importStatus || "Processing files..."
    : loading
      ? "Running demand analysis..."
      : applyingFilters
        ? "Applying filters..."
        : exporting
          ? "Preparing export..."
          : searching
            ? "Searching online sources..."
            : "";
  const importHeaderTitle = activeSection === "Import Data" ? "Import File & Analyse" : activeSection;
  const importHeaderDescription =
    activeSection === "Import Data"
      ? "Upload business files, validate data, run forecasting, and export SCM decision reports."
      : result
        ? currentSkill?.description ?? "Review this module using the current imported file analysis."
        : "Import files and run analysis to populate this module with current workbook data.";
  const showImportControlColumn = pathway === "import" && activeSection === "Import Data";
  const workspaceGridClass =
    pathway === "search"
      ? "mx-auto max-w-6xl xl:grid-cols-[420px_1fr]"
      : showImportControlColumn
        ? "xl:grid-cols-[360px_1fr]"
        : "grid-cols-1";

  if (!pathway) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-slate-100 p-6">
        {busyMessage && <LoadingOverlay message={busyMessage} blocking={importing || loading || searching || exporting} />}
        <div className="rain-layer" aria-hidden="true">
          {Array.from({ length: 42 }).map((_, index) => (
            <span
              key={index}
              style={{
                left: `${(index * 37) % 100}%`,
                animationDelay: `${(index % 12) * -0.28}s`,
                animationDuration: `${1.8 + (index % 7) * 0.18}s`
              }}
            />
          ))}
        </div>
        <div className="clipart-cloud clipart-cloud-a" aria-hidden="true" />
        <div className="clipart-cloud clipart-cloud-b" aria-hidden="true" />
        <section className="relative z-10 mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col justify-center">
          <div className="mb-8">
            <div className="mb-5 inline-flex items-center gap-4 rounded-lg border border-teal-100 bg-white/90 px-5 py-4 text-teal-900 shadow-panel">
              <div className="grid h-14 w-14 place-items-center rounded-lg bg-primary text-white">
                <PackageSearch size={32} />
              </div>
              <div>
                <div className="text-3xl font-semibold tracking-tight">ForecastSync</div>
                <div className="text-sm text-muted-foreground">Demand planning intelligence</div>
              </div>
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950">Choose how you want to start</h1>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <button
              onClick={() => withWaitScreen("Opening import workspace...", () => {
                window.history.pushState({}, "", pathForSection("Import Data"));
                setPathway("import");
                setActiveSection("Import Data");
              })}
              className="rounded-lg border border-border bg-white p-6 text-left shadow-panel transition hover:-translate-y-0.5 hover:border-teal-300"
            >
              <UploadCloud className="mb-5 text-primary" size={34} />
              <h2 className="text-2xl font-semibold">Import File & Analyse</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Upload CSV, Excel, or JSON files, classify data, validate quality, preview tables, run forecasting, and export SCM reports.
              </p>
            </button>
            <button
              onClick={() => withWaitScreen("Opening search workspace...", () => {
                window.history.pushState({}, "", pathForSection("Search By Choice"));
                setPathway("search");
                setSearchDashboard(false);
              })}
              className="rounded-lg border border-border bg-white p-6 text-left shadow-panel transition hover:-translate-y-0.5 hover:border-teal-300"
            >
              <Globe2 className="mb-5 text-primary" size={34} />
              <h2 className="text-2xl font-semibold">Search By Choice</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Enter a product, category, brand, and region to run a separate Tavily-powered online market research search.
              </p>
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-slate-100">
      {pathway === "import" && <aside className="no-print sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-border bg-white p-4 lg:block">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-md bg-primary p-2 text-white"><PackageSearch size={22} /></div>
          <div>
            <div className="font-semibold">ForecastSync</div>
            <div className="text-xs text-muted-foreground">SCM BI Forecasting</div>
          </div>
        </div>
        <nav className="space-y-1">
          {visibleNavItems.map((item) => (
            <button
              key={item}
              onClick={() => navigateTo(item, "import")}
              className={`w-full rounded-md px-3 py-2 text-left text-sm ${activeSection === item ? "bg-teal-50 font-medium text-teal-800" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>}

      <section className="w-full">
        {busyMessage && <LoadingOverlay message={busyMessage} blocking={importing || loading || searching || exporting} />}
        <header className="no-print border-b border-border bg-white px-5 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <button className="mb-2 text-sm font-medium text-primary hover:underline" onClick={navigateHome}>Change pathway</button>
              <h1 className="text-2xl font-semibold tracking-tight">
                {pathway === "import" ? importHeaderTitle : "Search By Choice"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {pathway === "import"
                  ? importHeaderDescription
                  : "Search online market signals for a chosen product, category, brand, and region."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {pathway === "import" && <Button onClick={analyze} disabled={loading || importing || !datasets.length} title={!datasets.length ? "Upload a file before running analysis." : undefined}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                Run analysis
              </Button>}
              {pathway === "import" && <Button variant="secondary" onClick={() => clearImportData()} disabled={!datasets.length && !result}>
                <Trash2 size={16} />Remove data
              </Button>}
              {pathway === "search" && <Button onClick={searchMarket} disabled={searching}>
                {searching ? <Loader2 className="animate-spin" size={16} /> : <Globe2 size={16} />}
                Search online
              </Button>}
              {pathway === "search" && <Button variant="secondary" onClick={() => clearSearchData()} disabled={!marketSearch}>
                <Trash2 size={16} />Remove data
              </Button>}
              {pathway === "import" && <Button variant="secondary" onClick={exportPdf} disabled={!result || !selectedOutputs.includes("PDF Report")}><Download size={16} />PDF</Button>}
              {pathway === "import" && <Button variant="secondary" onClick={exportExcel} disabled={!result || !selectedOutputs.includes("Excel Report")}><FileSpreadsheet size={16} />Excel</Button>}
              {pathway === "import" && <Button
                variant="secondary"
                disabled={!result || !selectedOutputs.includes("CSV Export")}
                onClick={exportCsv}
              >
                <Download size={16} />CSV
              </Button>}
            </div>
          </div>
        </header>

        <div className={`grid gap-5 p-5 ${workspaceGridClass}`}>
          {(pathway === "search" || showImportControlColumn) && <section className="no-print space-y-5">
            {pathway === "search" && <Card>
              <CardHeader>
                <h2 className="font-semibold">Product & Brand</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  ["productName", "Product name"],
                  ["category", "Category"],
                  ["brand", "Brand"],
                  ["region", "Region"]
                ].map(([key, label]) => (
                  <label key={key} className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">{label}</span>
                    <input
                      className="w-full rounded-md border border-border px-3 py-2"
                      value={selection[key as keyof typeof selection]}
                      placeholder={`Enter ${label.toLowerCase()}`}
                      onChange={(event) => setSelection((current) => ({ ...current, [key]: event.target.value }))}
                    />
                  </label>
                ))}
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Number of sites to search</span>
                  <select className="w-full rounded-md border border-border px-3 py-2" value={sourceCount} onChange={(event) => setSourceCount(Number(event.target.value))}>
                    {[5, 10, 12, 15, 20].map((count) => <option key={count} value={count}>{count} sources</option>)}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Expert opinion / manual notes</span>
                  <textarea className="min-h-24 w-full rounded-md border border-border px-3 py-2" value={expertNotes} onChange={(event) => setExpertNotes(event.target.value)} />
                </label>
                {pathway === "search" && <Button variant="secondary" onClick={searchMarket} disabled={searching} className="w-full">
                  {searching ? <Loader2 className="animate-spin" size={16} /> : <Globe2 size={16} />}
                  Search product/brand online
                </Button>}
                {pathway === "search" && marketSearch && (
                  <div className="rounded-md border border-border bg-slate-50 p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-medium">Online search result</span>
                      <Badge tone={marketSearch.provider === "tavily" ? "low" : "medium"}>{marketSearch.provider}</Badge>
                    </div>
                    <p className="line-clamp-4 text-muted-foreground">{marketSearch.summary}</p>
                    <div className="mt-2 text-xs text-muted-foreground">{marketSearch.sources.length} source links found</div>
                  </div>
                )}
              </CardContent>
            </Card>}

            {pathway === "import" && activeSection === "Import Data" && <Card id="import">
              <CardHeader>
                <h2 className="font-semibold">Import Data</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm hover:bg-slate-100">
                  {importing ? <Loader2 className="mb-2 animate-spin text-primary" /> : <UploadCloud className="mb-2 text-primary" />}
                  {importing ? "Importing file..." : "Upload CSV, Excel, or JSON files"}
                  <input className="hidden" type="file" multiple accept=".csv,.xlsx,.xls,.json" disabled={importing} onChange={(event) => handleFiles(event.target.files)} />
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  <a className="rounded-md border border-border px-2 py-1" href="/templates/historical_sales_template.csv" download>CSV template</a>
                  <a className="rounded-md border border-border px-2 py-1" href="/templates/demand_template.json" download>JSON template</a>
                  <a className="rounded-md border border-border px-2 py-1" href="/templates/template_notes.md" download>Excel guide</a>
                </div>
              </CardContent>
            </Card>}

            {pathway === "import" && activeSection === "Import Data" && (
              <Card>
                <CardHeader className="relative">
                  <h2 className="font-semibold">Brand Filter</h2>
                  <InfoCorner
                    title="Brand filter"
                    description="Filters analysis to matching brand rows when brand columns exist in the imported workbook."
                    rules={["Recognized columns include Brand, brand, ProductBrand, and manufacturer.", "Uploading a new file replaces old data so results come from the current file only."]}
                  />
                </CardHeader>
                <CardContent>
                  <select className="w-full rounded-md border border-border px-3 py-2" value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)}>
                    <option>All brands</option>
                    {brandOptions.map((brand) => <option key={brand}>{brand}</option>)}
                  </select>
                </CardContent>
              </Card>
            )}
            {pathway === "import" && activeSection === "Import Data" && <FilterCard title="Input Factors" items={inputFactors} selected={selectedInputs} setSelected={setSelectedInputs} setApplyingFilters={setApplyingFilters} />}
            {pathway === "import" && activeSection === "Import Data" && <FilterCard title="Output Results" items={outputSections} selected={selectedOutputs} setSelected={setSelectedOutputs} setApplyingFilters={setApplyingFilters} />}
          </section>}

          <section id="report-root" className="space-y-5">
            {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
            {pathway === "import" && importStatus && (
              <div className={`rounded-md border p-3 text-sm ${importing ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                <div className="flex items-center gap-2">
                  {importing && <Loader2 className="animate-spin" size={16} />}
                  <span>{importStatus}</span>
                </div>
              </div>
            )}
            {pathway === "import" && !result && (
              <Card className="border-dashed">
                <CardContent className="flex min-h-[340px] flex-col items-center justify-center text-center">
                  <Globe2 className="mb-3 text-primary" size={42} />
                  <h2 className="text-xl font-semibold">
                    {activeSection === "Import Data" ? "Ready for SCM demand analysis" : `${activeSection} is ready for analysis`}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    {activeSection === "Import Data"
                      ? "Upload your files, choose product details, select factors, then run analysis. Online product search is available as a separate pathway."
                      : "This page uses the current uploaded Excel, CSV, or JSON analysis. Go to Import Data, upload your file, and run analysis to fill this module with exact file-based charts and tables."}
                  </p>
                  {activeSection !== "Import Data" && (
                    <Button className="mt-5" onClick={() => navigateTo("Import Data", "import")}>
                      <UploadCloud size={16} />Open Import Data
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {pathway === "search" && !searchDashboard && (
              <Card className={!marketSearch ? "border-dashed" : ""}>
                <CardHeader className="relative">
                  <h2 className="font-semibold">Online Market Search</h2>
                  <p className="text-sm text-muted-foreground">This path only searches the selected product/category/brand. It does not import or analyse files.</p>
                  <InfoCorner
                    title="Online market search"
                    description="Uses Tavily live search when the API key is available and returns public market signals without mixing imported files."
                    rules={["Each search requests at least 10 Tavily sources.", "Trend, competitor, promotion, seasonal, and economic signals are derived from returned text.", "No uploaded file data is used in this pathway."]}
                  />
                </CardHeader>
                <CardContent className="space-y-4">
                  {!marketSearch && (
                    <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                      <Globe2 className="mb-3 text-primary" size={42} />
                      <h3 className="text-xl font-semibold">Ready to search</h3>
                      <p className="mt-2 max-w-xl text-sm text-muted-foreground">Enter your choice on the left, then run a Tavily search for public market signals and source links.</p>
                    </div>
                  )}
                  {marketSearch && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={marketSearch.provider === "tavily" ? "low" : "medium"}>{marketSearch.provider}</Badge>
                        <Badge>{marketSearch.sources.length} sources</Badge>
                      </div>
                      <p className="text-sm leading-6 text-slate-700">{marketSearch.summary}</p>
                      <Button onClick={() => {
                        window.history.pushState({}, "", pathForSection("Search Dashboard"));
                        setSearchDashboard(true);
                      }}>
                        <BarChart3 size={16} />Create dashboard from results
                      </Button>
                      <DataTable rows={marketSearch.sources.map((source) => ({ ...source }))} />
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {pathway === "search" && searchDashboard && marketSearch && (
              <SearchDashboard selection={selection} search={marketSearch} onBack={() => {
                window.history.pushState({}, "", pathForSection("Search By Choice"));
                setSearchDashboard(false);
              }} />
            )}

            {pathway === "import" && result && activeSection === "Dashboard" && (
              <>
                <DataQualityBanner datasets={filteredDatasets} />
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {kpis.map((kpi) => (
                    <Card key={kpi.label} className="relative">
                      <CardContent className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-muted-foreground">{kpi.label}</div>
                          <div className="mt-1 text-2xl font-semibold">{kpi.value}</div>
                          <div className="mt-2 text-xs text-muted-foreground">Source: {sourceSheetForKpi(kpi.label, result)}</div>
                        </div>
                        <kpi.icon className="text-primary" />
                      </CardContent>
                      <InfoCorner
                        title={kpi.label}
                        description={kpi.rule ?? "Calculated from the current uploaded workbook only."}
                        rules={[
                          kpi.rule ?? "Uses current-file analysed rows only.",
                          "Uploading a new workbook clears old analysis and filters.",
                          kpi.value === "Relevant data not found" ? "Required source rows are missing in the current workbook." : "Messy numeric values are cleaned before calculation."
                        ]}
                      />
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardHeader className="relative flex flex-row items-center justify-between pr-12">
                    <div>
                      <h2 className="font-semibold">Demand Forecast Summary</h2>
                      <p className="text-sm text-muted-foreground">{result.selection.productName} · {result.selection.category} · {result.selection.brand}</p>
                    </div>
                    <Badge tone="low">File analysis</Badge>
                    <InfoCorner
                      title="Demand forecast"
                      description="Shows actual imported demand, weighted moving average, adjusted forecast, and optional next-12-month forecast."
                      rules={["Adjusted forecast applies trend, seasonality, promotion, competitor, and economic multipliers.", "12-month future forecast is light-colored and generated only from the current imported file analysis.", "Forecast Error = Actual Demand - Forecasted Demand."]}
                    />
                  </CardHeader>
                  <CardContent>
                    <ForecastChart data={selectedInputs.includes("Future 12-Month Forecast") ? [...result.forecast.points, ...result.forecast.futurePoints] : result.forecast.points} />
                  </CardContent>
                </Card>

                <div className="grid auto-rows-[minmax(360px,auto)] gap-5 xl:grid-cols-4">
                  {dashboardSkills.map((skill, index) => (
                    <ModuleOutputCard
                      key={skill.id}
                      skill={skill}
                      chartsEnabled={dashboardChartsReady}
                      chartDelayIndex={index}
                      size={dashboardSizes[skill.id] ?? "2:1"}
                      onSizeChange={(size) => {
                        setRenderingMessage("Resizing dashboard card...");
                        window.setTimeout(() => {
                          setDashboardSizes((current) => ({ ...current, [skill.id]: size }));
                          window.setTimeout(() => setRenderingMessage(""), 250);
                        }, 0);
                      }}
                      onDropCard={(sourceId) => moveDashboardCard(sourceId, skill.id)}
                    />
                  ))}
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <Card>
                    <CardHeader className="relative border-b border-border bg-gradient-to-r from-white to-teal-50/40 pr-12">
                      <h2 className="font-semibold">Bangladesh Regional Demand Map</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Regional demand concentration, growth, and risk by major Bangladesh markets.</p>
                      <InfoCorner title="Bangladesh Regional Demand Map" description="Shows regional demand markers, ranked demand bars, growth, and local risk for SCM allocation decisions." rules={["Marker radius is scaled by demand.", "Marker color follows risk level.", "Regional bars are normalized against the highest-demand region."]} />
                    </CardHeader>
                    <CardContent><BangladeshDemandMap data={result.skills.find((skill) => skill.id === "customer-demand")?.chartData as never} /></CardContent>
                  </Card>
                  <Card>
                    <CardHeader><h2 className="font-semibold">SCM Flow Map</h2></CardHeader>
                    <CardContent className="space-y-4">
                      <SupplyChainFlowMap data={buildSupplyChainFlow(result)} />
                      <div className="rounded-md border border-border p-4">
                        <h3 className="font-semibold">Final SCM Recommendation</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{result.finalRecommendation}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="relative border-b border-border bg-gradient-to-r from-white to-amber-50/50 pr-12">
                    <h2 className="font-semibold">Risk Alerts & Action Plan</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Operational risk triage with prioritized replenishment, reorder, seasonality, competitor, and refresh actions.</p>
                    <InfoCorner title="Risk Alerts & Action Plan" description="Converts forecast accuracy, seasonal lift, competitor pressure, and stock recommendation into SCM actions." rules={["High forecast error raises planning risk.", "Seasonal demand lift creates pre-stock alerts.", "Recommended stock and reorder point drive replenishment actions."]} />
                  </CardHeader>
                  <CardContent className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <SummaryTile label="Alerts" value={String(result.alerts.length)} />
                        <SummaryTile label="Critical/High" value={String(result.alerts.filter((alert) => alert.level === "critical" || alert.level === "high").length)} />
                        <SummaryTile label="Actions" value={String(result.actionPlan.length)} />
                      </div>
                      {(result.alerts.length ? result.alerts : [{ level: "low" as const, message: "No severe alerts detected. Continue routine monitoring and refresh after the next upload." }]).map((alert, index) => (
                        <div key={index} className={`rounded-md border p-4 text-sm ${riskClass(alert.level)}`}>
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide">{alert.level} risk</div>
                          {alert.message}
                        </div>
                      ))}
                    </div>
                    <ol className="relative space-y-3 border-l border-slate-200 pl-5 text-sm">
                      {result.actionPlan.map((action, index) => <li key={action} className="relative rounded-md border border-border bg-white p-4 shadow-sm">
                        <span className="absolute -left-[31px] top-4 grid h-6 w-6 place-items-center rounded-full bg-primary text-xs font-semibold text-white">{index + 1}</span>
                        <div className="font-medium">Priority {index + 1}</div>
                        <p className="mt-1 leading-6 text-muted-foreground">{action}</p>
                      </li>)}
                    </ol>
                  </CardContent>
                </Card>
              </>
            )}

            {pathway === "import" && activeSection === "Import Data" && (
              <Card>
                <CardHeader className="relative pr-12">
                  <h2 className="font-semibold">Uploaded File Health</h2>
                  <InfoCorner
                    title="Imported file health"
                    description="Shows only the current uploaded file set. Uploading new files replaces previous data to prevent old outputs from leaking into new analysis."
                    rules={["Quality score is based on blank cells and cleaning issues.", "Excel sheets are auto-classified by sheet name when possible.", "Cleaned rows are used for analysis and preview."]}
                  />
                </CardHeader>
                <CardContent className="space-y-4">
                  <DataQualityPipeline datasets={filteredDatasets} />
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryTile label="Rows analysed" value={formatNumber(importedSummary.rows)} />
                    <SummaryTile label="Data sources" value={String(importedSummary.datasets)} />
                    <SummaryTile label="Average quality" value={`${importedSummary.quality}%`} />
                    <SummaryTile label="Brands found" value={String(Math.max(brandOptions.length, brandFilter === "All brands" ? 0 : 1))} />
                  </div>
                  <div className="rounded-md border border-border bg-slate-50 p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">Summarised Imported Data Results</h3>
                        <p className="text-sm text-muted-foreground">Current file only, after cleaning and optional brand filter.</p>
                      </div>
                      <Button variant="secondary" onClick={() => downloadCleanedData(filteredDatasets)} disabled={!filteredDatasets.length}>
                        <Download size={16} />Cleaned CSV
                      </Button>
                    </div>
                    <div className="grid gap-2 text-sm md:grid-cols-2">
                      <div>Total numeric demand detected: <b>{formatNumber(importedSummary.numericDemand)}</b></div>
                      <div>Blank rows removed: <b>{formatNumber(importedSummary.blankRowsRemoved)}</b></div>
                      <div>Duplicate rows removed: <b>{formatNumber(importedSummary.duplicateRowsRemoved)}</b></div>
                      <div>Values corrected: <b>{formatNumber(importedSummary.correctedValues)}</b></div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredDatasets.map((dataset) => (
                      <div key={dataset.id} className="rounded-md border border-border p-3">
                        <div className="font-medium">{dataset.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{dataset.type}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge>{dataset.rows.length} rows</Badge>
                          <Badge tone={dataset.qualityScore > 80 ? "low" : "medium"}>{dataset.qualityScore}% quality</Badge>
                          {dataset.cleaningSummary && <Badge tone="low">Cleaned</Badge>}
                        </div>
                        {dataset.issues.length > 0 && (
                          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                            {dataset.issues.slice(0, 4).map((issue) => <li key={issue}>{issue}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                  <DataTable rows={filteredDatasets[0]?.rows ?? []} />
                  {result && (
                    <div className="rounded-md border border-border bg-white p-4">
                      <h3 className="font-semibold">Analysis Scope</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone="low">{filteredDatasets.length} uploaded files</Badge>
                        <Badge>{result.inputFactors.length} input factors</Badge>
                        <Badge>{result.outputSections.length} output sections</Badge>
                        <Badge>{brandFilter}</Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {pathway === "import" && currentSkill && currentSkillChart && (
              <Card>
                <CardHeader className="relative flex flex-row items-center justify-between pr-12">
                  <div>
                    <h2 className="font-semibold">{currentSkill.title}</h2>
                    <p className="text-sm text-muted-foreground">{currentSkill.recommendation}</p>
                  </div>
                  <Badge tone={currentSkill.riskLevel}>{currentSkill.riskLevel}</Badge>
                  <InfoCorner title={currentSkill.title} description={currentSkill.description ?? currentSkill.recommendation} rules={currentSkill.calculationRules ?? currentSkill.insights} />
                </CardHeader>
                <CardContent className="space-y-4">
                  <DataQualityBanner datasets={filteredDatasets} />
                  <ModuleFilterPanel
                    skill={currentSkill}
                    rows={((currentSkill.tableData ?? currentSkill.chartData) as Record<string, unknown>[])}
                    filter={currentModuleFilter}
                    setFilter={(filter) => applyModuleFilter(currentSkill.id, filter)}
                  />
                  <div className="grid gap-3 md:grid-cols-2">
                    {currentSkill.insights.map((insight) => <div key={insight} className="rounded-md border border-border bg-slate-50 p-3 text-sm">{insight}</div>)}
                  </div>
                  {currentSkill.id === "forecasting-methods" && (
                    <a className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-teal-800" href="/forecast-methods">
                      Open full Forecast Methods page
                    </a>
                  )}
                  <SkillChart skill={currentSkillChart} />
                  <VisualSourceMeta skill={currentSkill} rows={currentSkillRows} datasets={filteredDatasets} />
                  {currentSkill.id === "forecasting-methods" && result && <ForecastingMethodsDetail result={result} />}
                  <DataTable rows={currentSkillRows} />
                </CardContent>
              </Card>
            )}

          </section>
        </div>
        {pathway === "import" && result && exporting && <PdfReport result={result} includeFuture={selectedInputs.includes("Future 12-Month Forecast")} />}
      </section>
    </main>
  );
}

function LoadingOverlay({ message, blocking }: { message: string; blocking: boolean }) {
  return (
    <div className={`fixed inset-0 z-50 grid place-items-center bg-slate-950/18 backdrop-blur-[2px] ${blocking ? "" : "pointer-events-none"}`}>
      <div className="w-[min(420px,calc(100vw-32px))] rounded-lg border border-border bg-white p-6 text-center shadow-panel">
        <Loader2 className="mx-auto mb-4 animate-spin text-primary" size={34} />
        <h2 className="text-lg font-semibold text-slate-950">Please wait</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="grid h-72 place-items-center rounded-md border border-dashed border-border bg-slate-50 text-sm text-muted-foreground">
      Loading visual...
    </div>
  );
}

function InfoCorner({ title, description, rules }: { title: string; description: string; rules: string[] }) {
  return (
    <div className="group absolute right-3 top-3 z-20">
      <button type="button" className="grid h-8 w-8 place-items-center rounded-md border border-border bg-white text-slate-500 shadow-sm hover:text-primary" aria-label={`${title} details`}>
        <Info size={16} />
      </button>
      <div className="pointer-events-none absolute right-0 top-10 hidden w-80 max-w-[calc(100vw-48px)] rounded-md border border-border bg-white p-4 text-left text-sm shadow-panel group-hover:block">
        <h3 className="font-semibold text-slate-950">{title}</h3>
        <p className="mt-2 leading-5 text-muted-foreground">{description}</p>
        <div className="mt-3 font-medium text-slate-800">Rules used</div>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
          {rules.slice(0, 5).map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function VisualSourceMeta({ skill, rows, datasets }: { skill: SkillResult; rows: Record<string, unknown>[]; datasets: UploadedDataset[] }) {
  const sourceSheets = sourceSheetsForSkill(skill, datasets);
  const warnings = dataQualityWarnings(datasets);
  return (
    <div className="flex flex-wrap gap-2 rounded-md border border-border bg-slate-50 p-3 text-xs text-muted-foreground">
      <Badge>Source: {sourceSheets.length ? sourceSheets.join(", ") : "Relevant data not found"}</Badge>
      <Badge>{rows.length} rows used</Badge>
      {activeWorkbookLabel(datasets) && <Badge>Active Workbook: {activeWorkbookLabel(datasets)}</Badge>}
      {warnings.slice(0, 3).map((warning) => <Badge key={warning} tone="medium">{warning}</Badge>)}
      {!rows.length && <span>Relevant data not found for this module in the current uploaded workbook.</span>}
    </div>
  );
}

function DataQualityBanner({ datasets }: { datasets: UploadedDataset[] }) {
  const warnings = dataQualityWarnings(datasets);
  if (!warnings.length) return null;
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <div className="font-semibold">Data quality warning</div>
      <div className="mt-1">{warnings.join(" · ")}</div>
    </div>
  );
}

function DataQualityPipeline({ datasets }: { datasets: UploadedDataset[] }) {
  const stages = [
    "Upload File",
    "Detect File Type",
    "Read All Sheets",
    "Classify Sheets",
    "Clean Data",
    "Validate Data",
    "Map to Modules",
    "Ready for Analysis"
  ];
  const hasData = datasets.length > 0;
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Data Quality Pipeline</h3>
        <Badge tone={hasData ? "low" : "medium"}>{hasData ? "Current workbook ready" : "Relevant data not found"}</Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        {stages.map((stage, index) => (
          <div key={stage} className={`rounded-md border p-3 text-xs ${hasData || index === 0 ? "border-teal-200 bg-teal-50 text-teal-900" : "border-border bg-slate-50 text-muted-foreground"}`}>
            <div className="font-semibold">{stage}</div>
          </div>
        ))}
      </div>
      {hasData && (
        <div className="mt-3 text-xs text-muted-foreground">
          Source: {activeWorkbookLabel(datasets)} · Rows used: {datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0)}
        </div>
      )}
    </div>
  );
}

function ModuleOutputCard({
  skill,
  size,
  onSizeChange,
  onDropCard,
  chartsEnabled = true,
  chartDelayIndex = 0
}: {
  skill: SkillResult;
  size?: DashboardCardSize;
  onSizeChange?: (size: DashboardCardSize) => void;
  onDropCard?: (sourceId: string) => void;
  chartsEnabled?: boolean;
  chartDelayIndex?: number;
}) {
  const cardSize = size ?? "2:1";
  return (
    <Card
      onDragOver={(event) => onDropCard && event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData("text/plain");
        if (sourceId && sourceId !== skill.id) onDropCard?.(sourceId);
      }}
      className={`dashboard-card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-panel ${dashboardSizeClass(cardSize)}`}
    >
      <CardHeader className="relative min-h-24 border-b border-border bg-gradient-to-r from-white to-teal-50/40 pr-12">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {onDropCard && (
              <span
                draggable
                onDragStart={(event) => event.dataTransfer.setData("text/plain", skill.id)}
                className="grid h-8 w-8 cursor-grab place-items-center rounded-md border border-border bg-white text-slate-400 active:cursor-grabbing"
                title="Drag to reorder"
              >
                <GripVertical size={18} />
              </span>
            )}
            <h3 className="truncate font-semibold">{skill.title}</h3>
            <Badge tone={skill.riskLevel}>{skill.riskLevel}</Badge>
          </div>
          {onSizeChange && (
            <label className="no-print flex items-center gap-2 rounded-md border border-border bg-white px-2 py-1 text-xs text-muted-foreground shadow-sm">
              Size
              <select
                className="bg-transparent text-slate-800 outline-none"
                value={cardSize}
                onChange={(event) => onSizeChange(event.target.value as DashboardCardSize)}
                onClick={(event) => event.stopPropagation()}
              >
                <option value="1:1">1:1</option>
                <option value="16:4">16:4</option>
                <option value="2:1">2:1</option>
                <option value="1:2">1:2</option>
              </select>
            </label>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{skill.recommendation}</p>
        <InfoCorner title={skill.title} description={skill.description ?? skill.recommendation} rules={skill.calculationRules ?? skill.insights} />
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {skill.kpis?.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {skill.kpis.slice(0, 2).map((kpi) => <SummaryTile key={kpi.label} label={kpi.label} value={kpi.value} />)}
          </div>
        ) : null}
        {onDropCard ? <DashboardChartSlot skill={skill} enabled={chartsEnabled} delayIndex={chartDelayIndex} /> : <SkillChart skill={skill} />}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge>Source: {moduleSourceLabel(skill)}</Badge>
          <Badge>{(skill.tableData ?? skill.chartData).length} rows used</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function moduleSourceLabel(skill: SkillResult) {
  const labels: Record<string, string> = {
    "historical-sales": "Historical Sales Data",
    "market-trends": "Market Trend Data / Historical Sales Data",
    seasonality: "Seasonality / Historical Sales Data",
    "customer-demand": "Customer Demand Data",
    "promotion-impact": "Promotion & Discount Data",
    "economic-conditions": "Economic Data",
    "competitor-activities": "Competitor Data",
    "inventory-levels": "Inventory Data",
    "lead-time": "Lead Time Data",
    "forecasting-methods": "Historical Sales Data",
    "technology-data": "Uploaded files",
    "forecast-accuracy": "Historical Sales Data",
    "final-recommendation": "Analysed modules"
  };
  return skill.chartData.length || skill.tableData?.length ? labels[skill.id] ?? "Current workbook" : "Relevant data not found";
}

function DashboardChartSlot({ skill, enabled, delayIndex }: { skill: SkillResult; enabled: boolean; delayIndex: number }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }

    const timer = window.setTimeout(() => setReady(true), Math.min(900, delayIndex * 85));
    return () => window.clearTimeout(timer);
  }, [delayIndex, enabled, skill.id]);

  if (!ready) return <ChartSkeleton />;

  return (
    <div>
      <SkillChart skill={skill} />
    </div>
  );
}

function dashboardSizeClass(size: DashboardCardSize) {
  if (size === "16:4") return "xl:col-span-4";
  if (size === "1:1") return "xl:col-span-1";
  if (size === "1:2") return "xl:col-span-1 xl:row-span-2";
  return "xl:col-span-2";
}

function ModuleFilterPanel({
  skill,
  rows,
  filter,
  setFilter
}: {
  skill: SkillResult;
  rows: Record<string, unknown>[];
  filter: ModuleFilterState;
  setFilter: (filter: ModuleFilterState) => void;
}) {
  const metricOptions = useMemo(() => {
    const keys = new Set<string>();
    rows.slice(0, 250).forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (typeof row[key] === "number") keys.add(key);
      });
    });
    return Array.from(keys);
  }, [rows]);
  const optionSet = useMemo(() => {
    const allOptions = moduleFilterOptions(skill);
    if (!rows.length) return ["All records"];
    return allOptions.filter((option) => option === "All records" || rows.some((row) => applyModuleOption(row, option)));
  }, [rows, skill]);
  const facets = useMemo(() => moduleFacets(rows), [rows]);
  const [draftFilter, setDraftFilter] = useState(filter);

  useEffect(() => {
    setDraftFilter((current) =>
      current.text === filter.text &&
      current.metric === filter.metric &&
      current.option === filter.option &&
      current.product === filter.product &&
      current.category === filter.category &&
      current.brand === filter.brand &&
      current.region === filter.region &&
      current.channel === filter.channel &&
      current.source === filter.source
        ? current
        : { ...defaultModuleFilter, ...filter }
    );
  }, [filter, skill.id]);

  useEffect(() => {
    if (!optionSet.includes(draftFilter.option)) {
      setDraftFilter((current) => ({ ...current, option: "All records" }));
    }
  }, [draftFilter.option, optionSet]);

  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Filter size={16} />
          Tailored module filters
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="px-3 py-1 text-xs"
            onClick={() => {
              const resetFilter = defaultModuleFilter;
              setDraftFilter(resetFilter);
              setFilter(resetFilter);
            }}
          >
            Reset
          </Button>
          <Button
            type="button"
            className="px-3 py-1 text-xs"
            onClick={() => setFilter(draftFilter)}
          >
            Apply
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Choose filter</span>
          <select className="w-full rounded-md border border-border px-3 py-2" value={draftFilter.option} onChange={(event) => setDraftFilter({ ...draftFilter, option: event.target.value })}>
            {optionSet.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Search within this module</span>
          <input className="w-full rounded-md border border-border px-3 py-2" value={draftFilter.text} onChange={(event) => setDraftFilter({ ...draftFilter, text: event.target.value })} placeholder={`Filter ${skill.title.toLowerCase()}`} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Primary metric</span>
          <select className="w-full rounded-md border border-border px-3 py-2" value={draftFilter.metric} onChange={(event) => setDraftFilter({ ...draftFilter, metric: event.target.value })}>
            <option>All metrics</option>
            {metricOptions.map((metric) => <option key={metric}>{metric}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {facets.map((facet) => (
          <label key={facet.key} className="text-sm">
            <span className="mb-1 block text-muted-foreground">{facet.label}</span>
            <select
              className="w-full rounded-md border border-border px-3 py-2"
              value={draftFilter[facet.key]}
              onChange={(event) => setDraftFilter({ ...draftFilter, [facet.key]: event.target.value })}
            >
              <option>{facet.allLabel}</option>
              {facet.values.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Filters are applied only after clicking Apply, so charts and tables keep using the current analysed data until the wait screen completes.
      </p>
    </div>
  );
}

function moduleFilterOptions(skill: SkillResult) {
  if (skill.id === "historical-sales") return ["All records", "Recent periods", "High actual demand", "Low actual demand", "High forecast error", "Forecast baseline rows"];
  if (skill.id === "market-trends") return ["All records", "Trend index rows", "Growth demand sources", "Competitor mention sources", "Economic mention sources", "High trend signal"];
  if (skill.id === "seasonality") return ["All records", "Ramadan/Eid lift", "Winter/Summer lift", "Peak demand months", "Low demand months", "Festival adjusted rows"];
  if (skill.id === "customer-demand") return ["All records", "Dhaka and Chattogram", "High demand regions", "High growth regions", "High risk regions", "Map-ready regions"];
  if (skill.id === "promotion-impact") return ["All records", "High promotion intensity", "Promotion uplift periods", "Discount-sensitive rows", "Low uplift periods", "Campaign planning rows"];
  if (skill.id === "economic-conditions") return ["All records", "Inflation impact", "Purchasing power rows", "High economic risk", "Price sensitive rows", "Income pressure rows"];
  if (skill.id === "competitor-activities") return ["All records", "High promotion intensity", "Price pressure rows", "Product launch signals", "Market share pressure", "Competitor watch rows"];
  if (skill.id === "inventory-levels") return ["All records", "Safety stock target", "Reorder point target", "Recommended stock target", "Stockout risk rows", "Inventory buffer rows"];
  if (skill.id === "lead-time") return ["All records", "Purchase lead time", "Production lead time", "Transport lead time", "Receiving lead time", "Longest lead stages"];
  if (skill.id === "forecasting-methods") return ["All records", "Future forecast only", "Historical model fit", "Simple and moving averages", "Weighted and trend forecasts", "Error measurements"];
  if (skill.id === "technology-data") return ["All records", "Low quality sources", "High quality sources", "Cleaned import sources", "ERP/POS ready sources", "Rows with validation issues"];
  if (skill.id === "forecast-accuracy") return ["All records", "High absolute error", "Positive bias", "Negative bias", "Excellent accuracy rows", "Needs improvement rows"];
  if (skill.id === "final-recommendation") return ["All records", "Replenishment actions", "Competitor watch actions", "Promotion actions", "Economic risk actions", "High priority actions"];
  return ["All records", "Current source data"];
}

function slugifySection(section: string) {
  return section.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function pathForSection(section: string) {
  return `/${slugifySection(section)}`;
}

function sectionFromPath(pathname: string) {
  const slug = pathname.replace(/^\/+|\/+$/g, "");
  if (!slug) return null;
  const knownSections = [
    "Dashboard",
    "Import Data",
    "Search By Choice",
    "Search Dashboard",
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
    "Final SCM Recommendation"
  ];
  return knownSections.find((section) => slugifySection(section) === slug) ?? null;
}

function SearchDashboard({ selection, search, onBack }: { selection: ProductSelection; search: WebSearchResult; onBack: () => void }) {
  const signalRows = [
    signalDetail("Market trend", search.trendSignals.marketTrendIndex),
    signalDetail("Competitor pressure", search.trendSignals.competitorPressure),
    signalDetail("Economic risk", search.trendSignals.economicRisk),
    signalDetail("Seasonal lift", search.trendSignals.seasonalLift),
    signalDetail("Promotion pressure", search.trendSignals.promotionPressure)
  ];
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="relative pr-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Search Dashboard</h2>
              <p className="text-sm text-muted-foreground">{selection.productName} · {selection.category} · {selection.brand}</p>
            </div>
            <Button variant="secondary" onClick={onBack}>Back to sources</Button>
          </div>
          <InfoCorner
            title="Search dashboard"
            description="Transforms live public-search findings into SCM demand signals, risks, and recommended watch areas."
            rules={["Uses only the current search result.", "At least 10 sources are requested from Tavily.", "Scores are derived from source text mentions of demand, competitor, economy, seasonality, and promotion terms."]}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {signalRows.map((row) => (
              <div key={row.signal} className="relative rounded-md border border-border bg-white p-3 pr-10">
                <div className="text-xs text-muted-foreground">{row.signal}</div>
                <div className="mt-1 text-xl font-semibold">{row.score}/100</div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{row.interpretation}</p>
                <InfoCorner title={row.signal} description={row.description} rules={row.rules} />
              </div>
            ))}
          </div>
          <p className="rounded-md border border-border bg-slate-50 p-4 text-sm leading-6 text-slate-700">{search.summary}</p>
        </CardContent>
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader className="relative pr-12">
            <h3 className="font-semibold">Online Signal Chart</h3>
            <InfoCorner title="Online signal chart" description="Compares market, competitor, economy, seasonal, and promotion pressure from public-source text." rules={["Scores are keyword-derived indicators.", "Higher competitor and economic scores increase SCM risk.", "Higher market and seasonal scores indicate possible demand lift."]} />
          </CardHeader>
          <CardContent><SkillChart skill={{ id: "search-signals", title: "Search Signals", riskLevel: "medium", recommendation: search.summary, insights: [], chartData: signalRows }} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="relative pr-12">
            <h3 className="font-semibold">Source Evidence</h3>
            <InfoCorner title="Source evidence" description="Shows source links used for the current online dashboard." rules={["Sources are not mixed with imported files.", "Use source links to validate market assumptions.", "Re-run search when product, category, brand, or region changes."]} />
          </CardHeader>
          <CardContent><DataTable rows={search.sources.map((source) => ({ ...source }))} /></CardContent>
        </Card>
      </div>
    </div>
  );
}

function signalDetail(signal: string, score: number) {
  const level = score >= 70 ? "High" : score >= 45 ? "Moderate" : "Low";
  const details: Record<string, { description: string; rules: string[] }> = {
    "Market trend": {
      description: "Indicates public demand momentum for the selected product, category, brand, and region.",
      rules: ["Base score starts at 50.", "Adds weight when sources mention growth, demand, popular, trend, or increase.", "Higher score suggests stronger market pull."]
    },
    "Competitor pressure": {
      description: "Measures competitive threat from pricing, promotions, launches, and rival activity.",
      rules: ["Base score starts at 35.", "Adds weight for competitor, discount, launch, price, and promotion mentions.", "Higher score means tighter inventory and pricing monitoring."]
    },
    "Economic risk": {
      description: "Shows how inflation, income, purchasing power, and price sensitivity may affect demand.",
      rules: ["Base score starts at 30.", "Adds weight for inflation, income, purchasing power, and price sensitive mentions.", "Higher score can reduce adjusted forecast and raise value-pack priority."]
    },
    "Seasonal lift": {
      description: "Estimates demand lift from Ramadan, Eid, winter, summer, and festival patterns.",
      rules: ["Base score starts at 18.", "Adds weight for Ramadan, Eid, winter, summer, and festival mentions.", "Higher score supports pre-season stock increases."]
    },
    "Promotion pressure": {
      description: "Measures how active discounts, campaigns, offers, and promotions are in the market.",
      rules: ["Base score starts at 25.", "Adds weight for promotion, campaign, discount, and offer mentions.", "Higher score means promotion plans should be tied to stock availability."]
    }
  };
  return {
    signal,
    score,
    interpretation: `${level} signal. ${score >= 70 ? "Actively monitor and include in SCM decision." : score >= 45 ? "Include as a planning adjustment." : "Keep as background context."}`,
    description: details[signal].description,
    rules: details[signal].rules
  };
}

function ForecastingMethodsDetail({ result }: { result: AnalysisResult }) {
  const methodRows = [
    { name: "Time Series Forecasting", value: result.forecast.nextPeriodForecast, description: "Uses past data patterns to predict future demand." },
    { name: "Causal / Associative Forecasting", value: result.webSearch.trendSignals.economicRisk, description: "Uses related factors like price, income, promotion, weather, economy, etc." },
    { name: "Qualitative Forecasting", value: result.forecast.confidenceScore, description: "Based on expert opinion, market research, surveys, judgment." },
    { name: "Delphi Method", value: Math.round((result.forecast.confidenceScore + result.forecast.accuracy) / 2), description: "Forecasting through repeated expert feedback until a common opinion is reached." }
  ];
  const patternRows = [
    { pattern: "Trend", score: result.forecast.nextPeriodForecast },
    { pattern: "Seasonality", score: result.webSearch.trendSignals.seasonalLift },
    { pattern: "Cyclical Variation", score: result.webSearch.trendSignals.economicRisk },
    { pattern: "Irregular / Random Variation", score: result.forecast.methodMetrics.rmse },
    { pattern: "Level / Horizontal Pattern", score: result.forecast.methodMetrics.simpleAverage },
    { pattern: "Noise", score: result.forecast.methodMetrics.mad }
  ];
  const techniqueRows = [
    { technique: "Simple Average Method", value: result.forecast.methodMetrics.simpleAverage },
    { technique: "Moving Average Method", value: result.forecast.points.at(-1)?.movingAverage ?? 0 },
    { technique: "Weighted Moving Average Method", value: result.forecast.points.at(-1)?.weightedMovingAverage ?? 0 },
    { technique: "Exponential Smoothing Method", value: result.forecast.methodMetrics.exponentialSmoothing }
  ];
  const errorRows = [
    { error: "MAD", value: result.forecast.methodMetrics.mad },
    { error: "MSE", value: result.forecast.methodMetrics.mse },
    { error: "RMSE", value: result.forecast.methodMetrics.rmse },
    { error: "MPE", value: result.forecast.methodMetrics.mpe },
    { error: "MAPE", value: result.forecast.mape },
    { error: "Forecast Error / Bias", value: result.forecast.methodMetrics.bias }
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <ForecastingPanel title="4 Types of Forecasting Models" rows={methodRows} labelKey="name" valueKey="value" detailKey="description" />
        <ForecastingPanel title="6 Components / Patterns of Forecasting Data" rows={patternRows} labelKey="pattern" valueKey="score" />
        <ForecastingPanel title="4 Quantitative Forecasting Techniques" rows={techniqueRows} labelKey="technique" valueKey="value" />
        <ForecastingPanel title="Forecast Error Measurement Types" rows={errorRows} labelKey="error" valueKey="value" />
      </div>
    </div>
  );
}

function ForecastingPanel({ title, rows, labelKey, valueKey, detailKey }: { title: string; rows: Record<string, unknown>[]; labelKey: string; valueKey: string; detailKey?: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3">
        <SkillChart skill={{ id: title.toLowerCase(), title, riskLevel: "low", recommendation: title, insights: [], chartData: rows }} />
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={String(row[labelKey])} className="rounded-md bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{String(row[labelKey])}</span>
              <Badge>{String(row[valueKey])}</Badge>
            </div>
            {detailKey && <p className="mt-1 text-xs leading-5 text-muted-foreground">{String(row[detailKey])}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PdfReport({ result, includeFuture }: { result: AnalysisResult; includeFuture: boolean }) {
  return (
    <div id="pdf-report-root" className="pointer-events-none fixed left-[-12000px] top-0 w-[1200px] space-y-5 bg-slate-100 p-5">
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-semibold">ForecastSync SCM Report</h2>
          <p className="text-sm text-muted-foreground">{result.selection.productName} · {result.selection.category} · {result.selection.brand} · {result.selection.region}</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <SummaryTile label="Next Forecast" value={formatNumber(result.forecast.nextPeriodForecast)} />
          <SummaryTile label="Accuracy" value={`${result.forecast.accuracy}%`} />
          <SummaryTile label="Safety Stock" value={formatNumber(result.forecast.safetyStock)} />
          <SummaryTile label="Reorder Point" value={formatNumber(result.forecast.reorderPoint)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Overall Demand Forecast</h2></CardHeader>
        <CardContent><ForecastChart data={includeFuture ? [...result.forecast.points, ...result.forecast.futurePoints] : result.forecast.points} /></CardContent>
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        {result.skills.map((skill) => <ModuleOutputCard key={skill.id} skill={skill} />)}
      </div>
      <Card>
        <CardHeader><h2 className="font-semibold">Final Recommendation</h2></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-6 text-slate-700">{result.finalRecommendation}</p>
          {result.actionPlan.map((action) => <div key={action} className="rounded-md border border-border bg-white p-3 text-sm">{action}</div>)}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterCard<T extends string>({
  title,
  items,
  selected,
  setSelected,
  setApplyingFilters
}: {
  title: string;
  items: T[];
  selected: T[];
  setSelected: (items: T[]) => void;
  setApplyingFilters: (value: boolean) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  function setAllChecked(checked: boolean) {
    formRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((input) => {
      input.checked = checked;
    });
  }

  function applyFilters() {
    const checkedItems = Array.from(formRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked') ?? []).map((input) => input.value as T);
    window.setTimeout(() => {
      setApplyingFilters(true);
      requestAnimationFrame(() => {
        setSelected(checkedItems);
        window.setTimeout(() => setApplyingFilters(false), 350);
      });
    }, 0);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => setAllChecked(true)}>All</Button>
          <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => setAllChecked(false)}>Clear</Button>
        </div>
      </CardHeader>
      <CardContent>
        <form ref={formRef} className="grid gap-2">
        {items.map((item) => (
          <label key={item} className="flex items-start gap-2 rounded-md border border-border bg-white p-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              value={item}
              defaultChecked={selected.includes(item)}
            />
            <span>{item}</span>
          </label>
        ))}
        <Button type="button" className="mt-2 w-full" onClick={applyFilters}>
          Apply filters
        </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function extractBrandOptions(datasets: UploadedDataset[]) {
  const brands = new Set<string>();
  datasets.forEach((dataset) => {
    dataset.rows.forEach((row) => {
      const value = getBrandValue(row);
      if (value) brands.add(value);
    });
  });
  return Array.from(brands).sort((a, b) => a.localeCompare(b));
}

function filterDatasetsByBrand(datasets: UploadedDataset[], brand: string) {
  if (brand === "All brands") return datasets;
  return datasets.map((dataset) => {
    const rowsWithBrand = dataset.rows.filter((row) => getBrandValue(row));
    if (!rowsWithBrand.length) return dataset;
    const rows = dataset.rows.filter((row) => getBrandValue(row) === brand);
    return { ...dataset, rows };
  });
}

function getBrandValue(row: Record<string, unknown>) {
  const brandKey = Object.keys(row).find((key) => ["brand", "productbrand", "manufacturer", "company"].includes(normalizeKey(key)));
  const value = brandKey ? row[brandKey] : "";
  return String(value ?? "").trim();
}

function extractSelectionFromDatasets(datasets: UploadedDataset[]): ProductSelection {
  return {
    productName:
      findScenarioValue(datasets, ["product", "productname", "item", "sku"]) ||
      firstRowValue(datasets, ["productname", "product", "item", "sku", "material"]),
    category:
      findScenarioValue(datasets, ["category", "productcategory"]) ||
      firstRowValue(datasets, ["category", "productcategory", "segment", "department"]),
    brand:
      findScenarioValue(datasets, ["brand", "manufacturer", "company"]) ||
      firstRowValue(datasets, ["brand", "productbrand", "manufacturer", "company"]),
    region:
      findScenarioValue(datasets, ["region", "market", "country"]) ||
      firstRowValue(datasets, ["region", "city", "market", "country"])
  };
}

function findScenarioValue(datasets: UploadedDataset[], keys: string[]) {
  for (const dataset of datasets) {
    for (const row of dataset.rows) {
      const field = firstRowValueFromRow(row, ["field", "key", "attribute", "name"]);
      const value = firstRowValueFromRow(row, ["value", "result", "text"]);
      if (field && value && keys.includes(normalizeKey(field))) return value;
    }
  }
  return "";
}

function firstRowValue(datasets: UploadedDataset[], keys: string[]) {
  for (const dataset of datasets) {
    for (const row of dataset.rows) {
      const value = firstRowValueFromRow(row, keys);
      if (value) return value;
    }
  }
  return "";
}

function firstRowValueFromRow(row: Record<string, unknown>, keys: string[]) {
  const matchedKey = Object.keys(row).find((key) => keys.includes(normalizeKey(key)));
  return matchedKey ? String(row[matchedKey] ?? "").trim() : "";
}

function summarizeDatasets(datasets: UploadedDataset[]) {
  const rows = datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0);
  const quality = datasets.length ? Math.round(datasets.reduce((sum, dataset) => sum + dataset.qualityScore, 0) / datasets.length) : 0;
  const numericDemand = datasets.reduce((sum, dataset) => {
    return sum + dataset.rows.reduce((rowSum, row) => {
      const demandKey = Object.keys(row).find((key) => ["actual", "actualunits", "unitssold", "demand", "quantity", "sales", "forecastdemandunits"].includes(normalizeKey(key)));
      const value = demandKey ? Number(row[demandKey]) : 0;
      return rowSum + (Number.isFinite(value) ? Math.max(0, value) : 0);
    }, 0);
  }, 0);
  const blankRowsRemoved = datasets.reduce((sum, dataset) => sum + (dataset.cleaningSummary?.blankRowsRemoved ?? 0), 0);
  const duplicateRowsRemoved = datasets.reduce((sum, dataset) => sum + (dataset.cleaningSummary?.duplicateRowsRemoved ?? 0), 0);
  const correctedValues = datasets.reduce(
    (sum, dataset) => sum + (dataset.cleaningSummary?.numericValuesConverted ?? 0) + (dataset.cleaningSummary?.dateValuesNormalized ?? 0) + (dataset.cleaningSummary?.textTrimmed ?? 0),
    0
  );
  return { datasets: datasets.length, rows, quality, numericDemand, blankRowsRemoved, duplicateRowsRemoved, correctedValues };
}

function averageLeadTimeLabel(result: AnalysisResult) {
  const leadSkill = result.skills.find((skill) => skill.id === "lead-time");
  const rows = (leadSkill?.chartData ?? []) as Record<string, unknown>[];
  const values = rows.map((row) => numberForAnyKey(row, ["days", "leadtime", "averageleadtime", "totalleadtimedays"])).filter((value) => value > 0);
  if (!values.length) return "No data";
  return `${Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)} days`;
}

function stockoutRiskLabel(result: AnalysisResult) {
  const inventorySkill = result.skills.find((skill) => skill.id === "inventory-levels");
  const inventoryRows = (inventorySkill?.tableData ?? []) as Record<string, unknown>[];
  if (!inventoryRows.length) return "Relevant data not found";
  if (inventorySkill?.riskLevel === "high" || inventorySkill?.riskLevel === "critical") return "Elevated";
  if (result.alerts.some((alert) => /stock|reorder|inventory/i.test(alert.message))) return "Elevated";
  return "Managed";
}

function competitorPressureLabel(result: AnalysisResult) {
  const competitorSkill = result.skills.find((skill) => skill.id === "competitor-activities");
  const competitorRows = (competitorSkill?.tableData ?? competitorSkill?.chartData ?? []) as Record<string, unknown>[];
  return competitorRows.length ? `${result.webSearch.trendSignals.competitorPressure}/100` : "Relevant data not found";
}

function sourceSheetForKpi(label: string, result: AnalysisResult) {
  if (label === "Avg Lead Time") return result.skills.find((skill) => skill.id === "lead-time")?.tableData?.length ? "Lead Time Data" : "Relevant data not found";
  if (label === "Competitor Pressure") return result.skills.find((skill) => skill.id === "competitor-activities")?.tableData?.length ? "Competitor Data" : "Relevant data not found";
  if (label === "Stockout Risk") return result.skills.find((skill) => skill.id === "inventory-levels")?.tableData?.length ? "Inventory Data" : "Relevant data not found";
  return result.forecast.points.length ? "Historical Sales Data" : "Relevant data not found";
}

function sourceSheetsForSkill(skill: SkillResult, datasets: UploadedDataset[]) {
  const map: Record<string, UploadedDataset["type"][]> = {
    "historical-sales": ["Historical Sales Data"],
    "market-trends": ["Market Trend Data"],
    seasonality: ["Seasonality / Festival Data", "Historical Sales Data"],
    "customer-demand": ["Customer Demand Data"],
    "promotion-impact": ["Promotion & Discount Data"],
    "economic-conditions": ["Economic Data"],
    "competitor-activities": ["Competitor Data"],
    "inventory-levels": ["Inventory Data"],
    "lead-time": ["Lead Time Data"],
    "forecasting-methods": ["Historical Sales Data"],
    "technology-data": datasets.map((dataset) => dataset.type),
    "forecast-accuracy": ["Historical Sales Data"],
    "final-recommendation": datasets.map((dataset) => dataset.type)
  };
  const allowed = new Set(map[skill.id] ?? []);
  return datasets.filter((dataset) => allowed.has(dataset.type) && dataset.rows.length).map((dataset) => dataset.name);
}

function activeWorkbookLabel(datasets: UploadedDataset[]) {
  return datasets.map((dataset) => dataset.name).filter(Boolean).slice(0, 2).join(", ");
}

function dataQualityWarnings(datasets: UploadedDataset[]) {
  const warnings = new Set<string>();
  datasets.forEach((dataset) => {
    const summary = dataset.cleaningSummary;
    if (!summary) return;
    if (summary.numericValuesConverted) warnings.add("Text/currency numbers cleaned");
    if (summary.dateValuesNormalized) warnings.add("Dates normalized");
    if (summary.duplicateRowsRemoved) warnings.add("Duplicate rows removed");
    if (summary.negativeDemandRowsFlagged) warnings.add("Returns detected");
    if (summary.outlierRowsFlagged) warnings.add("Outlier spikes flagged");
  });
  return Array.from(warnings);
}

function buildSupplyChainFlow(result: AnalysisResult) {
  const leadSkill = result.skills.find((skill) => skill.id === "lead-time");
  const inventorySkill = result.skills.find((skill) => skill.id === "inventory-levels");
  const demandSkill = result.skills.find((skill) => skill.id === "customer-demand");
  const leadRows = (leadSkill?.chartData ?? []) as Record<string, unknown>[];
  const inventoryRows = (inventorySkill?.chartData ?? []) as Record<string, unknown>[];
  const demandRows = (demandSkill?.chartData ?? []) as Record<string, unknown>[];
  const avgLead = leadRows.map((row) => numberForAnyKey(row, ["days", "leadtime", "totalleadtimedays"])).filter((value) => value > 0);
  const currentStock = inventoryRows.find((row) => String(row.metric ?? "").toLowerCase().includes("current"))?.value;
  const recommendedStock = inventoryRows.find((row) => String(row.metric ?? "").toLowerCase().includes("recommended"))?.value ?? result.forecast.recommendedStock;
  const topRegion = demandRows.slice().sort((a, b) => numberForAnyKey(b, ["demand"]) - numberForAnyKey(a, ["demand"]))[0];
  return [
    {
      step: "Supplier",
      metric: avgLead.length ? `${Math.round(avgLead.reduce((sum, value) => sum + value, 0) / avgLead.length)} day avg lead` : "Lead time missing",
      note: leadRows[0]?.stage ? String(leadRows[0].stage) : "Add supplier lead-time rows"
    },
    {
      step: "Warehouse",
      metric: currentStock ? `${Number(currentStock).toLocaleString()} current` : "Current stock missing",
      note: `Target ${Number(recommendedStock).toLocaleString()} units`
    },
    {
      step: "Retailer",
      metric: `${result.forecast.reorderPoint.toLocaleString()} reorder point`,
      note: "Replenishment threshold from current forecast"
    },
    {
      step: "Customer",
      metric: topRegion?.region ? String(topRegion.region) : `${result.forecast.nextPeriodForecast.toLocaleString()} forecast`,
      note: topRegion?.demand ? `${Number(topRegion.demand).toLocaleString()} regional demand` : "Upload regional demand rows for city allocation"
    }
  ];
}

function filterModuleRows(rows: Record<string, unknown>[], filter: ModuleFilterState) {
  const text = filter.text.trim().toLowerCase();
  return rows
    .filter((row) => !text || rowText(row).includes(text))
    .filter((row) => facetMatches(row, "product", filter.product, "All products"))
    .filter((row) => facetMatches(row, "category", filter.category, "All categories"))
    .filter((row) => facetMatches(row, "brand", filter.brand, "All brands"))
    .filter((row) => facetMatches(row, "region", filter.region, "All regions"))
    .filter((row) => facetMatches(row, "channel", filter.channel, "All channels"))
    .filter((row) => facetMatches(row, "source", filter.source, "All sources"))
    .filter((row) => applyModuleOption(row, filter.option))
    .map((row) => {
      if (filter.metric === "All metrics") return row;
      const firstKey = Object.keys(row)[0];
      return { [firstKey]: row[firstKey], [filter.metric]: row[filter.metric] };
    });
}

type ModuleFacet = { key: "product" | "category" | "brand" | "region" | "channel" | "source"; label: string; allLabel: string; values: string[] };

function moduleFacets(rows: Record<string, unknown>[]): ModuleFacet[] {
  const config: Omit<ModuleFacet, "values">[] = [
    { key: "product", label: "Product", allLabel: "All products" },
    { key: "category", label: "Category", allLabel: "All categories" },
    { key: "brand", label: "Brand", allLabel: "All brands" },
    { key: "region", label: "Region", allLabel: "All regions" },
    { key: "channel", label: "Channel", allLabel: "All channels" },
    { key: "source", label: "Source sheet", allLabel: "All sources" }
  ];
  return config
    .map((facet) => ({
      ...facet,
      values: uniqueFacetValues(rows, facet.key)
    }))
    .filter((facet) => facet.values.length > 1 || facet.key === "source" && facet.values.length > 0);
}

function uniqueFacetValues(rows: Record<string, unknown>[], key: ModuleFacet["key"]) {
  const values = new Set<string>();
  rows.forEach((row) => {
    const value = facetValue(row, key);
    if (value) values.add(value);
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

function facetMatches(row: Record<string, unknown>, key: ModuleFacet["key"], selected: string, allLabel: string) {
  if (!selected || selected === allLabel) return true;
  return facetValue(row, key) === selected;
}

function facetValue(row: Record<string, unknown>, key: ModuleFacet["key"]) {
  const keys: Record<ModuleFacet["key"], string[]> = {
    product: ["product", "productname", "item", "sku", "material"],
    category: ["category", "productcategory", "segment", "department"],
    brand: ["brand", "productbrand", "manufacturer", "company"],
    region: ["region", "city", "market", "country"],
    channel: ["channel", "preferredchannel", "saleschannel"],
    source: ["source", "sheet", "type", "file"]
  };
  const matchedKey = Object.keys(row).find((rowKey) => keys[key].includes(normalizeKey(rowKey)));
  const value = matchedKey ? String(row[matchedKey] ?? "").trim() : "";
  return value;
}

function applyModuleOption(row: Record<string, unknown>, option: string) {
  if (option === "All records") return true;
  const values = rowText(row);
  const max = numericMax(row);
  const actual = numberForAnyKey(row, ["actual", "demand", "value", "score", "trendindex", "promotionintensity", "days", "rows", "qualityscore"]);
  const error = numberForAnyKey(row, ["absoluteerror", "error", "bias"]);
  const period = String(row.period ?? row.month ?? row.stage ?? row.metric ?? row.region ?? row.priority ?? "").toLowerCase();

  if (option === "Recent periods") return /\b(9|10|11|12|q4|nov|dec|latest)\b/.test(period) || Boolean(row.isFuture);
  if (option === "High actual demand") return numberForAnyKey(row, ["actual", "demand"]) >= 2500 || max >= 2500;
  if (option === "Low actual demand") return numberForAnyKey(row, ["actual", "demand"]) > 0 && numberForAnyKey(row, ["actual", "demand"]) <= 1000;
  if (option === "High forecast error") return Math.abs(error) >= 250 || numberForAnyKey(row, ["absolutepercentageerror"]) >= 15;
  if (option === "Forecast baseline rows") return ["movingaverage", "weightedmovingaverage", "trendforecast", "adjustedforecast"].some((key) => hasNormalizedKey(row, key));

  if (option === "Trend index rows") return hasNormalizedKey(row, "trendindex") || values.includes("trend");
  if (option === "Growth demand sources") return ["growth", "demand", "increase", "rising", "market"].some((term) => values.includes(term));
  if (option === "Competitor mention sources") return ["competitor", "rival", "launch", "pricing"].some((term) => values.includes(term));
  if (option === "Economic mention sources") return ["inflation", "income", "economy", "purchasing", "price sensitive"].some((term) => values.includes(term));
  if (option === "High trend signal") return numberForAnyKey(row, ["trendindex", "score"]) >= 65 || max >= 65;

  if (option === "Ramadan/Eid lift") return ["ramadan", "eid", "festival"].some((term) => values.includes(term)) || numberForAnyKey(row, ["festivallift", "festival"]) >= 10;
  if (option === "Winter/Summer lift") return ["winter", "summer"].some((term) => values.includes(term));
  if (option === "Peak demand months") return actual >= 2500 || numberForAnyKey(row, ["festivallift", "festival"]) >= 12;
  if (option === "Low demand months") return actual > 0 && actual <= 1200;
  if (option === "Festival adjusted rows") return hasNormalizedKey(row, "festivallift") || hasNormalizedKey(row, "festival");

  if (option === "Dhaka and Chattogram") return ["dhaka", "chattogram", "chittagong"].some((term) => values.includes(term));
  if (option === "High demand regions") return numberForAnyKey(row, ["demand", "forecastdemandunits", "demandscore"]) >= 2200;
  if (option === "High growth regions") return numberForAnyKey(row, ["growth", "growthpct", "demandscore"]) >= 12;
  if (option === "High risk regions") return values.includes("high") || numberForAnyKey(row, ["demand"]) >= 3500;
  if (option === "Map-ready regions") return Boolean(row.region ?? row.city) && (hasNormalizedKey(row, "lat") || hasNormalizedKey(row, "latitude") || hasNormalizedKey(row, "lng") || hasNormalizedKey(row, "longitude"));

  if (option === "High promotion intensity") return numberForAnyKey(row, ["promotion", "promotionintensity", "discount"]) >= 40 || values.includes("high promotion");
  if (option === "Promotion uplift periods") return numberForAnyKey(row, ["promotion", "promotionuplift", "uplift"]) > 0 || values.includes("uplift");
  if (option === "Discount-sensitive rows") return ["discount", "coupon", "campaign"].some((term) => values.includes(term));
  if (option === "Low uplift periods") return numberForAnyKey(row, ["promotion", "promotionuplift", "uplift"]) <= 20;
  if (option === "Campaign planning rows") return ["campaign", "promotion", "discount", "roi"].some((term) => values.includes(term));

  if (option === "Inflation impact") return values.includes("inflation") || hasNormalizedKey(row, "inflation");
  if (option === "Purchasing power rows") return ["purchasing", "income", "power"].some((term) => values.includes(term));
  if (option === "High economic risk") return numberForAnyKey(row, ["risk", "economicrisk", "score"]) >= 60 || values.includes("high");
  if (option === "Price sensitive rows") return ["price", "sensitive", "value"].some((term) => values.includes(term));
  if (option === "Income pressure rows") return ["income", "wage", "household"].some((term) => values.includes(term));

  if (option === "Price pressure rows") return ["price", "pricing"].some((term) => values.includes(term));
  if (option === "Product launch signals") return ["launch", "new product", "release"].some((term) => values.includes(term));
  if (option === "Market share pressure") return ["share", "market"].some((term) => values.includes(term));
  if (option === "Competitor watch rows") return ["competitor", "rival", "pricing", "promotion", "launch"].some((term) => values.includes(term));

  if (option === "Safety stock target") return values.includes("safety stock");
  if (option === "Reorder point target") return values.includes("reorder point");
  if (option === "Recommended stock target") return values.includes("recommended stock");
  if (option === "Stockout risk rows") return ["stockout", "risk", "low stock"].some((term) => values.includes(term));
  if (option === "Inventory buffer rows") return ["buffer", "safety", "stock"].some((term) => values.includes(term));

  if (option === "Purchase lead time") return period.includes("purchase") || values.includes("purchase");
  if (option === "Production lead time") return period.includes("production") || values.includes("production");
  if (option === "Transport lead time") return period.includes("transport") || values.includes("transport");
  if (option === "Receiving lead time") return period.includes("receiving") || values.includes("receiving");
  if (option === "Longest lead stages") return numberForAnyKey(row, ["days", "leadtime"]) >= 7;

  if (option === "Future forecast only") return Boolean(row.isFuture) || values.includes("future");
  if (option === "Historical model fit") return !row.isFuture && !["mad", "mse", "rmse", "mpe", "bias"].some((term) => values.includes(term));
  if (option === "Simple and moving averages") return ["simple average", "movingaverage", "moving average"].some((term) => values.includes(term) || hasNormalizedKey(row, term));
  if (option === "Weighted and trend forecasts") return ["weighted", "trendforecast", "trend forecast"].some((term) => values.includes(term) || hasNormalizedKey(row, term));
  if (option === "Error measurements") return ["mad", "mse", "rmse", "mpe", "bias", "error"].some((term) => values.includes(term));

  if (option === "Low quality sources") return numberForAnyKey(row, ["qualityscore", "score"]) > 0 && numberForAnyKey(row, ["qualityscore", "score"]) < 70;
  if (option === "High quality sources") return numberForAnyKey(row, ["qualityscore", "score"]) >= 85;
  if (option === "Cleaned import sources") return values.includes("clean") || values.includes("converted") || values.includes("normalized");
  if (option === "ERP/POS ready sources") return ["erp", "pos", "api", "connector"].some((term) => values.includes(term));
  if (option === "Rows with validation issues") return Boolean(row.issues) && String(row.issues).toLowerCase() !== "none";

  if (option === "High absolute error") return Math.abs(error) >= 250 || numberForAnyKey(row, ["absolutepercentageerror"]) >= 15;
  if (option.includes("Positive bias")) return Number(row.error ?? row.bias ?? 0) > 0;
  if (option.includes("Negative bias")) return Number(row.error ?? row.bias ?? 0) < 0;
  if (option === "Excellent accuracy rows") return numberForAnyKey(row, ["absolutepercentageerror"]) <= 10;
  if (option === "Needs improvement rows") return numberForAnyKey(row, ["absolutepercentageerror"]) >= 20 || Math.abs(error) >= 500;

  if (option === "Replenishment actions") return ["replenish", "stock", "reorder"].some((term) => values.includes(term));
  if (option === "Competitor watch actions") return ["competitor", "pricing"].some((term) => values.includes(term));
  if (option === "Promotion actions") return ["promotion", "discount"].some((term) => values.includes(term));
  if (option === "Economic risk actions") return ["inflation", "economic", "price"].some((term) => values.includes(term));
  if (option === "High priority actions") return numberForAnyKey(row, ["score", "priority"]) >= 75 || values.includes("priority");

  return true;
}

function rowText(row: Record<string, unknown>) {
  return Object.values(row).join(" ").toLowerCase();
}

function numericMax(row: Record<string, unknown>) {
  const nums = Object.values(row).map(Number).filter(Number.isFinite);
  return nums.length ? Math.max(...nums) : 0;
}

function numberForAnyKey(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const matchedKey = Object.keys(row).find((rowKey) => normalizeKey(rowKey) === normalizeKey(key));
    const value = matchedKey ? Number(row[matchedKey]) : 0;
    if (Number.isFinite(value) && value !== 0) return value;
  }
  return 0;
}

function hasNormalizedKey(row: Record<string, unknown>, key: string) {
  const normalized = normalizeKey(key);
  return Object.keys(row).some((rowKey) => normalizeKey(rowKey) === normalized);
}

function downloadCleanedData(datasets: UploadedDataset[]) {
  const rows = datasets.flatMap((dataset) => dataset.rows.map((row) => ({ source: dataset.name, type: dataset.type, ...row })));
  downloadBlob(toCsv(rows), "forecastsync-cleaned-import-data.csv", "text/csv");
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}
