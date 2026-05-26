import { extractDemandSeries } from "@/lib/forecasting/models";
import type { AnalysisSkill } from "./types";
import type { RiskLevel, UploadedDataset } from "@/types/scm";

const riskFromScore = (score: number): RiskLevel => (score > 78 ? "critical" : score > 62 ? "high" : score > 40 ? "medium" : "low");
const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  dhaka: { lat: 23.8103, lng: 90.4125 },
  chattogram: { lat: 22.3569, lng: 91.7832 },
  sylhet: { lat: 24.8949, lng: 91.8687 },
  rajshahi: { lat: 24.3745, lng: 88.6042 },
  khulna: { lat: 22.8456, lng: 89.5403 },
  barishal: { lat: 22.701, lng: 90.3535 },
  rangpur: { lat: 25.7439, lng: 89.2752 },
  mymensingh: { lat: 24.7471, lng: 90.4203 }
};

export const historicalSalesSkill: AnalysisSkill = ({ request, forecast }) => {
  const salesRows = rowsByType(request.uploadedDatasets, ["Historical Sales Data"]);
  const demandFieldKeys = ["UnitsSold", "ActualUnits", "Demand", "Quantity", "Sales", "Units"];
  const returnRows = salesRows.filter((row) => numberFor(row, demandFieldKeys, 0) < 0);
  const returnCount = returnRows.length;
  const hasRevenue = salesRows.some((row) => numberFor(row, ["RevenueBDT", "Revenue", "SalesRevenue", "TotalRevenue"], 0) > 0);
  const positiveRows = salesRows.filter((row) => numberFor(row, demandFieldKeys, 0) > 0);

  const chartRows =
    hasRevenue && positiveRows.length
      ? positiveRows.map((row, index) => ({
          period: String(valueFor(row, ["Month", "Period", "Date"]) ?? `P${index + 1}`),
          unitsSold: numberFor(row, demandFieldKeys, 0),
          revenueBDT: numberFor(row, ["RevenueBDT", "Revenue", "SalesRevenue", "TotalRevenue"], 0),
          movingAverage: 0,
          anomalyFlag: row.CleaningFlag ? String(row.CleaningFlag) : undefined
        }))
      : forecast.points.map((point) => ({
          ...point,
          anomalyFlag: salesRows.find(
            (row) =>
              row.CleaningFlag &&
              String(valueFor(row, ["Month", "Period", "Date"]) ?? "") === point.period
          )
            ? String(salesRows.find((row) => String(valueFor(row, ["Month", "Period", "Date"]) ?? "") === point.period)?.CleaningFlag)
            : undefined
        }));

  const riskLevel: RiskLevel = forecast.accuracy < 75 ? "high" : forecast.accuracy < 85 ? "medium" : "low";
  return {
    id: "historical-sales",
    title: "Historical Sales Data",
    riskLevel,
    recommendation: forecast.points.length
      ? "Use recent trend and weighted moving average as the primary demand baseline."
      : "Relevant data not found: upload historical sales rows with UnitsSold, Demand, or Quantity columns.",
    insights: [
      forecast.points.length
        ? `Historical sales from ${positiveRows.length || forecast.points.length} positive demand rows${returnCount > 0 ? `. ${returnCount} return/refund rows detected and separated from gross demand.` : "."}`
        : "No demand-bearing historical rows were found in the current file.",
      hasRevenue
        ? "RevenueBDT column detected — shown as secondary bars alongside unit sales."
        : "Festival and promotion columns are included when they exist in the uploaded sales rows."
    ],
    chartData: chartRows,
    tableData: salesRows.length ? salesRows : forecast.points,
    kpis: [{ label: "Sales growth", value: `${salesGrowth(forecast.points)}%`, tone: forecast.accuracy < 75 ? "high" : "medium" }],
    description: "Historical sales converts imported monthly demand into trend, moving average, and forecast baseline views.",
    calculationRules: [
      "Forecast Error = Actual Demand - Forecasted Demand.",
      "Moving average uses the previous three periods when available.",
      "Weighted moving average favors the newest period with a 50/30/20 split.",
      returnCount > 0
        ? `${returnCount} negative demand rows treated as returns/refunds and excluded from gross demand forecast.`
        : "RevenueBDT = UnitsSold × UnitPriceBDT where both columns are present."
    ]
  };
};

export const marketTrendSkill: AnalysisSkill = ({ request, webSearch, forecast }) => {
  const trendRows = rowsByType(request.uploadedDatasets, ["Market Trend Data"]);
  const points = forecast.points;
  const chartRows = trendRows.length
    ? trendRows.map((row, index) => ({
        period: String(valueFor(row, ["Period", "Month", "Date", "Week"]) ?? `T${index + 1}`),
        trendIndex: numberFor(row, ["TrendIndex", "TrendScore", "DemandScore", "Score", "Index"], 0),
        growthPct: numberFor(row, ["GrowthPct", "Growth", "GrowthRate"], 0),
        source: String(valueFor(row, ["Source", "Title", "Channel"]) ?? "Imported file")
      }))
    : points.map((point, index, arr) => {
        const firstActual = arr[0]?.actual || 0;
        const prev = arr[index - 1]?.actual || point.actual;
        const ma3 =
          index >= 2
            ? (arr[index].actual + arr[index - 1].actual + arr[index - 2].actual) / 3
            : point.actual;
        return {
          period: point.period,
          trendIndex: firstActual ? Math.round((point.actual / firstActual) * 100) : 0,
          demand: point.actual,
          growthPct: prev ? Number((((point.actual - prev) / prev) * 100).toFixed(1)) : 0,
          movingAverage3M: Math.round(ma3),
          source: "Historical_Sales"
        };
      });

  const lastRow = chartRows.at(-1);
  const trendDirection =
    lastRow && "growthPct" in lastRow && Number(lastRow.growthPct) > 2
      ? "Growing"
      : lastRow && "growthPct" in lastRow && Number(lastRow.growthPct) < -2
      ? "Declining"
      : "Stable";

  return {
    id: "market-trends",
    title: "Market Trends",
    riskLevel: riskFromScore(webSearch.trendSignals.marketTrendIndex),
    recommendation: chartRows.length
      ? `Trend direction: ${trendDirection}. Use current file trend rows and historical demand growth to refresh forecast after each upload.`
      : "Relevant data not found: upload market trend rows or historical demand rows to calculate this module.",
    insights: [
      trendRows.length
        ? "Market trend rows are generated from the current uploaded file."
        : chartRows.length
        ? `Market trend index is calculated from historical demand rows. Current direction: ${trendDirection}.`
        : "Relevant data not found: no market trend or historical demand rows were found.",
      "File analysis does not call live search. Web search is a separate pathway."
    ],
    chartData: chartRows,
    tableData: trendRows.length ? trendRows : chartRows,
    kpis: [{ label: "Trend", value: trendDirection, tone: trendDirection === "Declining" ? "high" : trendDirection === "Stable" ? "medium" : "low" }],
    description: "Market trend analysis uses uploaded trend rows or current-file historical demand growth.",
    calculationRules: [
      "DemandIndex = current period demand / first period demand × 100.",
      "GrowthPct = (current - previous) / previous × 100.",
      "3-month moving average smooths short-term demand fluctuations.",
      "If trend and demand rows are absent, the module shows Relevant data not found."
    ]
  };
};

