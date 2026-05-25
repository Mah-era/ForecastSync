import { NextResponse } from "next/server";
import { runWebSearch } from "@/lib/web-search/search";
import type { SearchRequest } from "@/types/scm";

export async function POST(request: Request) {
  const selection = (await request.json()) as SearchRequest;
  const result = await runWebSearch(selection);
  return NextResponse.json(result);
}
