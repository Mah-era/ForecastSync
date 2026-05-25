import type { SearchRequest, WebSearchResult } from "@/types/scm";

export async function runWebSearch(selection: SearchRequest): Promise<WebSearchResult> {
  const query = `${selection.productName} ${selection.brand} ${selection.category} Bangladesh demand trends competitors inflation Ramadan Eid`;
  const tavilyKey = process.env.TAVILY_API_KEY;
  const maxResults = Math.max(1, Math.min(20, selection.sourceCount ?? 10));

  if (tavilyKey) {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          search_depth: "advanced",
          max_results: maxResults,
          include_answer: true
        }),
        next: { revalidate: 3600 }
      });

      if (response.ok) {
        const payload = await response.json();
        const sources = (payload.results ?? []).map((item: { title?: string; url?: string; content?: string }) => ({
          title: item.title ?? "Untitled source",
          url: item.url ?? "",
          snippet: item.content ?? ""
        }));
        return {
          query,
          provider: "tavily",
          summary: payload.answer ?? `Live web research completed for ${selection.productName}.`,
          sources,
          trendSignals: deriveSignals(`${payload.answer ?? ""} ${sources.map((source: { snippet: string }) => source.snippet).join(" ")}`)
        };
      }
    } catch {
      // The caller receives an explicit unavailable status below.
    }
  }

  return {
    query,
    provider: "unavailable",
    summary:
      "Live Tavily search was unavailable. Add or verify TAVILY_API_KEY to include online market research.",
    sources: [],
    trendSignals: {
      marketTrendIndex: 50,
      competitorPressure: 35,
      economicRisk: 35,
      seasonalLift: 10,
      promotionPressure: 30
    }
  };
}

function deriveSignals(text: string) {
  const lower = text.toLowerCase();
  const count = (words: string[]) => words.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
  return {
    marketTrendIndex: Math.min(95, 50 + count(["growth", "demand", "popular", "trend", "increase"]) * 8),
    competitorPressure: Math.min(90, 35 + count(["competitor", "discount", "launch", "price", "promotion"]) * 9),
    economicRisk: Math.min(88, 30 + count(["inflation", "income", "purchasing", "price sensitive"]) * 11),
    seasonalLift: Math.min(85, 18 + count(["ramadan", "eid", "winter", "summer", "festival"]) * 10),
    promotionPressure: Math.min(84, 25 + count(["promotion", "campaign", "discount", "offer"]) * 10)
  };
}
