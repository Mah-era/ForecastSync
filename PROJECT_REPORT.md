# Project Report

## Project Summary

ForecastSync is a browser-based SCM business intelligence application for demand analysis, file import, web market research, forecasting, inventory planning, risk alerts, and exportable decision reports.

The app is intentionally usable without authentication. It opens directly to the planning workspace and supports uploaded business data plus live Tavily market research.

The final application name is ForecastSync.

## Business Workflow

1. Upload one or more CSV, Excel, or JSON files.
2. Classify each file as sales, inventory, promotion, competitor, economic, market trend, seasonality, lead time, POS/ERP, or expert note data.
3. If the workbook contains multiple products, select one product from the Product Selection card before continuing.
4. Select product, category, brand, and region.
5. Optionally run product/brand online search as a separate Tavily-powered action.
6. Choose input factors to include in analysis.
7. Choose output sections to show in the dashboard and report.
8. Run analysis.
9. Review 9 KPI cards, 15 module chart visuals, maps, risk alerts, recommendations, and source summaries.
10. Export PDF, Excel, or CSV.

The import and online-search paths are intentionally separate. Importing and checking files never calls Tavily. Search-by-choice never uses uploaded files.

The navigation is route-based after the home page. `/` is the choice screen, `/import-data` is the file workflow, `/search-by-choice` is the web-search workflow, `/search-dashboard` is the interpreted search output, and detailed SCM module pages use module slugs such as `/historical-sales-data`, `/market-trends`, and `/forecast-accuracy`.

Every new file import clears the previous in-memory datasets, analysis result, dashboard card state, module filters, product metadata, expert notes, and search result before parsing the new upload. Excel workbooks are imported sheet-by-sheet, including unmatched sheets, so analysis receives the full current workbook rather than only recognized templates.

To prevent placeholder or stale-file analysis, unmatched workbook sheets are classified by sheet-name heuristics instead of defaulting to historical sales, product/category/brand/region values are derived from the current workbook when available, and the forecasting extractor chooses rows that contain real demand fields such as `ActualUnits`, `UnitsSold`, `Demand`, `Sales`, or `Quantity`.

## UI Design System

The frontend was redesigned to a Clean & Professional aesthetic using:

- **Inter** (Google Fonts) as the primary typeface, loaded via `next/font/google` with a CSS variable `--font-inter`.
- **Slate base + teal accent**: slate-50/100/200/400/500/700/900 used throughout, teal reserved for active states, highlights, icon containers, and selected elements.
- **Landing hero**: dark slate-900 panel with an animated rain effect (32 teal-tinted drops), animated cloud layers, and two pathway buttons that navigate directly using synchronous state updates.
- **Sidebar**: dot-active style — active module shows `bg-teal-50 text-teal-800` with a teal dot; inactive shows `text-slate-500` with a slate dot. Sticky, scrollable on large screens only.
- **Header**: `sticky top-0 z-30` with `backdrop-blur-sm` and `bg-white/95`.
- **KPI cards**: `text-3xl font-bold` value, uppercase tracking label, teal icon container `bg-teal-50 p-3 text-teal-700`, and source sheet footnote.
- **Module cards**: `rounded-xl border border-border bg-card shadow-sm` with flat headers — gradient headers removed.
- **Badges**: `text-[11px]`, `px-2 py-0.5`; neutral uses `bg-slate-100 text-slate-600`; risk tones use `riskClass` with border.
- **Buttons**: `rounded-lg`; primary `bg-primary hover:bg-teal-800 shadow-sm`; secondary uses slate-200 border.

## Multi-Product Filtering

When an uploaded file contains more than one distinct product value (scanned from `ProductName`, `Product`, `Item`, `SKU`, `ItemCode`, or `Material` columns), ForecastSync:

1. Extracts unique product options after the brand filter is applied.
2. Shows a **Product Selection** card on the Import Data page (hidden when only one product or no product column is detected).
3. Filters all datasets to matching rows for the chosen product. Sheets with no product column are kept in full so standalone lead-time or scenario sheets are not dropped.
4. Passes the filtered datasets and the selected `productName` into the analysis request.

This ensures that multi-product workbooks (e.g., a single Excel file covering Mango Juice, Apple Juice, and Guava Juice) can be analysed one product at a time without re-uploading.

## Forecasting Logic

Implemented formulas include:

- Forecast Error = Actual Demand - Forecasted Demand
- Absolute Error = absolute value of Forecast Error
- MAPE = average absolute percentage error
- Forecast Accuracy = 100% - MAPE
- Safety Stock = service level factor x demand variability x square root of lead time
- Reorder Point = average demand during lead time + safety stock

The adjusted forecast blends:

- Moving average
- Weighted moving average
- Trend-based forecast
- Seasonal/festival adjustment
- Promotion adjustment
- Competitor impact adjustment
- Economic impact adjustment
- Inventory and lead-time planning outputs
- AI/ML forecasting placeholder in the forecasting method skill

The dedicated `/forecast-methods` page expands the forecasting layer into a full workbench:

- Forecasting Model Types: Time Series, Causal / Associative, Qualitative, and Delphi.
- Forecasting Data Patterns: Trend, Seasonality, Cyclical Variation, Irregular / Random Variation, Level / Horizontal Pattern, and Noise.
- Quantitative Techniques: Simple Average, Moving Average, Weighted Moving Average, and Exponential Smoothing.
- Error Measurement: Forecast Error / Bias, MAD, MSE, RMSE, MPE, MAPE, and Forecast Accuracy.
- Interactive calculator, visual method comparison, automatic best-method selection, and final SCM interpretation.

## Module Chart Visuals

All 15 dashboard module cards render chart types matched to their data:

| Module | Chart Type |
|---|---|
| Customer Demand Patterns | Sankey flow (segment → channel → region) or regional PieChart |
| Promotions & Discounts | Bubble chart (actual vs expected uplift, bubble = budget) |
| Competitor Activities | Scrollable event timeline with colour-coded activity badges |
| Forecasting Methods | Method comparison cards; best model (lowest MAPE) highlighted in teal |
| Technology & Data Tools | Health matrix table with status badges and quality score bar |
| Final SCM Recommendation | Decision matrix table with risk-level and priority colour coding |
| Inventory Levels | Stacked bar per SKU (current stock + in-transit) |
| Lead Time | Stacked waterfall per supplier (purchase + production + shipping + delivery stages) |
| Historical Sales Data | Composed area + line chart |
| Market Trends | Area chart |
| Seasonality | Bar chart with seasonal index |
| Economic Conditions | Radar chart |
| Forecast Accuracy | Line + bar composed chart |
| SCM Flow Map | Leaflet interactive flow map |
| Bangladesh Demand Map | Leaflet regional choropleth with demand markers |

## KPI Dashboard

The dashboard shows 9 KPI cards, all driven from the current uploaded file:

1. Forecast Demand — total units forecast
2. Accuracy — forecast MAPE-derived accuracy %
3. Confidence — composite confidence score
4. Stockout Risk — stock vs reorder point signal
5. Inventory — current stock level
6. Lead Time — average lead time in days
7. Promotion Pressure — promotion pressure score /100
8. Economic Risk — economic risk score /100
9. Seasonal Demand — seasonal lift score /100

Each KPI card shows the source sheet name and row count used to calculate that metric.

## Online Research

The web search layer is separate from file import/checking. It uses Tavily when `TAVILY_API_KEY` is configured. Without an API key, the app reports that live search is unavailable.

Users can choose how many sources to request: 5, 10, 12, 15, or 20. The search dashboard interprets market trend, competitor pressure, economic risk, seasonal lift, and promotion pressure with hover-accessible calculation notes.

## MCP Readiness

The `lib/mcp` folder defines connector interfaces and a connector registry for future MCP server integration:

- Web search connector
- CSV connector
- Excel connector
- JSON connector
- POS connector placeholder
- ERP connector placeholder
- Inventory connector placeholder
- Supplier connector placeholder

## Dashboard Coverage

The app includes:

- 9 KPI cards driven from the current imported file
- Demand forecast summary
- Forecast accuracy score
- Current inventory and reorder guidance
- Stockout risk alerts
- Average lead time
- Promotion and competitor pressure signals
- Economic risk score
- Seasonal/festival demand signal
- Final SCM recommendation
- Bangladesh regional demand map
- SCM flow map
- 15 module chart visuals
- Source summary table
- PDF, Excel, and CSV export buttons

