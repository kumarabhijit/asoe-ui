/**
 * EdiMismatchSection — Data-presence-driven enrichment.
 *
 * Renders ONLY when analysis.edi_mismatch_analysis is present.
 * Shows: sub_type, expected vs received side-by-side, classification,
 * recommended action, and autonomy level.
 *
 * Note on the routing fork: PRICE_MISMATCH events do NOT reach this
 * section — the asoe2 classifier routes them to CONTRACTUAL_CORRECTION
 * and PriceAdjustmentRecipe, where they render via PriceAnalysisSection
 * instead. This preserves PriceAdjustmentRecipe as the single source of
 * truth for pricing (CLAUDE.md §1 in asoe2). If a PRICE_MISMATCH ever
 * lands here it would be a backend routing bug.
 */
"use client";

import { AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { EdiMismatchAnalysisData, EdiMismatchClassification } from "@/types/exceptions";

interface EdiMismatchSectionProps {
  data: EdiMismatchAnalysisData;
}

const CLASSIFICATION_BADGE: Record<EdiMismatchClassification, { variant: "success" | "warning" | "error"; label: string }> = {
  HARD_REJECT: { variant: "error",   label: "Hard reject" },
  REVIEW:      { variant: "warning", label: "Review required" },
  ESCALATE:    { variant: "warning", label: "Escalate" },
};

/**
 * `expected_value` and `received_value` are typed `unknown` because EDI
 * sub_types carry different value shapes (SKU=string, QTY=number,
 * SHIP_TO=DC code, UOM=enum). Render verbatim with a stable string
 * coercion — no type-specific dispatch.
 */
function renderUnknown(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

export function EdiMismatchSection({ data }: EdiMismatchSectionProps) {
  const classification = CLASSIFICATION_BADGE[data.classification];

  return (
    <section className="bg-surface-primary rounded-md shadow-sm p-16">
      {/* Section header */}
      <div className="flex items-center gap-8 mb-12">
        <AlertTriangle size={14} className="text-text-tertiary" />
        <span className="text-subhead font-semibold text-text-primary">
          EDI Line Mismatch
        </span>
        <Badge variant="neutral" size="sm">
          {/* sub_type rendered verbatim — see exceptions.ts */}
          {data.sub_type}
        </Badge>
        <Badge variant={classification.variant} size="sm">
          {classification.label}
        </Badge>
      </div>

      {/* Expected vs received side-by-side */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-12 mb-16 items-start">
        <ValueCard label="Expected" value={renderUnknown(data.expected_value)} />
        <div className="flex items-center justify-center pt-24 text-text-quaternary">
          <ArrowRight size={20} />
        </div>
        <ValueCard label="Received" value={renderUnknown(data.received_value)} highlight />
      </div>

      {/* Recommended action */}
      <div className="mb-12">
        <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
          Recommended Action
        </div>
        <div className="border-l-[3px] border-brand pl-10 text-body font-semibold text-brand leading-normal">
          {data.recommended_action}
        </div>
        {data.notification_template && (
          <div className="mt-4 pl-10 flex items-center gap-6 text-caption text-text-tertiary">
            <span className="font-mono font-semibold">Notification:</span>
            <span className="font-mono">{data.notification_template}</span>
          </div>
        )}
      </div>

      {/* Autonomy footer */}
      <div className="flex items-center gap-8 px-12 py-8 bg-surface-secondary rounded-sm text-caption">
        <Clock size={12} className="text-text-tertiary" />
        <span className="text-text-tertiary font-semibold">Autonomy:</span>
        <span className="text-text-secondary">{data.autonomy_level}</span>
      </div>
    </section>
  );
}

function ValueCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={
        highlight
          ? "p-12 rounded-sm border border-warning bg-warning-subtle"
          : "p-12 rounded-sm border border-border bg-surface-primary"
      }
    >
      <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
        {label}
      </div>
      <div className="font-mono font-semibold text-body text-text-primary break-all">
        {value}
      </div>
    </div>
  );
}
