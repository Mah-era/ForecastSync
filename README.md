# ForecastSync

Advanced SCM demand planning web app built with Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI components, Recharts, Leaflet, TanStack Table, API routes, and modular analysis skills.

## Features

- Direct use with no login or role-based access.
- Clean, professional UI using Inter font, slate base with teal accent, and a dark animated landing hero.
- Product, category, brand, and region selection.
- **Per-product selector**: when an uploaded workbook contains multiple products, a product dropdown appears at the Import Data step so you can analyse one product at a time before running analysis.
- Separate product/brand online search action using Tavily.
- CSV, Excel, and JSON import with classification, preview, validation, and quality scoring.
- Excel import reads every workbook sheet, including unmatched sheets, so the full current file set is available to analysis.
- Unknown Excel sheets are classified by sheet-name heuristics instead of being treated as historical sales by default.
- Product, category, brand, and region are derived from the current uploaded workbook when matching fields exist.
- Excel/CSV/JSON data cleaning and correction for trimmed text, normalized Excel serial dates, currency/text numbers such as `৳850 BDT` and `741,300`, duplicate rows, blank rows, negative demand/returns, and outlier demand spikes.
- Downloadable import templates in `public/templates`.
- Checkbox-controlled input factors and output sections.
- Web search integration through Tavily when `TAVILY_API_KEY` is available.
- Search-by-choice source count control for 5, 10, 12, 15, or 20 web sources.
- Explicit "live search unavailable" status when no web search API key is configured.
- Moving average, weighted moving average, trend, seasonality, festival, promotion, competitor, economic, inventory, and lead-time forecast adjustments.
- Forecast Error, Absolute Error, MAPE, forecast accuracy, confidence score, safety stock, reorder point, and recommended stock.
- **9-KPI dashboard**: Forecast Demand, Accuracy, Confidence, Stockout Risk, Inventory, Lead Time, Promotion Pressure, Economic Risk, and Seasonal Demand — all driven from the current uploaded file.
- **15 module chart visuals**: each module renders a chart type matched to its data — Sankey flow (customer demand), bubble chart (promotion impact), event timeline (competitor activities), method comparison cards (forecasting methods), health matrix (technology & data tools), decision matrix (final recommendation), stacked bar/waterfall (inventory and lead time), radar, area, composed, scatter, and pie charts.
- Dashboard module cards use the current imported file analysis and render actual chart visuals with a staged wait screen when charts are expensive. Missing module-specific data displays `Relevant data not found` instead of demo data.
- Drag-and-drop dashboard card ordering with 1:1, 2:1, 1:2, and 16:4 card sizing.
- Hover detail buttons on dashboard and Forecast Methods cards showing interpretation and calculation rules.
- Clean URL navigation: `/` is the choice home, `/import-data` opens file analysis, `/search-by-choice` opens online search, and module pages use paths such as `/historical-sales-data`, `/inventory-levels`, and `/forecast-accuracy`.
- Tailored module filters use module-specific choices, draft controls, an Apply button, and a wait screen. Dropdown/text changes do not recalculate charts until Apply is clicked.
- Bangladesh regional demand map driven by uploaded regional/customer demand files, plus SCM supplier to customer flow map.
- Dedicated `/forecast-methods` module with model types, forecasting data patterns, quantitative techniques, error measurement, calculator, method comparison, and SCM interpretation.
- PDF, Excel, and CSV exports.
- MCP-ready connector registry for future ERP, POS, inventory, supplier, file, and web-search servers.

- live link: https://forecastsync.onrender.com

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Live Web Search

Create `.env.local`:

```bash
TAVILY_API_KEY=your_api_key_here
TAVILY_MCP_URL=your_tavily_mcp_url_here
```

Restart the dev server. If the key is missing or the API call fails, the app shows that live search is unavailable.

## Data Import

Supported files:

- `.csv`
- `.xlsx` / `.xls`
- `.json`

Recommended columns for historical sales:

- `period`
- `actual`
- `promotion`
- `festival`
- `inventory`
- `region`

Upload real files before running operational analysis. File import/checking does not call Tavily. Excel import reads all sheets in the uploaded workbook. If no historical file is present, forecast outputs remain empty instead of using placeholder demand data.

Uploading a new file set immediately clears the previous datasets, module filters, dashboard result, dashboard card order, product metadata, expert notes, and search result before parsing the new file. This prevents previous data from leaking into the next analysis.

If the workbook contains multiple products, a **Product Selection** card appears at the Import Data step. Choose one product before clicking **Run analysis**. All analysis and chart data is then filtered to that product only.

