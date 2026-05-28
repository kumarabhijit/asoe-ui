// StickyActionRibbon — top-of-pane sticky action surface.
//
// ADR-041 P3e §2.2. Compliance reversal condition for the
// Agent-Analysis-above-Recommendation reorder: the verdict ×
// permission action matrix must stay above the fold no matter how
// long the Analysis section grows. The ribbon mounts at the top of
// the right-pane scroll container with `position: sticky; top: 0`
// — Analysis and the Recommendation card scroll under it; the
// ribbon stays put.
//
// Wraps `<ActionButtonMatrix>` (single source of truth for the
// verdict × permission logic, ADR-041 P3e §2.2). The ribbon adds
// chrome only — no action logic of its own — so the buttons here
// are byte-for-byte identical to the ones the legacy inline
// AgentReasoningCard mount renders. That identity is the SOX
// safeguard: an operator's audit trail does not depend on which
// mount they clicked from.
//
// `aria-label="Recommended actions"` so screen-reader users hear a
// landmark when entering the ribbon region. The skip-link in the
// slim case-header targets the ribbon's `id` so keyboard users can
// jump straight to the buttons.

"use client";

import { Zap } from "lucide-react";

import { ActionButtonMatrix } from "./ActionButtonMatrix";
import type { ActionButtonMatrixProps } from "./ActionButtonMatrix";
import { cn } from "@/lib/utils";

export interface StickyActionRibbonProps extends ActionButtonMatrixProps {
  /** Anchor id for the skip-link. Defaults to `action-ribbon`. */
  id?: string;
}

export function StickyActionRibbon({
  id = "action-ribbon",
  className,
  ...matrixProps
}: StickyActionRibbonProps) {
  return (
    <section
      id={id}
      aria-label="Recommended actions"
      // sticky at the top of the nearest scrolling ancestor. The
      // right-pane workspace section in /cases has
      // `lg:overflow-y-auto`, so this anchors against that. z-10 to
      // keep the ribbon over the cards that scroll underneath.
      className={cn(
        "sticky top-0 z-10",
        "bg-surface-primary border border-border rounded-md shadow-sm",
        "px-16 py-12",
        className,
      )}
    >
      <div className="flex items-center gap-8 mb-8">
        <Zap size={14} className="text-brand" aria-hidden />
        <span className="text-caption font-semibold text-text-primary uppercase tracking-wider">
          Actions
        </span>
      </div>
      <ActionButtonMatrix {...matrixProps} />
    </section>
  );
}
