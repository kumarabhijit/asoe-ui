/**
 * PriceHoldSection — Data-presence-driven enrichment.
 *
 * Renders ONLY when analysis.price_hold_analysis is present.
 * Shows: PO vs SAP price comparison, signed variance, the policy
 * thresholds (tolerance / hard-block) the recipe applied, the
 * resulting recipe action, and the human-readable reason.
 *
 * Intent-agnostic: any intent that produces price_hold_analysis data
 * will render this section — zero dispatch logic. The current
 * producer is PriceHoldReleaseRecipe.py (asoe2).
 */
"use client";

import { Lock, Unlock, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { fmtPrice } from "./shared";
import type { PriceHoldAnalysisData, PriceHoldAction } from "@/types/exceptions";

interface PriceHoldSectionProps {
  data: PriceHoldAnalysisData;
}

/**
 * Variance is stored as a signed fraction (e.g., 0.05 = +5%, −0.03 = −3%).
 * Render as a percentage with one decimal place + explicit sign.
 */
function fmtVariance(variance: number): string {
  const pct = variance * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

const ACTION_BADGE: Record<PriceHoldAction, { variant: "success" | "warning" | "error"; label: string }> = {
  AUTO_RELEASE: { variant: "success", label: "Auto-release" },
  ESCALATE:     { variant: "warning", label: "Escalate" },
  HARD_BLOCK:   { variant: "error",   label: "Hard block" },
};

export function PriceHoldSection({ data }: PriceHoldSectionProps) {
  const action = ACTION_BADGE[data.action];
  const HoldIcon = data.hold_status === "RELEASED" ? Unlock : Lock;

  return (
    <section className="bg-surface-primary rounded-md shadow-sm p-16">
      {/* Section header */}
      <div className="flex items-center gap-8 mb-12">
        <HoldIcon size={14} className="text-text-tertiary" />
        <span className="text-subhead font-semibold text-text-primary">
          Price Hold Analysis
        </span>
        <Badge variant={action.variant} size="sm">
          {action.label}
        </Badge>
      </div>

      {/* PO vs SAP base price */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-12 mb-16 items-start">
        <PriceCard label="PO Price" value={data.po_price} />
        <div className="flex flex-col items-center justify-center pt-24 text-text-quaternary">
          <ArrowRight size={20} />
          <span className="text-label mt-4 font-mono font-semibold">
            {fmtVariance(data.variance_pct)}
          </span>
        </div>
        <PriceCard label="SAP Base Price" value={data.sap_base_price} highlight />
      </div>

      {/* Hold status + thresholds */}
      <div className="grid grid-cols-3 gap-12 mb-12">
        <Threshold label="Hold Status" value={data.hold_status} />
        <Threshold label="Tolerance" value={fmtVariance(data.tolerance_pct)} />
        <Threshold label="Hard Block" value={fmtVariance(data.hard_block_pct)} />
      </div>

      {/* Recommended action / reason */}
      <div className="mb-12">
        <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
          Recipe Decision
        </div>
        <div className="border-l-[3px] border-brand pl-10 text-body font-semibold text-brand leading-normal">
          {action.label}
        </div>
        <div className="mt-4 pl-10 text-caption text-text-tertiary">
          {data.reason}
        </div>
      </div>

      {/* Recipe footer */}
      <div className="flex items-center gap-8 px-12 py-8 bg-surface-secondary rounded-sm text-caption">
        <Clock size={12} className="text-text-tertiary" />
        <span className="text-text-tertiary font-semibold">Recipe:</span>
        <span className="text-text-secondary font-mono">PriceHoldReleaseRecipe.py</span>
      </div>
    </section>
  );
}

function PriceCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={
        highlight
          ? "p-12 rounded-sm border border-brand bg-brand-subtle"
          : "p-12 rounded-sm border border-border bg-surface-primary"
      }
    >
      <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
        {label}
      </div>
      <div className="font-mono font-semibold text-body text-text-primary">
        {fmtPrice(value)}
      </div>
    </div>
  );
}

function Threshold({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-4">
      <span className="text-label font-bold uppercase tracking-wider text-text-quaternary">
        {label}
      </span>
      <span className="font-mono font-semibold text-body text-text-primary">
        {value}
      </span>
    </div>
  );
}