The **Run analysis** button is disabled until the current upload has finished and at least one dataset exists. If production import or analysis fails, the app displays the server status/error message instead of a generic failure.

## Dashboard Behavior

The central dashboard uses the exact analysis result produced from the current uploaded files. Forecast extraction selects rows with real demand columns such as `ActualUnits`, `UnitsSold`, `Demand`, `Sales`, or `Quantity`, so workbook info/scenario sheets are not used as demand history. Each module card renders real charts, KPIs, risk badges, source labels, row counts, and recommendation text. If required rows are missing for a module, ForecastSync shows `Relevant data not found` with source/row metadata instead of static placeholder data. Because chart rendering can be expensive with many Excel sheets, ForecastSync shows a processing overlay and mounts dashboard charts in stages.

Dashboard cards can be reordered with the drag handle and resized from the card size menu:

- `1:1`
- `2:1`
- `1:2`
- `16:4`

The Bangladesh Regional Demand Map reads uploaded regional demand rows when available. It recognizes common fields such as `Region`, `City`, `Latitude`, `Longitude`, `Demand`, `ForecastDemandUnits`, `Growth`, and `Risk`. If no region/city fields exist, it shows `Relevant data not found` rather than a demo marker. The SCM Flow Map recalculates from current-file lead time, inventory, reorder point, and customer demand data, and missing stages are explicitly labeled.

## Page Routes

ForecastSync has a choice-first route structure:

- `/`: home page with the two pathway choices.
- `/import-data`: import, clean, validate, preview, select product, select factors, and run file analysis.
- `/search-by-choice`: Tavily-backed product/category/brand search.
- `/search-dashboard`: interpreted online-search dashboard after search results exist.
- `/<module-name>`: detailed imported-analysis modules, for example `/market-trends`, `/customer-demand-patterns`, `/lead-time`, and `/final-scm-recommendation`.

Module routes share the current browser workspace state. If a module route is opened before analysis exists, the import controls stay available so a file can be uploaded and analysed.

## Forecast Methods

Open `/forecast-methods` for the detailed forecasting workbench. It includes:

- Forecasting Model Types
- Forecasting Data Patterns
- Quantitative Forecasting Techniques
- Forecast Error Measurement
- Interactive Forecast Calculator
- Visual Comparison Dashboard
- Final SCM Interpretation Panel

The page uses reusable components from `components/forecasting`, diagrams from `components/forecasting/diagrams`, and calculation logic from `lib/forecasting`.

## Architecture

- `app/`: Next.js routes and API endpoints.
- `components/dashboard`: dashboard tables and dashboard support UI.
- `components/charts`: Recharts visual components — 15 module chart types.
- `components/maps`: Leaflet regional demand map and SCM flow map.
- `lib/forecasting`: forecasting formulas and model logic.
- `lib/file-import`: CSV, Excel, and JSON parsers.
- `lib/web-search`: Tavily integration plus explicit unavailable status when live search cannot run.
- `lib/export`: PDF/Excel/CSV browser export helpers.
- `lib/mcp`: MCP-ready connector interfaces and config.
- `lib/skills`: separate SCM analysis skills/services.
- `types`: shared TypeScript data models.

## Skill Modules

- `historicalSalesSkill`
- `marketTrendSkill`
- `seasonalitySkill`
- `customerDemandSkill`
- `promotionImpactSkill`
- `economicConditionSkill`
- `competitorActivitySkill`
- `inventoryPlanningSkill`
- `leadTimeSkill`
- `forecastingMethodSkill`
- `technologyDataSkill`
- `forecastAccuracySkill`
- `finalRecommendationSkill`

Each skill accepts selected inputs, uploaded data and/or online search data, then returns structured insights, chart-ready data, recommendations, and risk level.

## Testing

This workspace includes `Test_Files/EXCEL/Demand Planning Forecasting Tests`, a 30-workbook fixture suite. File fixture testing is import/analysis-only and does not call Tavily:

```bash
npm run test:fixtures
```

Tavily search is tested separately:

```bash
npm run test:web-search
```

Also run:

```bash
npm run build
```

Latest verification completed:

- `npm run build` passed.
- `npm run test:fixtures` passed all 30 Excel fixture workbooks.
- Browser smoke passed for import analysis, dynamic Bangladesh map update from `DPF-22_Bangladesh_Regional_Demand_Map.xlsx`, source labels, tailored filter Apply behavior, wait screen completion, and console/page error checks.