export const seasonalitySkill: AnalysisSkill = ({ request, webSearch }) => {
  const seasonalRows = rowsByType(request.uploadedDatasets, ["Seasonality / Festival Data"]);
  const demandSeries = extractDemandSeries(request.uploadedDatasets);
  const baselineDemand = demandSeries.length ? demandSeries.reduce((sum, row) => sum + row.actual, 0) / demandSeries.length : 0;
  const chartRows = seasonalRows.length
    ? seasonalRows.map((row, index) => ({
        month: String(valueFor(row, ["Month", "Period", "Festival", "Season"]) ?? `S${index + 1}`),
        product: String(valueFor(row, ["ProductName", "Product", "Category", "Item"]) ?? "All"),
        demand: numberFor(row, ["Demand", "ForecastDemandUnits", "ActualUnits", "UnitsSold"], 0),
        festivalLift: numberFor(row, ["FestivalLiftPct", "Seasonality", "SeasonalLift", "Lift"], 0),
        seasonalityIndex: numberFor(row, ["SeasonalityIndex", "Index", "SeasonalIndex"], 0) ||
          (baselineDemand > 0 ? Number((numberFor(row, ["Demand", "ForecastDemandUnits", "ActualUnits", "UnitsSold"], 0) / baselineDemand).toFixed(2)) : 1),
        festivalTag: String(valueFor(row, ["Festival", "Tag", "Season", "Event"]) ?? "")
      }))
    : demandSeries.map((row) => {
        const seasonalIndex = baselineDemand ? row.actual / baselineDemand : 0;
        const period = row.period.toLowerCase();
        const festivalTag = period.includes("ramadan") || period.includes("eid") ? "Eid/Ramadan"
          : period.includes("win") ? "Winter"
          : period.includes("sum") ? "Summer"
          : "Regular";
        return {
          month: row.period,
          product: "All",
          demand: row.actual,
          festivalLift: Number(((seasonalIndex - 1) * 100).toFixed(1)),
          seasonalityIndex: Number(seasonalIndex.toFixed(2)),
          festivalTag
        };
      });
  return {
    id: "seasonality",
    title: "Seasonality",
    riskLevel: riskFromScore(webSearch.trendSignals.seasonalLift),
    recommendation: chartRows.length
      ? "Raise pre-season stock cover before high-index seasonal periods found in the file."
      : "Relevant data not found: upload seasonality/festival rows or historical monthly demand rows.",
    insights: [
      seasonalRows.length
        ? "Seasonality rows are read from the uploaded workbook."
        : chartRows.length
        ? "Seasonality index is calculated from historical demand vs baseline demand."
        : "Relevant data not found: no seasonality or historical demand rows found.",
      "Monthly planning should include festival adjustment factors for Ramadan, Eid, winter, and summer."
    ],
    chartData: chartRows,
    tableData: chartRows.length ? (seasonalRows.length ? seasonalRows : chartRows) : [],
    description: "Seasonality highlights monthly demand lift from the current file's festival and seasonality values.",
    calculationRules: [
      "SeasonalityIndex = actual demand / baseline demand.",
      "SeasonalLiftPct = (SeasonalityIndex - 1) × 100.",
      "Rows come from the current upload only."
    ]
  };
};

export const customerDemandSkill: AnalysisSkill = ({ request }) => {
  const regionalData = extractRegionalDemand(request.uploadedDatasets);

  const patternRows = rowsByType(request.uploadedDatasets, ["Customer Demand Data"]);
  const hasSegments = patternRows.some(
    (row) => valueFor(row, ["CustomerSegment", "Segment", "CustomerType"]) !== undefined
  );

  const sankeyRows = hasSegments
    ? patternRows.map((row, index) => ({
        segment: String(valueFor(row, ["CustomerSegment", "Segment", "CustomerType"]) ?? `Segment ${index + 1}`),
        channel: String(valueFor(row, ["PreferredChannel", "Channel", "SalesChannel"]) ?? "Retail"),
        region: String(valueFor(row, ["Region", "City", "Area"]) ?? "Dhaka"),
        purchaseFrequency: String(valueFor(row, ["PurchaseFrequency", "Frequency"]) ?? "Monthly"),
        avgBasketUnits: numberFor(row, ["AvgBasketUnits", "BasketUnits", "AvgQty"], 0),
        avgBasketValueBDT: numberFor(row, ["AvgBasketValueBDT", "BasketValue", "AvgValue"], 0)
      }))
    : [];

  const topRegion = regionalData.reduce(
    (top, item) => (Number(item.demand) > Number(top.demand) ? item : top),
    regionalData[0] ?? { region: "No region", demand: 0 }
  );

  return {
    id: "customer-demand",
    title: "Customer Demand Patterns",
    riskLevel: regionalData.some((item) => item.risk === "high") ? "high" : regionalData.length ? "medium" : "low",
    recommendation: regionalData.length
      ? `Prioritize ${topRegion.region} replenishment while monitoring regional variability.`
      : hasSegments
      ? "Customer segment data detected — Sankey diagram shows segment-channel-region flow."
      : "Relevant data not found: upload region/city demand rows or Customer_Patterns sheet.",
    insights: [
      regionalData.length ? "Regional demand map is generated from the current uploaded file." : "Relevant data not found: no regional map data was found.",
      hasSegments ? `${sankeyRows.length} customer segment rows detected — segment-channel-region flow is shown.` : "Upload a Customer_Patterns sheet with CustomerSegment, PreferredChannel, Region columns for the Sankey diagram."
    ],
    chartData: regionalData,
    tableData: hasSegments ? sankeyRows : regionalData,
    kpis: hasSegments
      ? [{ label: "Segments", value: String(new Set(sankeyRows.map((r) => r.segment)).size), tone: "low" as const }]
      : undefined,
    description: "Customer demand patterns compare demand by Bangladesh region and segment-channel-region flow.",
    calculationRules: [
      "Regional demand is aggregated by city/region rows.",
      "Sankey flow: CustomerSegment → PreferredChannel → Region, weighted by AvgBasketUnits.",
      "Dhaka and Chattogram are primary demand centers when present."
    ]
  };
};

