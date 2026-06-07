/**
 * GapBar — Horizontal bar showing ordered vs available/max quantities with gap highlight.
 *
 * Used across multiple exception types:
 * - Back-Order/OOS: ordered vs available (gap = shortfall)
 * - Over Max: ordered vs max (excess highlighted)
 * - Min Order Qty: ordered vs MOQ (shortfall highlighted)
 *
 * Reusable, data-driven, no hardcoded intent logic.
 */
"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface GapBarProps {
  /** Primary quantity (e.g., ordered) */
  primaryQty: number;
  /** Primary label */
  primaryLabel: string;
  /** Secondary quantity (e.g., available, max, MOQ) */
  secondaryQty: number;
  /** Secondary label */
  secondaryLabel: string;
  /** Unit of measure */
  uom: string;
  /** Whether to show the gap as excess (primary > secondary, red on right) or shortfall (primary < secondary, amber) */
  mode?: "shortfall" | "excess";
  className?: string;
}

export function GapBar({
  primaryQty,
  primaryLabel,
  secondaryQty,
  secondaryLabel,
  uom,
  mode = "shortfall",
  className,
}: GapBarProps) {
  const maxVal = Math.max(primaryQty, secondaryQty, 1);
  const primaryPct = (primaryQty / maxVal) * 100;
  const secondaryPct = (secondaryQty / maxVal) * 100;
  const gap = Math.abs(primaryQty - secondaryQty);
  const gapPct = maxVal > 0 ? (gap / maxVal) * 100 : 0;
  const hasGap = gap > 0;

  // A gap in `shortfall` mode is a shortfall regardless of which side is
  // larger — back-order is ordered > available, but MOQ is ordered < MOQ.
  // The previous `primaryQty > secondaryQty` gate made the MOQ/back-order
  // under-case (ordered < target) never render as a shortfall.
  const isExcess = mode === "excess" && hasGap;
  const isShortfall = mode === "shortfall" && hasGap;

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Primary bar */}
      <div className="flex items-center gap-8">
        <span className="text-caption text-text-tertiary w-[72px] shrink-0 text-right">
          {primaryLabel}
        </span>
        <div className="flex-1 h-[20px] bg-surface-secondary rounded-sm overflow-hidden relative">
          <div
            className={cn(
              "h-full rounded-sm transition-all duration-normal",
              isExcess ? "bg-error" : "bg-brand",
            )}
            style={{ width: `${primaryPct}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-end pr-6 text-label font-bold text-text-primary">
            {primaryQty.toLocaleString()} {uom}
          </span>
        </div>
      </div>

      {/* Secondary bar */}
      <div className="flex items-center gap-8">
        <span className="text-caption text-text-tertiary w-[72px] shrink-0 text-right">
          {secondaryLabel}
        </span>
        <div className="flex-1 h-[20px] bg-surface-secondary rounded-sm overflow-hidden relative">
          <div
            className={cn(
              "h-full rounded-sm transition-all duration-normal",
              isShortfall ? "bg-warning" : "bg-success",
            )}
            style={{ width: `${secondaryPct}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-end pr-6 text-label font-bold text-text-primary">
            {secondaryQty.toLocaleString()} {uom}
          </span>
        </div>
      </div>

      {/* Gap indicator */}
      {hasGap && (
        <div className="flex items-center gap-8">
          <span className="w-[72px] shrink-0" />
          <div
            className={cn(
              "flex items-center gap-4 text-caption font-medium",
              isExcess ? "text-error" : "text-warning",
            )}
          >
            <div
              className={cn(
                "h-[4px] rounded-full",
                isExcess ? "bg-error" : "bg-warning",
              )}
              style={{ width: `${Math.max(gapPct, 8)}%` }}
            />
            {/* Icon + explicit direction word so severity is not colour-only
                (WCAG 1.4.1). */}
            {isExcess ? (
              <TrendingUp size={12} className="shrink-0" aria-hidden />
            ) : (
              <TrendingDown size={12} className="shrink-0" aria-hidden />
            )}
            <span className="shrink-0">
              {isExcess ? "Over by" : "Short by"}: {gap.toLocaleString()} {uom} ({((gap / Math.max(primaryQty, secondaryQty)) * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
