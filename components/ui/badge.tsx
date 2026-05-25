import { HTMLAttributes } from "react";
import { cn, riskClass } from "@/lib/utils";

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
        tone ? riskClass(tone) : "border-slate-200 bg-slate-50 text-slate-700",
        className
      )}
      {...props}
    />
  );
}