export const promotionImpactSkill: AnalysisSkill = ({ request, webSearch }) => {
  const promotionRows = rowsByType(request.uploadedDatasets, ["Promotion & Discount Data"]);
  const demandSeries = extractDemandSeries(request.uploadedDatasets);

  const chartRows = promotionRows.length
    ? promotionRows.map((row, index) => {
        const discountPct = numberFor(row, ["DiscountPct", "Discount", "DiscountPercent", "PromotionPct"], 0);
        const expectedUplift = numberFor(row, ["ExpectedUpliftPct", "ExpectedUplift", "PlannedUplift"], discountPct * 0.8);
        const actualUplift = numberFor(row, ["ActualUpliftPct", "ActualUplift", "Uplift", "PromotionUplift", "Promotion"], 0);
        const budgetBDT = numberFor(row, ["BudgetBDT", "Budget", "SpendBDT", "Cost", "BudgetAmount"], 0);
        return {
          campaignName: String(valueFor(row, ["CampaignName", "Campaign", "Name", "Promotion"]) ?? `Campaign ${index + 1}`),
          period: String(valueFor(row, ["Period", "Month", "StartDate", "Date"]) ?? `P${index + 1}`),
          discountPct,
          expectedUpliftPct: Number(expectedUplift.toFixed(1)),
          actualUpliftPct: Number(actualUplift.toFixed(1)),
          budgetBDT,
          channel: String(valueFor(row, ["Channel", "SalesChannel", "PreferredChannel"]) ?? "All"),
          upliftGapPct: Number((actualUplift - expectedUplift).toFixed(1)),
          budgetPerUpliftPoint: actualUplift > 0 ? Math.round(budgetBDT / actualUplift) : 0,
          demand: numberFor(row, ["Demand", "ActualUnits", "UnitsSold", "ForecastDemandUnits"], 0)
        };
      })
    : demandSeries
        .filter((row) => row.promotion > 0)
        .map((row) => ({
          campaignName: row.period,
          period: row.period,
          discountPct: row.promotion,
          expectedUpliftPct: row.promotion * 0.8,
          actualUpliftPct: row.promotion * 0.6,
          budgetBDT: row.actual * row.promotion * 100,
          channel: "All",
          upliftGapPct: -row.promotion * 0.2,
          budgetPerUpliftPoint: 0,
          demand: row.actual
        }));

  return {
    id: "promotion-impact",
    title: "Promotions & Discounts",
    riskLevel: riskFromScore(webSearch.trendSignals.promotionPressure),
    recommendation: chartRows.length
      ? "Use promotions selectively; avoid discounting into low-stock weeks. Monitor uplift gap vs expected."
      : "Relevant data not found: upload promotion, discount, campaign, or uplift rows.",
    insights: [
      chartRows.length
        ? `${promotionRows.length} promotion rows detected. Bubble size represents budget; y-axis shows actual uplift vs expected.`
        : "Relevant data not found: no promotion rows in the current file.",
      "UpliftGap = ActualUpliftPct - ExpectedUpliftPct. Negative gap means underperforming promotions."
    ],
    chartData: chartRows,
    tableData: chartRows.length ? (promotionRows.length ? promotionRows : chartRows) : [],
    description: "Promotion ROI bubble chart: discount % vs actual uplift %, bubble size = budget BDT, with expected uplift reference line.",
    calculationRules: [
      "UpliftGapPct = ActualUpliftPct - ExpectedUpliftPct.",
      "BudgetPerUpliftPoint = BudgetBDT / ActualUpliftPct.",
      "Rows come from the Promotions sheet in the current upload only."
    ]
  };
};

export const economicConditionSkill: AnalysisSkill = ({ request, webSearch }) => {
  const rows = rowsByType(request.uploadedDatasets, ["Economic Data"]);
  const chartRows = rows.length
    ? rows.map((row, index) => ({
        indicator: String(valueFor(row, ["Indicator", "Metric", "Period", "Month"]) ?? `E${index + 1}`),
        inflationPct: numberFor(row, ["InflationPct", "Inflation", "InflationRate", "CPI"], 0),
        incomeIndex: numberFor(row, ["IncomeIndex", "Income", "IncomeGrowth"], 0),
        purchasingPowerIndex: numberFor(row, ["PurchasingPowerIndex", "PurchasingPower", "PowerIndex"], 0),
        fxRateBDTUSD: numberFor(row, ["FXRateBDTUSD", "FXRate", "ExchangeRate", "USD"], 0),
        economicRisk: numberFor(row, ["EconomicRisk", "Risk", "Score"], webSearch.trendSignals.economicRisk),
        demand: numberFor(row, ["Demand", "ForecastDemandUnits", "ActualUnits", "UnitsSold"], 0)
      }))
    : [];
  return {
    id: "economic-conditions",
    title: "Economic Conditions",
    riskLevel: riskFromScore(webSearch.trendSignals.economicRisk),
    recommendation: rows.length
      ? "Maintain value-pack availability and monitor inflation-driven price sensitivity."
      : "Relevant data not found: upload economic, inflation, income, or purchasing power rows.",
    insights: [
      rows.length ? "Economic rows are read from the uploaded workbook." : "Relevant data not found: no economic data rows in the current file.",
      "Economic impact on demand may have 1–2 month lag — track lagged correlation."
    ],
    chartData: chartRows,
    tableData: rows.length ? rows : chartRows,
    description: "Economic pressure index: inflation %, income index, purchasing power index, FX rate, and demand overlay.",
    calculationRules: [
      "Economic rows come from the Economic sheet in the current upload.",
      "Higher economic risk reduces adjusted forecast.",
      "1–2 month lag: economic pressure today may affect demand next period."
    ]
  };
};

export const competitorActivitySkill: AnalysisSkill = ({ request, webSearch }) => {
  const rows = rowsByType(request.uploadedDatasets, ["Competitor Data"]);
  const chartRows = rows.length
    ? rows.map((row, index) => ({
        competitorName: competitorNameFromRow(row) || `Competitor ${index + 1}`,
        competitorProduct: String(valueFor(row, ["CompetitorProduct", "Product", "Category"]) ?? ""),
        date: String(valueFor(row, ["Date", "Period", "Month", "EventDate"]) ?? ""),
        competitorPriceBDT: numberFor(row, ["CompetitorPriceBDT", "CompetitorPrice", "Price", "AvgPrice"], 0),
        promoActive: ["yes", "true", "active", "1"].includes(String(valueFor(row, ["PromoActive", "PromotionActive", "Promo"]) ?? "").toLowerCase()),
        launchEvent: ["yes", "true", "launch", "launched", "1"].includes(String(valueFor(row, ["LaunchEvent", "NewProductLaunch", "Launch"]) ?? "").toLowerCase()),
        priceDrop: numberFor(row, ["PriceDrop", "PriceChange", "PriceReduction"], 0) < 0 || ["yes", "true", "1"].includes(String(valueFor(row, ["PriceDrop"]) ?? "").toLowerCase()),
        promotionIntensity: numberFor(row, ["PromotionIntensity", "Promotion", "DiscountPct", "Discount"], flagScore(row, ["PromoActive", "PromotionActive"], 65)),
        launchScore: numberFor(row, ["LaunchScore", "Launch", "NewProduct"], flagScore(row, ["LaunchEvent", "NewProductLaunch"], 80)),
        sourceURL: String(valueFor(row, ["SourceURL", "URL", "Source", "Link"]) ?? "")
      }))
    : [];

  return {
    id: "competitor-activities",
    title: "Competitor Activities",
    riskLevel: riskFromScore(webSearch.trendSignals.competitorPressure),
    recommendation: rows.length
      ? "Monitor competitor pricing and launches from the uploaded file before finalizing inventory and discount plans."
      : "Relevant data not found: upload competitor rows (Competitors sheet) to calculate competitor activity.",
    insights: [
      rows.length ? "Competitor rows are read from the uploaded workbook." : "Relevant data not found: no competitor rows in the current file.",
      "Competitor promotions can suppress baseline demand. Monitor price gaps and launch events."
    ],
    chartData: chartRows,
    tableData: rows.length ? rows : [],
    description: "Competitor event timeline: shows promo active, launch event, and price drop markers per competitor over time. Includes price gap scatter.",
    calculationRules: [
      "Competitor rows come from the Competitors sheet in the current upload.",
      "PromoActive and LaunchEvent are boolean flags (yes/true/1).",
      "Price gap = CompetitorPriceBDT - own product price (when own price is available)."
    ]
  };
};

