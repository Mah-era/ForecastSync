import { HTMLAttributes } from "react";
import { cn, riskClass } from "@/lib/utils";

export function Badge({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        tone ? cn("border", riskClass(tone)) : "bg-slate-100 text-slate-600",
        className
      )}
      {...props}
    />
  );
}
