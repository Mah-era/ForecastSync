"use client";

import { ArrowRight, RefreshCcw } from "lucide-react";

export function CausalDiagram() {
  const factors = ["Price", "Promotion", "Income", "Weather", "Economy"];
  return (
    <div className="grid gap-2 rounded-md border border-border bg-slate-50 p-3 text-sm">
      {factors.map((factor) => (
        <div key={factor} className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-white px-3 py-2 font-medium shadow-sm">{factor}</span>
          <ArrowRight size={16} className="text-primary" />
          <span className="rounded-md bg-teal-50 px-3 py-2 font-medium text-teal-900">Demand</span>
        </div>
      ))}
    </div>
  );
}

export function QualitativeFlowDiagram() {
  const inputs = ["Expert Opinion", "Market Research", "Survey", "Sales Team Feedback"];
  return (
    <div className="rounded-md border border-border bg-slate-50 p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        {inputs.map((input) => <div key={input} className="rounded-md bg-white p-3 text-center text-sm font-medium shadow-sm">{input}</div>)}
      </div>
      <div className="mx-auto my-3 h-8 w-px bg-primary" />
      <div className="rounded-md bg-teal-50 p-3 text-center text-sm font-semibold text-teal-900">Demand Forecast</div>
    </div>
  );
}

export function DelphiLoopDiagram() {
  const steps = ["Expert Panel", "Round 1 Feedback", "Summary", "Round 2 Feedback", "Consensus Forecast"];
  return (
    <div className="rounded-md border border-border bg-slate-50 p-4">
      <div className="grid gap-2 md:grid-cols-5">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-2">
            <div className="min-h-16 flex-1 rounded-md bg-white p-3 text-center text-sm font-medium shadow-sm">{step}</div>
            {index < steps.length - 1 && <ArrowRight className="hidden text-primary md:block" size={16} />}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
        <RefreshCcw size={14} />
        Repeat feedback rounds until expert opinions converge
      </div>
    </div>
  );
}

export function MapeGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const label = clamped <= 10 ? "Excellent" : clamped <= 20 ? "Good" : clamped <= 50 ? "Needs improvement" : "Poor";
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">MAPE Gauge</span>
        <span>{label}</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-primary" style={{ width: `${clamped}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>0-10 Excellent</span>
        <span>10-20 Good</span>
        <span>50+ Poor</span>
      </div>
    </div>
  );
}