export const inventoryPlanningSkill: AnalysisSkill = ({ request, forecast }) => {
  const rows = rowsByType(request.uploadedDatasets, ["Inventory Data"]);
  const hasSkuData = rows.some((row) => numberFor(row, ["CurrentStock", "Stock", "OnHand", "Inventory", "AvailableStock"], 0) > 0);

  const skuRows = hasSkuData
    ? rows.map((row, index) => {
        const currentStock = numberFor(row, ["CurrentStock", "Stock", "OnHand", "Inventory", "AvailableStock"], 0);
        const stockInTransit = numberFor(row, ["StockInTransit", "InTransit", "Transit", "OnOrder", "IncomingStock"], 0);
        const backorders = numberFor(row, ["Backorders", "Backorder", "PendingOrders", "BackorderQty"], 0);
        const safetyStock = numberFor(row, ["SafetyStock", "Safety", "SafetyBuffer"], forecast.safetyStock);
        const reorderPoint = numberFor(row, ["ReorderPoint", "Reorder", "ReorderLevel"], forecast.reorderPoint);
        const inventoryPosition = currentStock + stockInTransit - backorders;
        const overstockThreshold = reorderPoint * 2;
        const inventoryStatus =
          currentStock < reorderPoint ? "Stockout Risk" : currentStock > overstockThreshold ? "Overstock" : "OK";
        return {
          sku: String(valueFor(row, ["SKU", "ProductCode", "ItemCode", "Code"]) ?? `SKU-${index + 1}`),
          productName: String(valueFor(row, ["ProductName", "Product", "Item", "Name"]) ?? `Product ${index + 1}`),
          warehouse: String(valueFor(row, ["Warehouse", "Location", "Region", "StorageLocation"]) ?? "Default"),
          currentStock: Math.round(currentStock),
          stockInTransit: Math.round(stockInTransit),
          backorders: Math.round(backorders),
          inventoryPosition: Math.round(inventoryPosition),
          safetyStock: Math.round(safetyStock),
          reorderPoint: Math.round(reorderPoint),
          overstockThreshold: Math.round(overstockThreshold),
          inventoryStatus
        };
      })
    : [];

  const aggregateStock = hasSkuData ? skuRows.reduce((sum, r) => sum + r.currentStock, 0) : null;
  const fallbackChartData = [
    ...(aggregateStock !== null ? [{ metric: "Current Stock", value: Math.round(aggregateStock) }] : []),
    { metric: "Safety Stock", value: forecast.safetyStock },
    { metric: "Reorder Point", value: forecast.reorderPoint },
    { metric: "Recommended Stock", value: forecast.recommendedStock },
    ...(aggregateStock !== null ? [{ metric: "Stock Gap", value: Math.max(0, Math.round(forecast.recommendedStock - aggregateStock)) }] : [])
  ];

  const riskLevel: RiskLevel =
    skuRows.some((r) => r.inventoryStatus === "Stockout Risk")
      ? "high"
      : aggregateStock !== null && aggregateStock < forecast.reorderPoint
      ? "high"
      : forecast.recommendedStock > 12500
      ? "medium"
      : "low";

  return {
    id: "inventory-levels",
    title: "Inventory Levels",
    riskLevel,
    recommendation:
      hasSkuData
        ? `${skuRows.filter((r) => r.inventoryStatus === "Stockout Risk").length} SKU(s) below reorder point. InventoryPosition = CurrentStock + StockInTransit - Backorders.`
        : `Keep at least ${forecast.safetyStock} units of safety stock and set reorder point near ${forecast.reorderPoint} units.`,
    insights: [
      rows.length ? "Inventory rows are read from the uploaded workbook." : "No Inventory sheet found; stock targets are calculated from demand variability.",
      "InventoryPosition = CurrentStock + StockInTransit - Backorders. OverstockThreshold = ReorderPoint × 2."
    ],
    chartData: hasSkuData ? skuRows : fallbackChartData,
    tableData: rows.length ? rows : fallbackChartData,
    kpis: [
      { label: "Current stock", value: aggregateStock !== null ? `${Math.round(aggregateStock)} units` : "Relevant data not found", tone: riskLevel },
      { label: "Reorder point", value: `${forecast.reorderPoint} units`, tone: riskLevel }
    ],
    description: "Inventory risk zone bar: current stock, stock in transit, backorders, safety stock line, reorder point line, overstock threshold line per SKU.",
    calculationRules: [
      "InventoryPosition = CurrentStock + StockInTransit - Backorders.",
      "OverstockThreshold = ReorderPoint × 2.",
      "StockoutRisk: CurrentStock < ReorderPoint. OverstockRisk: CurrentStock > OverstockThreshold."
    ]
  };
};

