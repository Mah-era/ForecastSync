# Project Report

## Project Summary

ForecastSync is a browser-based SCM business intelligence application for demand analysis, file import, web market research, forecasting, inventory planning, risk alerts, and exportable decision reports.

The app is intentionally usable without authentication. It opens directly to the planning workspace and supports uploaded business data plus live Tavily market research.

The final application name is ForecastSync.

## Business Workflow

1. Upload one or more CSV, Excel, or JSON files.
2. Classify each file as sales, inventory, promotion, competitor, economic, market trend, seasonality, lead time, POS/ERP, or expert note data.
3. Select product, category, brand, and region.
4. Optionally run product/brand online search as a separate Tavily-powered action.
5. Choose input factors to include in analysis.
6. Choose output sections to show in the dashboard and report.
7. Run analysis.
8. Review forecast KPIs, real module charts from the current uploaded data, maps, risk alerts, recommendations, and source summaries.
9. Export PDF, Excel, or CSV.

The import and online-search paths are intentionally separate. Importing and checking files never calls Tavily. Search-by-choice never uses uploaded files.

The navigation is route-based after the home page. `/` is the choice screen, `/import-data` is the file workflow, `/search-by-choice` is the web-search workflow, `/search-dashboard` is the interpreted search output, and detailed SCM module pages use module slugs such as `/historical-sales-data`, `/market-trends`, and `/forecast-accuracy`.

Every new file import clears the previous in-memory datasets, analysis result, dashboard card state, module filters, product metadata, expert notes, and search result before parsing the new upload. Excel workbooks are imported sheet-by-sheet, including unmatched sheets, so analysis receives the full current workbook rather than only recognized templates.

To prevent placeholder or stale-file analysis, unmatched workbook sheets are classified by sheet-name heuristics instead of defaulting to historical sales, product/category/brand/region values are derived from the current workbook when available, and the forecasting extractor chooses rows that contain real demand fields such as `ActualUnits`, `UnitsSold`, `Demand`, `Sales`, or `Quantity`.

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

- KPI cards
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
- Module-level charts and tables
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

## Recommended Next Steps

1. Add Prisma schema for saved analyses and uploaded file metadata.
2. Add server-side file storage for large imports.
3. Add a provider switch for Tavily, Bing, SerpAPI, and Google CSE.
4. Add dedicated E2E tests for upload, analysis, filtering, and export.
5. Connect ERP/POS/inventory MCP servers when available.
