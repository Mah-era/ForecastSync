Demand Planning & Forecasting Tracker Test Fixtures

This package was converted from the 30 Excel test fixtures.

CSV package structure:
- Each scenario has its own folder.
- Each original Excel sheet is exported as a separate CSV file.
- Use manifest.csv to map scenario IDs to folders.

JSON package structure:
- Each scenario is exported as one JSON file.
- Each JSON file contains all sheets.
- For each sheet, `records` uses the first row as headers and `raw_rows` preserves the original sheet layout.

Use these fixtures to test file import, auto-detection, selected input/output checkboxes, forecasting modules, chart-ready transformations, web-search fallback handling, dashboard rendering, and export generation.


Original Excel README:

Demand Planning & Forecasting Tracker - 30 Excel Test Files
Each .xlsx file contains Scenario_Info plus module-ready sheets for sales, inventory, promotions, competitors, economic conditions, lead time, maps, web search seeds, manual expert opinion, and forecast accuracy.

DPF-01 - Clean Baseline FMCG Demand | Product: Dove Beauty Bar | Category: Cosmetics | Brand: Dove | Quality: Clean
DPF-02 - Ramadan and Eid Seasonal Surge | Product: Dove Shampoo | Category: Personal Care | Brand: Dove | Quality: Clean
DPF-03 - Winter Seasonal Demand Increase | Product: Hoodie Classic | Category: Clothing | Brand: Trunk | Quality: Clean
DPF-04 - Summer Demand Softness | Product: Moisturizing Cream | Category: Skin Care | Brand: Nivea | Quality: Clean
DPF-05 - High Promotion Uplift | Product: Bata Sandal | Category: Footwear | Brand: Bata | Quality: Clean
DPF-06 - Low ROI Promotion | Product: Face Wash | Category: Skin Care | Brand: Garnier | Quality: Clean
DPF-07 - Competitor Price Drop Pressure | Product: Laundry Detergent | Category: Home Care | Brand: Surf Excel | Quality: Clean
DPF-08 - Competitor Product Launch | Product: Soft Drink 250ml | Category: Beverage | Brand: Coca-Cola | Quality: Clean
DPF-09 - Inflation Demand Reduction | Product: Cooking Oil 5L | Category: Grocery | Brand: Fresh | Quality: Clean
DPF-10 - Purchasing Power Improvement | Product: Smartphone A Series | Category: Electronics | Brand: Samsung | Quality: Clean
DPF-11 - Low Inventory Stockout Risk | Product: Baby Diaper Pack | Category: Baby Care | Brand: Pampers | Quality: Clean
DPF-12 - Overstock Risk | Product: Formal Shirt | Category: Clothing | Brand: Aarong | Quality: Clean
DPF-13 - Long Import Lead Time | Product: Smart Watch | Category: Electronics | Brand: Xiaomi | Quality: Clean
DPF-14 - Supplier Production Delay | Product: Paper Carton Box | Category: Packaging | Brand: Xbo | Quality: Clean
DPF-15 - New Product Cold Start | Product: Dry Shampoo Spray | Category: Hair Care | Brand: NewBrand | Quality: Clean
DPF-16 - Missing Historical Months | Product: Rice 5kg | Category: Grocery | Brand: Pran | Quality: Messy/Edge Case
DPF-17 - Duplicate Sales Rows | Product: Liquid Handwash | Category: Personal Care | Brand: Lifebuoy | Quality: Messy/Edge Case
DPF-18 - Wrong Date Formats | Product: Leather Shoe | Category: Footwear | Brand: Apex | Quality: Messy/Edge Case
DPF-19 - Text Numbers and Currency Symbols | Product: Foundation Makeup | Category: Cosmetics | Brand: Maybelline | Quality: Messy/Edge Case
DPF-20 - Returns and Negative Demand Rows | Product: T-Shirt | Category: Clothing | Brand: Trunk | Quality: Messy/Edge Case
DPF-21 - Extreme Outlier Spike | Product: Power Bank | Category: Electronics | Brand: Anker | Quality: Messy/Edge Case
DPF-22 - Bangladesh Regional Demand Map | Product: Biscuit Pack | Category: Food | Brand: Olympic | Quality: Clean
DPF-23 - Multi-Channel POS Demand | Product: Wireless Earbuds | Category: Electronics | Brand: Realme | Quality: Clean
DPF-24 - ERP Schema Mismatch | Product: Office Chair | Category: Furniture | Brand: Hatil | Quality: Messy/Edge Case
DPF-25 - JSON-like Nested Data in Excel | Product: Cloud Subscription | Category: Technology Service | Brand: BDTech | Quality: Clean
DPF-26 - Forecast Accuracy Benchmark | Product: Milk Powder | Category: Grocery | Brand: Diploma | Quality: Clean
DPF-27 - Mixed Brands and Categories | Product: Mixed FMCG Basket | Category: Mixed | Brand: Multiple | Quality: Clean
DPF-28 - Web Search Source Seeds | Product: Dry Shampoo Spray | Category: Hair Care | Brand: Marico | Quality: Clean
DPF-29 - Manual Expert Opinion Heavy | Product: Luxury Bridal Dress | Category: Wedding Fashion | Brand: Gulzar e Nikah | Quality: Clean
DPF-30 - Full End-to-End Complex Scenario | Product: Dove Shampoo | Category: Personal Care | Brand: Dove | Quality: Messy/Edge Case