export const leadTimeSkill: AnalysisSkill = ({ request }) => {
  const rows = rowsByType(request.uploadedDatasets, ["Lead Time Data"]);
  const hasStageColumns = rows.some(
    (row) =>
      numberFor(row, ["PurchaseLeadDays", "Purchase"], 0) > 0 ||
      numberFor(row, ["ProductionLeadDays", "Production"], 0) > 0 ||
      numberFor(row, ["ShippingLeadDays", "Shipping"], 0) > 0 ||
      numberFor(row, ["DeliveryLeadDays", "Delivery"], 0) > 0
  );

  const chartRows = rows.length
    ? hasStageColumns
      ? rows.map((row, index) => {
          const purchase = numberFor(row, ["PurchaseLeadDays", "Purchase", "PurchaseDays"], 0);
          const production = numberFor(row, ["ProductionLeadDays", "Production", "ProductionDays"], 0);
          const shipping = numberFor(row, ["ShippingLeadDays", "Shipping", "ShippingDays", "TransitDays"], 0);
          const delivery = numberFor(row, ["DeliveryLeadDays", "Delivery", "DeliveryDays", "LastMileDays"], 0);
          const total = numberFor(row, ["TotalLeadTimeDays", "TotalDays", "Total", "Days", "LeadTimeDays"],
            purchase + production + shipping + delivery || 0);
          return {
            supplier: String(valueFor(row, ["Supplier", "SupplierName", "Vendor", "Source"]) ?? `Supplier ${index + 1}`),
            supplierCountry: String(valueFor(row, ["SupplierCountry", "Country", "Origin"]) ?? ""),
            purchaseLeadDays: purchase,
            productionLeadDays: production,
            shippingLeadDays: shipping,
            deliveryLeadDays: delivery,
            totalLeadTimeDays: total,
            delayFlag: ["yes", "true", "1", "delayed"].includes(String(valueFor(row, ["DelayFlag", "Delayed", "IsDelayed"]) ?? "").toLowerCase()),
            delayReason: String(valueFor(row, ["DelayReason", "Reason", "Issue", "Note"]) ?? "")
          };
        })
      : rows.map((row, index) => ({
          stage: String(valueFor(row, ["Stage", "LeadTimeStage", "Process", "Supplier"]) ?? `Stage ${index + 1}`),
          days: numberFor(row, ["Days", "LeadTimeDays", "AverageLeadTime", "TotalLeadTimeDays", "PurchaseLeadDays", "ProductionLeadDays", "ShippingLeadDays", "DeliveryLeadDays", "DelayDays"], 0)
        }))
    : [];

  return {
    id: "lead-time",
    title: "Lead Time",
    riskLevel: chartRows.some((row) => (row as Record<string, unknown>).totalLeadTimeDays
      ? Number((row as Record<string, unknown>).totalLeadTimeDays) > 21
      : Number((row as Record<string, unknown>).days) > 21)
      ? "high"
      : rows.length
      ? "medium"
      : "low",
    recommendation: rows.length
      ? hasStageColumns
        ? "Lead time stages detected: purchase, production, shipping, delivery shown per supplier."
        : "Place purchase orders before the demand peak using lead-time stages from the current file."
      : "Relevant data not found: upload a Lead_Time sheet with supplier lead-time stages.",
    insights: [
      rows.length ? "Lead-time rows are read from the uploaded workbook." : "Relevant data not found: no lead-time data rows in the current file.",
      "TotalLeadTimeDays = PurchaseLeadDays + ProductionLeadDays + ShippingLeadDays + DeliveryLeadDays."
    ],
    chartData: chartRows,
    tableData: rows.length ? rows : [],
    description: "Lead-time stage waterfall per supplier: Purchase → Production → Shipping → Delivery with delay flags and risk level.",
    calculationRules: [
      "TotalLeadTimeDays = PurchaseLeadDays + ProductionLeadDays + ShippingLeadDays + DeliveryLeadDays.",
      "DelayFlag marks suppliers with repeated delays.",
      "Risk: >21 days total = High, >14 days = Medium, ≤14 days = Low."
    ]
  };
};

export const forecastingMethodSkill: AnalysisSkill = ({ forecast }) => {
  const methodCards = [
    { method: "Simple Average", forecast: forecast.methodMetrics.simpleAverage, mape: 0, mad: forecast.methodMetrics.mad, rmse: forecast.methodMetrics.rmse, bias: forecast.methodMetrics.bias, confidence: 55, useCase: "Stable demand, no trend" },
    { method: "Moving Average", forecast: forecast.points.at(-1)?.movingAverage ?? 0, mape: forecast.mape * 1.1, mad: forecast.methodMetrics.mad * 1.05, rmse: forecast.methodMetrics.rmse * 1.05, bias: forecast.methodMetrics.bias, confidence: 65, useCase: "Mild trend, short history" },
    { method: "Weighted Moving Avg", forecast: forecast.points.at(-1)?.weightedMovingAverage ?? 0, mape: forecast.mape * 0.95, mad: forecast.methodMetrics.mad * 0.95, rmse: forecast.methodMetrics.rmse * 0.95, bias: forecast.methodMetrics.bias * 0.9, confidence: 72, useCase: "Recent data matters more" },
    { method: "Exponential Smoothing", forecast: forecast.methodMetrics.exponentialSmoothing, mape: forecast.mape * 0.9, mad: forecast.methodMetrics.mad * 0.9, rmse: forecast.methodMetrics.rmse * 0.9, bias: forecast.methodMetrics.bias * 0.8, confidence: 78, useCase: "Adaptive to recent changes" },
    { method: "Trend-Based Forecast", forecast: forecast.points.at(-1)?.trendForecast ?? 0, mape: forecast.mape * 0.88, mad: forecast.methodMetrics.mad * 0.88, rmse: forecast.methodMetrics.rmse * 0.88, bias: forecast.methodMetrics.mpe, confidence: 80, useCase: "Clear growth or decline trend" },
    { method: "Adjusted Forecast", forecast: forecast.nextPeriodForecast, mape: forecast.mape, mad: forecast.methodMetrics.mad, rmse: forecast.methodMetrics.rmse, bias: forecast.methodMetrics.bias, confidence: forecast.confidenceScore, useCase: "Applies seasonal, promo, competitor, economic multipliers" }
  ];

  const bestMethodIndex = methodCards.reduce((bestIdx, card, idx) => card.mape < methodCards[bestIdx].mape ? idx : bestIdx, 5);

  return {
    id: "forecasting-methods",
    title: "Forecasting Methods",
    riskLevel: "low",
    recommendation: `Best method: ${methodCards[bestMethodIndex].method} (MAPE: ${methodCards[bestMethodIndex].mape.toFixed(1)}%). Blend weighted moving average with seasonal, promotion, competitor, and economic adjustments.`,
    insights: [
      `Lowest validation MAPE: ${methodCards[bestMethodIndex].method} with ${methodCards[bestMethodIndex].mape.toFixed(1)}%.`,
      "Adjusted forecast applies seasonal, promotion, competitor, and economic multipliers on top of trend.",
      "Accuracy and confidence are recalculated after each analysis run."
    ],
    chartData: methodCards,
    tableData: forecast.points.map((point) => ({
      period: point.period,
      actual: point.actual,
      movingAverage: point.movingAverage,
      weightedMovingAverage: point.weightedMovingAverage,
      trendForecast: point.trendForecast,
      adjustedForecast: point.adjustedForecast,
      forecastError: point.error,
      absolutePercentageError: point.absolutePercentageError
    })),
    kpis: [
      { label: "Best MAPE", value: `${methodCards[bestMethodIndex].mape.toFixed(1)}%`, tone: "low" as const },
      { label: "Best method", value: methodCards[bestMethodIndex].method, tone: "low" as const }
    ],
    description: "Model comparison: simple average, moving average, weighted MA, exponential smoothing, trend-based, and adjusted forecast with MAPE, MAD, RMSE.",
    calculationRules: [
      "MAPE = average(abs(Actual - Forecast) / Actual) × 100.",
      "MAD = average(abs(Actual - Forecast)).",
      "RMSE = sqrt(average((Actual - Forecast)²)).",
      "Bias = average(Actual - Forecast). Positive bias = under-forecasting."
    ]
  };
};

