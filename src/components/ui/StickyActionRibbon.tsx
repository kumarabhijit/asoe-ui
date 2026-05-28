// StickyActionRibbon — top-of-pane action surface.
//
// ADR-041 P3e §2.2. Compliance reversal condition for the
// Agent-Analysis-above-Recommendation reorder: the verdict ×
// permission action matrix must stay above the fold no matter how
// long the Analysis section grows.
//
// The "sticky" in the name is now historical — the ribbon mounts
// as a SIBLING of the inner scroll container in
// `ExceptionDetailPanel`, not inside it. That's the right
// architecture: the inner Analysis / Recommendation / enrichment
// content scrolls underneath this ribbon while the ribbon stays
// pinned above by virtue of being outside the scroll surface.
//
// (The previous implementation used `position: sticky; top: 0`
// inside the inner scroll container. That broke: the user's scroll
// is INSIDE the same container the sticky reference points at, so
// the ribbon scrolls away with its content — the offset is
// already passed by the time the user starts reading.)
//
// Wraps `<ActionButtonMatrix>` (single source of truth for the
// verdict × permission logic). The ribbon adds chrome only — no
// action logic of its own — so the buttons here are byte-for-byte
// identical to the ones the legacy inline AgentReasoningCard mount
// renders. That identity is the SOX safeguard: an operator's
// audit trail does not depend on which mount they clicked from.
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
      // Mounts above the scroll container — see file-top comment
      // for rationale. Card-like chrome (bg + border + shadow)
      // separates the ribbon visually from the slim case header
      // above and the scrollable content below.
      className={cn(
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
