import { NextResponse } from "next/server";
import { runDemandAnalysis } from "@/lib/scm/analyze";
import type { AnalysisRequest } from "@/types/scm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalysisRequest;
    if (!Array.isArray(body.uploadedDatasets) || !body.uploadedDatasets.length) {
      return NextResponse.json({ error: "No imported datasets were provided. Upload a file before running analysis." }, { status: 400 });
    }

    const result = await runDemandAnalysis(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Analyze API failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed on the server." },
      { status: 500 }
    );
  }
}