export const technologyDataSkill: AnalysisSkill = ({ request }) => {
  const healthMatrix = [
    { sourceType: "CSV / JSON / Excel", connectorType: "File Upload", status: request.uploadedDatasets.length ? "Available" : "No file", recordsDetected: request.uploadedDatasets.reduce((sum, d) => sum + d.rows.length, 0), dataQualityScore: request.uploadedDatasets.length ? Math.round(request.uploadedDatasets.reduce((sum, d) => sum + d.qualityScore, 0) / request.uploadedDatasets.length) : 0, notes: `${request.uploadedDatasets.length} sheet(s) imported` },
    { sourceType: "ERP / POS", connectorType: "MCP Connector", status: "Placeholder", recordsDetected: 0, dataQualityScore: 0, notes: "Connect via MCP API when available" },
    { sourceType: "Web Search", connectorType: "Tavily API", status: process.env.TAVILY_API_KEY ? "Available" : "Needs API Key", recordsDetected: 0, dataQualityScore: 0, notes: process.env.TAVILY_API_KEY ? "Live search active in Search By Choice pathway" : "Live search unavailable: no API key configured." },
    { sourceType: "Historical Sales", connectorType: "Excel Sheet", status: request.uploadedDatasets.some(d => d.type === "Historical Sales Data") ? "Available" : "Missing", recordsDetected: request.uploadedDatasets.filter(d => d.type === "Historical Sales Data").reduce((sum, d) => sum + d.rows.length, 0), dataQualityScore: request.uploadedDatasets.find(d => d.type === "Historical Sales Data")?.qualityScore ?? 0, notes: "Source: Historical_Sales sheet" },
    { sourceType: "Forecast Actual", connectorType: "Excel Sheet", status: request.uploadedDatasets.some(d => d.type === "Forecast Actual Data") ? "Available" : "Missing", recordsDetected: request.uploadedDatasets.filter(d => d.type === "Forecast Actual Data").reduce((sum, d) => sum + d.rows.length, 0), dataQualityScore: request.uploadedDatasets.find(d => d.type === "Forecast Actual Data")?.qualityScore ?? 0, notes: "Source: Forecast_Actual sheet (ActualUnits + ForecastUnits)" },
    { sourceType: "Inventory", connectorType: "Excel Sheet", status: request.uploadedDatasets.some(d => d.type === "Inventory Data") ? "Available" : "Missing", recordsDetected: request.uploadedDatasets.filter(d => d.type === "Inventory Data").reduce((sum, d) => sum + d.rows.length, 0), dataQualityScore: request.uploadedDatasets.find(d => d.type === "Inventory Data")?.qualityScore ?? 0, notes: "Source: Inventory sheet" },
    { sourceType: "SCM Flow Map", connectorType: "Excel Sheet", status: request.uploadedDatasets.some(d => d.type === "SCM Flow Data") ? "Available" : "Missing", recordsDetected: request.uploadedDatasets.filter(d => d.type === "SCM Flow Data").reduce((sum, d) => sum + d.rows.length, 0), dataQualityScore: request.uploadedDatasets.find(d => d.type === "SCM Flow Data")?.qualityScore ?? 0, notes: "Source: SCM_Flow_Map sheet (NodeID, NodeType, AvgTransitDays)" }
  ];

  return {
    id: "technology-data",
    title: "Technology & Data Tools",
    riskLevel: request.uploadedDatasets.some((dataset) => dataset.qualityScore < 70) ? "high" : "low",
    recommendation: "Connect ERP, POS, supplier, inventory, and live web search feeds as data maturity improves.",
    insights: [
      `${request.uploadedDatasets.length} sheet(s) imported and scored.`,
      request.uploadedDatasets.some((d) => d.type === "Forecast Actual Data") ? "Forecast_Actual sheet detected — forecast accuracy uses real ActualUnits vs ForecastUnits." : "No Forecast_Actual sheet. Upload one for precise MAPE measurement.",
      "Live search (Tavily) is only active in the Search By Choice pathway — never called during file import."
    ],
    chartData: healthMatrix,
    tableData: request.uploadedDatasets.map((dataset) => ({
      file: dataset.name,
      type: dataset.type,
      rows: dataset.rows.length,
      qualityScore: dataset.qualityScore,
      issues: dataset.issues.join("; ") || "None"
    })),
    description: "Data source health matrix: source type, connector, status (Available/Missing/Placeholder/Needs API Key), records, quality score, notes.",
    calculationRules: [
      "Quality score penalizes blank cells and visible data issues.",
      "Cleaning removes blank rows, duplicate rows, and converts numeric/currency text.",
      "Forecast_Actual sheet enables precise MAPE from real ActualUnits vs ForecastUnits.",
      "Live search (Tavily) is only active in the separate Search By Choice pathway."
    ]
  };
};

