// ComplianceHitsRail — Compliance Shadow hits surface.
//
// ADR-041 P3e §2.3 — extracted from `CaseDetailPanel.tsx:331-358`
// as a standalone component so the page-level layout can host it as
// a third column at xl when NEXT_PUBLIC_CASES_ROW_V2 is on (audit
// rail demotion). At lg and below the rail continues to live where
// it always has: stacked in the main column above the records picker.
//
// Pure projector — `hits` flows in from `casesApi.getRecords()
// .aggregated_policy_hits`. ADR-039 §4.5 — strings prefixed with
// `LLM_SHADOW:` are L2-LLM-derived; bare strings are L1
// deterministic rule names. `PolicyHitBadge` carries the visual
// distinction.
//
// Returns null when there are no hits (Guardrail #6 — no
// synthesised "no hits" placeholder). Callers that need a different
// empty state should render their own.

"use client";

import { ShieldAlert } from "lucide-react";

import { PolicyHitBadge } from "@/components/ui/PolicyHitBadge";
import { cn } from "@/lib/utils";

export interface ComplianceHitsRailProps {
  hits: readonly string[];
  /** Render as a side rail (dense, padded for a 320px column) vs.
   *  the legacy inline card (full padding, drop shadow, rounded
   *  card chrome). Defaults to `inline` so existing consumers keep
   *  their layout. */
  variant?: "inline" | "rail";
}

export function ComplianceHitsRail({
  hits,
  variant = "inline",
}: ComplianceHitsRailProps) {
  if (hits.length === 0) return null;

  return (
    <section
      aria-label="Compliance Shadow hits"
      className={cn(
        variant === "inline"
          ? "bg-surface-primary border border-border rounded-md p-16 shadow-xs"
          : "bg-surface-secondary border-l border-border-subtle p-16 min-h-0 overflow-y-auto",
      )}
    >
      <div className="flex items-center gap-8 mb-12">
        <ShieldAlert size={16} aria-hidden className="text-text-secondary" />
        <h2 className="text-heading font-semibold text-text-primary m-0">
          Compliance hits
        </h2>
        <span className="ml-auto text-caption text-text-tertiary">
          {hits.length}
        </span>
      </div>
      <p className="text-caption text-text-tertiary leading-normal mb-12">
        L1 rule names render plain; L2 LLM-derived concerns
        (ADR-039 §4.5) carry the AI badge.
      </p>
      <ul className="flex flex-wrap gap-8 m-0 p-0 list-none">
        {hits.map((hit) => (
          <li key={hit}>
            <PolicyHitBadge hit={hit} />
          </li>
        ))}
      </ul>
    </section>
  );
}
