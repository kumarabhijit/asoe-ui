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
 *
 * Both fields are audit-bearing per
 * compliance/audit_bearing_registry.yaml. Returning a literal "—"
 * placeholder for null/undefined would be a partial-truth state
 * (CLAUDE.md Guardrail #6 / Verdict 2026-04-22). The composer is
 * supposed to have routed records with absent values to
 * AUDIT_CONTEXT_MISSING upstream; if we still get an absent value
 * here it's a bug worth noticing — return null so isPresent() at
 * the call site can suppress the row entirely (structural
 * omission), and emit a dev-mode console warning so the regression
 * surfaces.
 */
function renderUnknown(value: unknown): string | null {
  if (value === null || value === undefined) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[EdiMismatchSection] audit-bearing expected_value/received_value " +
        "is absent — composer should have routed this record to " +
        "AUDIT_CONTEXT_MISSING. Rendering with structural omission.",
      );
    }
    return null;
  }
  if (typeof value === "object") {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

export function EdiMismatchSection({ data }: EdiMismatchSectionProps) {
  // Forward-compatibility fallback (CLAUDE.md Guardrail #1). If asoe2
  // ships a new EdiMismatchClassification literal (e.g. WARN), the
  // UI keeps rendering the record with a neutral badge rather than
  // crashing on `classification.variant` of undefined. Mirrors
  // Badge.tsx::verdictVariant() / lifecycleVariant() `default:
  // "neutral"` pattern.
  const classification = CLASSIFICATION_BADGE[data.classification] ?? {
    variant: "neutral" as const,
    label: String(data.classification),
  };

  return (
    <section
      aria-label="EDI line mismatch analysis"
      className="bg-surface-primary rounded-md shadow-sm p-16"
    >
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

      {/* Recommended action. aria-live="polite" so re-classification
          via a re-analysis announces the new recommended action to
          screen-reader users (WCAG 4.1.3). */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mb-12"
      >
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

function ValueCard({ label, value, highlight }: { label: string; value: string | null; highlight?: boolean }) {
  // Structural omission (CLAUDE.md Guardrail #6): if renderUnknown
  // returned null, the audit-bearing field was absent and the
  // composer should have routed to AUDIT_CONTEXT_MISSING upstream.
  // Rendering nothing is the correct fallback — never a "—".
  if (value === null) return null;
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