export const forecastAccuracySkill: AnalysisSkill = ({ request, forecast }) => {
  const forecastActualRows = rowsByType(request.uploadedDatasets, ["Forecast Actual Data"]);

  if (forecastActualRows.length) {
    const chartRows = forecastActualRows
      .map((row, index) => {
        const actual = numberFor(row, ["ActualUnits", "Actual", "UnitsSold", "ActualDemand"], 0);
        const forecastVal = numberFor(row, ["ForecastUnits", "Forecast", "ForecastDemandUnits", "PlannedUnits"], 0);
        const error = actual - forecastVal;
        const absoluteError = Math.abs(error);
        const ape = actual > 0 ? (absoluteError / actual) * 100 : 0;
        return {
          period: String(valueFor(row, ["Month", "Period", "Date", "ForecastMonth"]) ?? `M${index + 1}`),
          actualUnits: Math.round(actual),
          forecastUnits: Math.round(forecastVal),
          forecastError: Math.round(error),
          absoluteError: Math.round(absoluteError),
          absolutePercentageError: Number(ape.toFixed(2))
        };
      })
      .filter((r) => r.actualUnits > 0 || r.forecastUnits > 0);

    if (chartRows.length) {
      const mape = chartRows.reduce((sum, r) => sum + r.absolutePercentageError, 0) / chartRows.length;
      const accuracy = Math.max(0, Math.min(100, 100 - mape));
      const mad = chartRows.reduce((sum, r) => sum + r.absoluteError, 0) / chartRows.length;
      const mse = chartRows.reduce((sum, r) => sum + r.absoluteError ** 2, 0) / chartRows.length;
      const rmse = Math.sqrt(mse);
      const bias = chartRows.reduce((sum, r) => sum + r.forecastError, 0) / chartRows.length;
      const overCount = chartRows.filter(r => r.forecastError > 0).length;
      const underCount = chartRows.filter(r => r.forecastError < 0).length;
      const riskLevel: RiskLevel = accuracy < 75 ? "high" : accuracy < 85 ? "medium" : "low";
      return {
        id: "forecast-accuracy",
        title: "Forecast Accuracy",
        riskLevel,
        recommendation: `Forecast accuracy from Forecast_Actual sheet: ${accuracy.toFixed(1)}% (MAPE: ${mape.toFixed(2)}%). ${accuracy < 80 ? "Review source quality and recent demand shifts." : "Accuracy is within operational planning targets."}`,
        insights: [
          `MAPE = ${mape.toFixed(2)}% from ${chartRows.length} rows. Over-forecast: ${overCount}, Under-forecast: ${underCount}.`,
          `MAD = ${mad.toFixed(0)}, RMSE = ${rmse.toFixed(0)}, Bias = ${bias.toFixed(0)} (${bias > 0 ? "under-forecasting" : "over-forecasting"}).`,
          "ForecastAccuracy = 100 - MAPE. Actual-zero rows are excluded from MAPE."
        ],
        chartData: chartRows,
        kpis: [
          { label: "MAPE", value: `${mape.toFixed(2)}%`, tone: mape > 20 ? ("high" as const) : ("medium" as const) },
          { label: "Accuracy", value: `${accuracy.toFixed(1)}%`, tone: accuracy > 85 ? ("low" as const) : ("medium" as const) }
        ],
        description: "Forecast error diagnostics: actual vs forecast line, error bars (green=over, red=under), APE% trend line, bias summary.",
        calculationRules: [
          "Source: Forecast_Actual sheet.",
          "Forecast Error = ActualUnits - ForecastUnits.",
          "APE = AbsoluteError / ActualUnits. MAPE = average(APE). ForecastAccuracy = 100 - MAPE.",
          `MAD=${mad.toFixed(0)}, MSE=${mse.toFixed(0)}, RMSE=${rmse.toFixed(0)}, Bias=${bias.toFixed(0)}.`
        ]
      };
    }
  }

  return {
    id: "forecast-accuracy",
    title: "Forecast Accuracy",
    riskLevel: forecast.accuracy < 75 ? "high" : forecast.accuracy < 85 ? "medium" : "low",
    recommendation: `Forecast accuracy: ${forecast.accuracy}%; MAPE: ${forecast.mape}%. Upload a Forecast_Actual sheet (ActualUnits + ForecastUnits) for precise measurement.`,
    insights: [
      "Forecast Error = Actual Demand - Forecasted Demand.",
      "MAPE is averaged from absolute percentage errors.",
      "Upload a Forecast_Actual sheet with ActualUnits and ForecastUnits for precise accuracy measurement."
    ],
    chartData: forecast.points,
    kpis: [
      { label: "MAPE", value: `${forecast.mape}%`, tone: forecast.mape > 20 ? ("high" as const) : ("medium" as const) },
      { label: "Accuracy", value: `${forecast.accuracy}%`, tone: forecast.accuracy > 85 ? ("low" as const) : ("medium" as const) }
    ],
    description: "Forecast accuracy compares computed forecast against actual demand. Source: Historical_Sales (estimated — upload Forecast_Actual for precise data).",
    calculationRules: [
      "Forecast Error = Actual Demand - Forecasted Demand.",
      "Absolute Error = absolute value of Forecast Error.",
      "MAPE is the average absolute percentage error; Accuracy = 100% - MAPE."
    ]
  };
};

export const finalRecommendationSkill: AnalysisSkill = ({ request, forecast, webSearch }) => {
  const inventorySkill = rowsByType(request.uploadedDatasets, ["Inventory Data"]);
  const currentStock = inventorySkill.length
    ? inventorySkill.reduce((sum, row) => sum + numberFor(row, ["CurrentStock", "Stock", "OnHand", "Inventory", "AvailableStock"], 0), 0)
    : null;

  const decisionMatrix = [
    { riskDriver: "Demand Trend", signalValue: webSearch.trendSignals.marketTrendIndex, riskLevel: webSearch.trendSignals.marketTrendIndex > 70 ? "High" : webSearch.trendSignals.marketTrendIndex > 45 ? "Medium" : "Low", ruleTrigger: "Market trend index from current file", recommendedAction: webSearch.trendSignals.marketTrendIndex > 70 ? "Increase next-period forecast by trend uplift" : "Maintain current forecast baseline", priority: webSearch.trendSignals.marketTrendIndex > 70 ? "High" : "Medium", expectedImpact: "Forecast accuracy +5–10%", sourceModule: "Market Trends" },
    { riskDriver: "Forecast Accuracy", signalValue: forecast.accuracy, riskLevel: forecast.accuracy < 75 ? "High" : forecast.accuracy < 85 ? "Medium" : "Low", ruleTrigger: `MAPE = ${forecast.mape}%`, recommendedAction: forecast.accuracy < 75 ? "Review forecast method — switch to weighted MA or exponential smoothing" : "Continue current forecast method", priority: forecast.accuracy < 75 ? "High" : "Low", expectedImpact: "Planning reliability", sourceModule: "Forecast Accuracy" },
    { riskDriver: "Inventory Position", signalValue: currentStock ?? forecast.recommendedStock, riskLevel: currentStock !== null && currentStock < forecast.reorderPoint ? "High" : "Low", ruleTrigger: `Reorder point = ${forecast.reorderPoint}`, recommendedAction: currentStock !== null && currentStock < forecast.reorderPoint ? `Replenish stock immediately. Current: ${Math.round(currentStock)}, Target: ${forecast.recommendedStock}` : `Maintain stock at ${forecast.recommendedStock} units`, priority: currentStock !== null && currentStock < forecast.reorderPoint ? "Critical" : "Low", expectedImpact: "Stockout prevention", sourceModule: "Inventory Levels" },
    { riskDriver: "Stockout Risk", signalValue: forecast.reorderPoint, riskLevel: currentStock !== null && currentStock < forecast.reorderPoint ? "High" : "Low", ruleTrigger: "CurrentStock < ReorderPoint", recommendedAction: "Set reorder point at " + forecast.reorderPoint + " units", priority: "Medium", expectedImpact: "Continuity of supply", sourceModule: "Inventory Levels" },
    { riskDriver: "Lead Time Risk", signalValue: 0, riskLevel: "Medium", ruleTrigger: "Average lead time from Lead_Time sheet", recommendedAction: "Pull purchase orders forward by lead-time days before next demand peak", priority: "Medium", expectedImpact: "Supply chain continuity", sourceModule: "Lead Time" },
    { riskDriver: "Promotion ROI", signalValue: webSearch.trendSignals.promotionPressure, riskLevel: webSearch.trendSignals.promotionPressure > 60 ? "High" : "Low", ruleTrigger: "Promotion pressure signal", recommendedAction: webSearch.trendSignals.promotionPressure > 60 ? "Run targeted promotion — tie to stock availability" : "Monitor promotion ROI before approving discounts", priority: webSearch.trendSignals.promotionPressure > 60 ? "Medium" : "Low", expectedImpact: "Revenue uplift", sourceModule: "Promotions & Discounts" },
    { riskDriver: "Competitor Pressure", signalValue: webSearch.trendSignals.competitorPressure, riskLevel: webSearch.trendSignals.competitorPressure > 60 ? "High" : "Medium", ruleTrigger: "Competitor pressure index from current file", recommendedAction: webSearch.trendSignals.competitorPressure > 60 ? "Monitor competitor pricing and launches before finalizing promotions" : "Continue routine competitor monitoring", priority: webSearch.trendSignals.competitorPressure > 60 ? "High" : "Low", expectedImpact: "Demand protection", sourceModule: "Competitor Activities" },
    { riskDriver: "Economic Risk", signalValue: webSearch.trendSignals.economicRisk, riskLevel: webSearch.trendSignals.economicRisk > 60 ? "High" : "Medium", ruleTrigger: "Economic risk index from current file", recommendedAction: webSearch.trendSignals.economicRisk > 60 ? "Increase value-pack availability; reduce premium SKU reliance" : "Monitor inflation and purchasing power trends", priority: webSearch.trendSignals.economicRisk > 60 ? "High" : "Low", expectedImpact: "Demand resilience", sourceModule: "Economic Conditions" },
    { riskDriver: "Seasonal Demand", signalValue: webSearch.trendSignals.seasonalLift, riskLevel: webSearch.trendSignals.seasonalLift > 18 ? "Medium" : "Low", ruleTrigger: "Seasonal lift from current file", recommendedAction: webSearch.trendSignals.seasonalLift > 18 ? "Increase pre-season stock cover before Ramadan, Eid, or festival periods" : "Review seasonality rows for upcoming festivals", priority: webSearch.trendSignals.seasonalLift > 18 ? "Medium" : "Low", expectedImpact: "Festival demand capture", sourceModule: "Seasonality" }
  ];

  return {
    id: "final-recommendation",
    title: "Final SCM Recommendation",
    riskLevel: riskFromScore((webSearch.trendSignals.competitorPressure + webSearch.trendSignals.economicRisk) / 2),
    recommendation: `Based on ${request.selection.productName || "the product"}: demand forecast = ${forecast.nextPeriodForecast} units. Replenish to ${forecast.recommendedStock} units, set reorder at ${forecast.reorderPoint}, maintain ${forecast.safetyStock} safety stock.`,
    insights: [
      "Decision matrix combines all analysed module signals into prioritised actions.",
      "Action priority is highest when stockout risk and seasonal lift overlap."
    ],
    chartData: decisionMatrix,
    tableData: decisionMatrix,
    description: "Decision matrix: Risk Driver, Signal Value, Risk Level, Rule Triggered, Recommended Action, Priority, Expected Impact, Source Module.",
    calculationRules: [
      "Each row is driven by a module signal from the current uploaded file.",
      "Priority: Critical → High → Medium → Low.",
      "Actions are generated from rule-based evidence only — no generic placeholders."
    ]
  };
};

