# ForecastSync Frontend User Guide

## Start

Open the app and use it directly. No login is required.

The landing page has an animated dark hero with a rain effect, the ForecastSync logo, and two large pathway buttons. Click a button to enter the chosen workflow.

## Choose a Pathway

The first screen has two separate options:

- **Import File & Analyse**: upload files, clean/validate them, select a product (if multiple are detected), run forecasting, and export reports.
- **Search By Choice**: search a selected product/category/brand online with Tavily and create a separate search dashboard.

The two pathways do not mix data unless you intentionally switch and run a new action.

Useful paths:

- `/`: home page with both pathway choices.
- `/import-data`: file import and analysis setup.
- `/search-by-choice`: online product/category/brand search.
- `/search-dashboard`: web-search dashboard after search results exist.
- Module paths such as `/historical-sales-data`, `/inventory-levels`, `/lead-time`, and `/final-scm-recommendation`.

## Import Data

1. Choose the file type classification from the dropdown.
2. Upload CSV, Excel, or JSON files.
3. Wait for the processing message to finish.
4. Review the uploaded file cards, data-cleaning summary, validation health, and data preview.
5. Use the template links if you need import formats.

You can upload multiple files. For operational results, upload historical demand or sales data before running analysis.

Import includes data correction for blank rows, duplicate rows, numeric values stored as text, currency strings such as `৳850 BDT`, comma-separated numbers such as `741,300`, Excel serial dates, negative demand/return rows, outlier spikes, and extra spaces in text fields.

Excel workbooks are imported across all sheets. Uploading a new file immediately replaces the previous workbook data and clears old analysis/filter state, product metadata, expert notes, and search output, so the next dashboard is based on the current file only.

When the workbook contains fields such as `Product`, `ProductName`, `Category`, `Brand`, `Region`, or a `Scenario_Info` sheet with `Field` and `Value` columns, ForecastSync fills the product/category/brand/region values from that uploaded file. It does not keep the previous product after a new import or after **Remove data**.

## Product Selection

When the uploaded file or workbook contains more than one product (detected from columns such as `ProductName`, `Product`, `Item`, `SKU`, or `Material`), a **Product Selection** card appears on the Import Data page. Use the teal-highlighted dropdown to choose one product. All subsequent analysis, charts, maps, and KPIs are filtered to that product only.

If the file contains a single product, or no product column is detected, the product selector is hidden and all rows are used.

## Brand Filter

If the imported file contains a brand-style column such as `Brand`, `ProductBrand`, `manufacturer`, or `company`, use the Brand Filter on the Import Data page before running analysis.

Uploading a new file set replaces the previous data. Use **Remove data** when you want to clear the current scenario without uploading another file.

## Select Analysis Inputs

Use Input Factors checkboxes to decide what the analysis should include. Unchecked factors are excluded from the analysis request.

Important options include:

- Historical Sales Data
- Market Trends
- Seasonality
- Promotions & Discounts
- Economic Conditions
- Competitor Activities
- Inventory Levels
- Lead Time
- Uploaded File Data
- Manual Expert Opinion

## Select Outputs

Use Output Results checkboxes to decide what should appear in the dashboard and exports.

Important options include:

- Demand Forecast
- Sales Trend Analysis
- Inventory Requirement
- Stockout Risk
- Forecast Accuracy Report
- Final SCM Recommendation
- Risk Alerts
- Action Plan
- PDF Report
- Excel Report
- CSV Export

## Run Analysis

Click **Run analysis**. The dashboard will show:

- **9 KPI cards**: Forecast Demand, Accuracy, Confidence, Stockout Risk, Inventory, Lead Time, Promotion Pressure, Economic Risk, and Seasonal Demand — each card shows the source sheet and row count used
- Forecast chart
- Reorderable and resizable module cards with real chart visuals
- Bangladesh demand map based on uploaded regional data when available
- Supply chain flow map
- Risk alerts
- Action plan
- Web search status and sources

If a live search API key is not configured, the web source panel clearly shows that live search is unavailable.

Large workbooks and chart-heavy dashboards may show a wait screen while the app renders. Wait for the overlay to disappear before clicking the next action.

