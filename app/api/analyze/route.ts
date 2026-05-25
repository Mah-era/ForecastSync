import { NextResponse } from "next/server";
import { runDemandAnalysis } from "@/lib/scm/analyze";
import type { AnalysisRequest } from "@/types/scm";

export async function POST(request: Request) {
  const body = (await request.json()) as AnalysisRequest;
  const result = await runDemandAnalysis(body);
  return NextResponse.json(result);
}