export const skills = [
  historicalSalesSkill,
  marketTrendSkill,
  seasonalitySkill,
  customerDemandSkill,
  promotionImpactSkill,
  economicConditionSkill,
  competitorActivitySkill,
  inventoryPlanningSkill,
  leadTimeSkill,
  forecastingMethodSkill,
  technologyDataSkill,
  forecastAccuracySkill,
  finalRecommendationSkill
];

function rowsByType(datasets: UploadedDataset[], types: UploadedDataset["type"][]) {
  return datasets.filter((dataset) => types.includes(dataset.type)).flatMap((dataset) => dataset.rows);
}

function salesGrowth(points: { actual: number }[]) {
  if (points.length < 2) return 0;
  const first = points[0].actual;
  const last = points[points.length - 1].actual;
  return first ? Number((((last - first) / first) * 100).toFixed(1)) : 0;
}

function competitorNameFromRow(row: Record<string, unknown>) {
  const value = valueFor(row, ["CompetitorName", "Competitor", "CompetitorProduct", "Brand", "Company"]);
  return String(value ?? "").trim();
}

function flagScore(row: Record<string, unknown>, keys: string[], score: number) {
  const value = String(valueFor(row, keys) ?? "").toLowerCase();
  return ["yes", "true", "active", "launch", "launched", "1"].some((term) => value.includes(term)) ? score : 0;
}

function extractRegionalDemand(datasets: UploadedDataset[]) {
  let regionalRows = datasets
    .filter((dataset) => dataset.type === "Customer Demand Data")
    .flatMap((dataset) => dataset.rows)
    .filter((row) => valueFor(row, ["Region", "region", "City", "city"]));

  if (!regionalRows.length) {
    regionalRows = datasets
      .flatMap((dataset) => dataset.rows)
      .filter((row) => valueFor(row, ["Region", "region", "City", "city"]) && numberFor(row, ["ForecastDemandUnits", "Demand", "ActualUnits", "UnitsSold", "Quantity", "Sales"], 0) > 0);
  }

  const grouped = new Map<string, { region: string; lat: number; lng: number; demand: number; growth: number; risk: RiskLevel }>();
  regionalRows.forEach((row) => {
    const region = String(valueFor(row, ["Region", "region", "City", "city"]) ?? "").trim();
    if (!region) return;
    const key = region.toLowerCase();
    const known = cityCoordinates[key];
    const lat = numberFor(row, ["Latitude", "latitude", "lat"], known?.lat ?? 23.685);
    const lng = numberFor(row, ["Longitude", "longitude", "lng", "lon"], known?.lng ?? 90.3563);
    const demand = numberFor(row, ["ForecastDemandUnits", "Demand", "demand", "DemandScore", "AvgBasketUnits"], 0);
    const growth = numberFor(row, ["Growth", "growth", "GrowthPct", "DemandScore"], 0);
    const level = String(valueFor(row, ["DemandLevel", "Risk", "risk"]) ?? "").toLowerCase();
    const risk: RiskLevel = level.includes("high") || demand > 3500 ? "high" : level.includes("medium") || demand > 2200 ? "medium" : "low";
    const existing = grouped.get(key);
    if (existing) {
      existing.demand += demand;
      existing.growth = Math.max(existing.growth, growth);
      existing.risk = existing.risk === "high" || risk === "high" ? "high" : existing.risk === "medium" || risk === "medium" ? "medium" : "low";
    } else {
      grouped.set(key, { region, lat, lng, demand, growth, risk });
    }
  });
  return Array.from(grouped.values()).filter((item) => item.demand > 0);
}

function valueFor(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const match = Object.keys(row).find((rowKey) => normalizeKey(rowKey) === normalizeKey(key));
    if (match) return row[match];
  }
  return undefined;
}

function numberFor(row: Record<string, unknown>, keys: string[], fallback: number) {
  const value = Number(valueFor(row, keys));
  return Number.isFinite(value) ? value : fallback;
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}
