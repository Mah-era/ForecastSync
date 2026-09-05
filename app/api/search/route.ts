import { NextResponse } from "next/server";
import { getWebSearchAvailability, runWebSearch } from "@/lib/web-search/search";
import type { SearchRequest } from "@/types/scm";

export async function POST(request: Request) {
  const selection = (await request.json()) as SearchRequest;
  const result = await runWebSearch(selection);
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json(getWebSearchAvailability());
}