Dashboard module cards are drag-and-drop reorderable and support 1:1, 2:1, 1:2, and 16:4 sizing. Each card keeps the current uploaded-file analysis as its data source and renders actual charts rather than static placeholders. A wait overlay appears while the dashboard mounts chart-heavy sections.

The Bangladesh Regional Demand Map is data-driven. When uploaded workbooks contain region/city, demand, growth, risk, and optional latitude/longitude fields, the map recalculates marker size, ranking, top region, and regional bars from that file. If no regional rows exist in the current file, the map shows a current-file empty state instead of using reference placeholder regions.

The SCM Flow Map is also data-driven. It recalculates supplier lead-time, warehouse stock/target, retailer reorder point, and customer region/forecast signals from the active analysis result.

The Risk Alerts & Action Plan panel summarizes alert count, high/critical alert count, action count, risk messages, and ordered action priorities. Alerts now use current-file forecast accuracy, file-derived competitor/economic/seasonal/promotion pressure, inventory stock versus reorder point, and lead-time risk.

## Performance and Stability Work

The freezing issue was addressed by removing the main sources of unnecessary work:

- Hidden PDF export charts are mounted only while PDF export is running.
- Dashboard cards render actual charts in staged batches after a visible processing overlay appears.
- Recharts animation is disabled across the heavy chart surfaces.
- Dragging starts from the card drag handle only, so normal card buttons and checkboxes do not trigger drag behavior.
- Filter changes use an explicit Apply step with a short wait state.
- Tailored module filters now edit draft values first; the real analysed data, chart, and table update only after Apply is clicked.
- A stable default module-filter object and guarded draft synchronization prevent the previous render-loop freeze.
- Filter Apply starts the wait screen first and schedules chart/table recalculation after the browser has painted.
- Module route changes use the same wait overlay pattern so chart-heavy pages have time to render.
- Production API routes run explicitly on the Node.js runtime, return JSON error messages, and reject analysis when no imported dataset is present.
- The **Run analysis** action is disabled until a current import has completed successfully.
- The global visual system now enforces current-workbook-only analysis, source sheet labels, row counts, data-quality warning banners, apply-based module filtering, and `Relevant data not found` empty states instead of demo/fallback rows.
- CSV, JSON, and Excel imports share the same cleaning pipeline for currency/text numbers, comma-separated values, Excel serial dates, duplicate rows, blank rows, negative demand/returns, and outlier demand spikes.
- Landing page pathway buttons use direct synchronous state updates (no setTimeout/rAF wrapper) so navigation is immediate and reliable.

## Current Limitations

- Local persistence is in browser state for this version; the structure is ready for Prisma + SQLite/PostgreSQL.
- Live web search currently supports Tavily; SerpAPI, Bing, or Google CSE can be added behind the same connector interface.
- POS, ERP, supplier, and inventory integrations are placeholders by design.
- PDF export captures the dashboard/report DOM as a visual PDF.

## Verification Summary

Completed checks:

- Production build passed with `npm run build`.
- Excel fixture suite passed all 30 workbooks with `npm run test:fixtures`.
- Browser smoke confirmed the DPF-01 Excel upload, import completion, product derivation from the workbook, Run analysis, dashboard navigation, forecast visibility, and clean `/api/import` + `/api/analyze` 200 responses.
- Browser smoke confirmed a full Excel workbook updates forecast KPIs, Bangladesh Regional Demand Map, SCM Flow Map, Risk Alerts & Action Plan, and module charts from the current upload.
- Missing module data now shows `Relevant data not found` with a source/row-count reason instead of current-file fallback rows or static placeholders.
- Tavily integration test passed with `npm run test:web-search`.
- Browser smoke confirmed: import analysis loads, dashboard cards render real charts from current analysis data, module filters expose tailored choices and apply without freezing, replacement imports remove stale filenames/results, hover/source details are present, and the Bangladesh map changes based on the uploaded regional-demand workbook.
- Multi-product file correctly shows the product selector, filters datasets per selected product, and runs analysis on the selected product only.
- Pathway buttons on the landing page navigate correctly without delay.

## Recommended Next Steps

1. Add Prisma schema for saved analyses and uploaded file metadata.
2. Add server-side file storage for large imports.
3. Add a provider switch for Tavily, Bing, SerpAPI, and Google CSE.
4. Add dedicated E2E tests for upload, analysis, filtering, and export.
5. Connect ERP/POS/inventory MCP servers when available.
