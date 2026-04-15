/**
 * PricingWaterfall — vertical timeline of pricing condition steps.
 *
 * Distinct from WaterfallStepper: WaterfallStepper visualizes the 10-node
 * pipeline execution (WebSocket-driven). PricingWaterfall visualizes
 * the pricing condition chain for a line item (API data-driven).
 */
"use client";

import { CircleDot, FileText, Clock, Package, Check, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { PricingWaterfallStep, PricingConditionType } from "@/types/exceptions";

interface PricingWaterfallProps {
  steps: PricingWaterfallStep[];
  className?: string;
}

const TYPE_ICONS: Record<PricingConditionType, ReactNode> = {
  BASE: <CircleDot size={14} />, CONTRACT: <FileText size={14} />,
  TPR: <Clock size={14} />, UOM: <Package size={14} />,
  RESULT: <Check size={14} />, ERROR: <X size={14} />,
};

const TYPE_COLORS: Record<PricingConditionType, string> = {
  BASE: "var(--color-text-secondary)", CONTRACT: "var(--color-cat-purple)",
  TPR: "var(--color-cat-amber)", UOM: "var(--color-cat-teal)",
  RESULT: "var(--color-success)", ERROR: "var(--color-error)",
};

function typeColor(type: string): string {
  return TYPE_COLORS[type as PricingConditionType] ?? "var(--color-text-secondary)";
}

function typeIcon(type: string): ReactNode {
  return TYPE_ICONS[type as PricingConditionType] ?? <CircleDot size={14} />;
}

function fmtPrice(n: number): string {
  return `$${Math.abs(n).toFixed(2)}`;
}

export function PricingWaterfall({ steps, className }: PricingWaterfallProps) {
  if (!steps || steps.length === 0) {
    return (
      <div className="text-text-tertiary text-caption italic py-12">
        Waterfall data available after audit.
      </div>
    );
  }

  return (
    <div className={className}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const isError = step.type === "ERROR";
        const isResult = step.type === "RESULT";
        const clr = typeColor(step.type);

        return (
          <div key={idx} className="flex relative z-[1]">
            {/* Timeline node + connector */}
            <div className="flex flex-col items-center mr-12 shrink-0 w-[32px]">
              <div
                className={cn(
                  "w-[32px] h-[32px] rounded-full flex items-center justify-center relative z-[2] border-2",
                  isError ? "bg-error-subtle" : isResult ? "bg-success-subtle" : "bg-surface-primary",
                )}
                style={{ borderColor: clr, color: clr }}
              >
                {typeIcon(step.type)}
              </div>
              {!isLast && <div className="w-px flex-1 min-h-2 bg-border" />}
            </div>

            {/* Step card */}
            <div
              className={cn(
                "flex-1 rounded-sm px-12 py-10 border",
                isError ? "bg-error-subtle border-error-border"
                : isResult ? "bg-success-subtle border-success-border"
                : "bg-surface-secondary border-border",
                !isLast && "mb-8",
              )}
            >
              {/* Header row */}
              <div className="flex items-center gap-8 mb-4 flex-wrap">
                <span className={cn("font-bold text-caption", isError ? "text-error" : isResult ? "text-success" : "text-text-primary")}>
                  {step.label}
                </span>
                <code className={cn(
                  "text-label text-text-tertiary px-1.5 py-px rounded-[3px] font-mono",
                  isError || isResult ? "bg-white/60" : "bg-surface-primary",
                )}>
                  {step.record}
                </code>
                <div className="flex-1" />
                {step.value != null && (
                  <span
                    className="font-mono text-body font-bold"
                    style={{
                      color: isError ? "var(--color-error)"
                        : step.value < 0 ? "var(--color-cat-amber)"
                        : isResult ? "var(--color-success)"
                        : "var(--color-text-primary)",
                    }}
                  >
                    {step.value > 0 && step.type !== "BASE" && step.type !== "RESULT" ? "+" : ""}
                    {fmtPrice(step.value)}
                  </span>
                )}
                {step.running != null && (
                  <span className="font-mono text-caption text-text-tertiary">
                    ={" "}
                    <strong className={isResult ? "text-success" : "text-text-primary"}>
                      {fmtPrice(step.running)}
                    </strong>
                  </span>
                )}
              </div>

              {/* Detail text */}
              <div className="text-caption text-text-tertiary leading-snug">
                {step.detail}
              </div>

              {/* Error callout */}
              {isError && step.error && (
                <div role="alert" className="mt-8 bg-error-subtle border border-error-border rounded-sm px-10 py-8 text-caption text-error flex gap-6 leading-normal">
                  <AlertTriangle size={13} className="shrink-0 mt-px" />
                  <span>{step.error}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