The **Run analysis** button stays disabled until import is complete and at least one current dataset exists. If import or analysis fails on the server, the red error message shows the returned status or server message so you can see what needs fixing.

## Dashboard Cards

Each module card can be moved and resized:

- Drag the handle at the top-left of a card to reorder it.
- Use the **Size** menu to choose `1:1`, `2:1`, `1:2`, or `16:4`.
- Hover the info button in the card corner to see what the card means and which calculation rules were used.

The dashboard cards use the current uploaded-file analysis. They are not static examples. Each card includes a source label and row count, and the corner info button explains the calculation rules.

Module chart types matched to each skill:

- **Customer Demand Patterns** — Sankey flow diagram (segment → channel → region) or regional pie chart
- **Promotions & Discounts** — bubble chart (actual vs expected uplift, bubble size = budget)
- **Competitor Activities** — scrollable event timeline table with colour-coded activity badges
- **Forecasting Methods** — method comparison cards highlighting the best model (lowest MAPE) in teal
- **Technology & Data Tools** — health matrix table with Available / Missing / Placeholder / Needs API Key status badges and a data quality score bar
- **Final SCM Recommendation** — decision matrix table with risk-level and priority colour coding
- **Inventory Levels** — stacked bar chart per SKU (current stock + in-transit)
- **Lead Time** — stacked waterfall bar chart per supplier stage (purchase + production + shipping + delivery)
- **Historical Sales Data** — composed area + line chart
- **Market Trends** — area chart
- **Seasonality** — bar chart with seasonal index
- **Economic Conditions** — radar chart
- **Forecast Accuracy** — line + bar composed chart

The Bangladesh Regional Demand Map, SCM Flow Map, and Risk Alerts & Action Plan are recalculated from the latest uploaded file. If the workbook does not contain the relevant rows for a module, ForecastSync shows **Relevant data not found** with the source/row reason instead of demo data.

## Sidebar Navigation

Use the dot-active sidebar on the left to switch between modules. The active module is highlighted with a teal background and dot. All sidebar items navigate directly without a full page reload.

## Online Search

Use **Search By Choice** when you want web research for a selected product, category, brand, and region. Choose the number of sites to search, then click **Search online**.

After search finishes, click **Create dashboard from results** to view interpreted online signals:

- Market trend
- Competitor pressure
- Economic risk
- Seasonal lift
- Promotion pressure

Hover each signal card for its interpretation and calculation rules.

## Module Pages

Use the sidebar to open detailed modules:

- Historical Sales Data
- Market Trends
- Seasonality
- Customer Demand Patterns
- Promotions & Discounts
- Economic Conditions
- Competitor Activities
- Inventory Levels
- Lead Time
- Forecasting Methods
- Technology & Data Tools
- Forecast Accuracy
- Final SCM Recommendation

Each module contains chart visuals, table data, source labels, risk level, and recommendation text. If the module cannot be calculated from the current workbook, it shows **Relevant data not found**.

Each module page has tailored filters for that module. For example, Inventory Levels includes safety stock and reorder point choices, Lead Time includes stage choices, Forecast Accuracy includes error and bias choices, and Customer Demand includes regional choices. Product, category, brand, region, channel, and source filters appear only when those fields exist in the active rows. Change the filter values, then click **Apply**. The app shows a wait screen while the current analysed data is filtered and the chart/table refresh. The input/output factor checkboxes remain only on the Import Data page.

## Forecast Methods Page

Open `/forecast-methods` to use the detailed forecasting workbench. It includes:

- Forecasting Model Types
- Forecasting Data Patterns
- Quantitative Forecasting Techniques
- Forecast Error Measurement
- Interactive Forecast Calculator
- Visual Comparison Dashboard
- Final SCM Interpretation Panel

Use the moving-average window selector and alpha slider to compare methods. The page recommends the method with the lowest MAPE.

## Export

After running analysis:

- Click **PDF** to export a visual report.
- Click **Excel** to export workbook sheets.
- Click **CSV** to export forecast data.

Exports are enabled only when the related output checkbox is selected.

PDF export captures the report view visually. During export, the app shows a wait screen while it renders the report and charts.
