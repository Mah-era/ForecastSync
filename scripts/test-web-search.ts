import { existsSync, readFileSync } from "node:fs";
import { runWebSearch } from "../lib/web-search/search";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length && !process.env[key]) {
      process.env[key] = valueParts.join("=");
    }
  }
}

runWebSearch({
  productName: "Dove Beauty Bar",
  category: "cosmetics",
  brand: "Dove / Unilever",
  region: "Bangladesh"
})
  .then((result) => {
    console.log(JSON.stringify({
      provider: result.provider,
      sourceCount: result.sources.length,
      hasSummary: result.summary.length > 0
    }, null, 2));
    if (result.provider !== "tavily" || !result.sources.length) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
