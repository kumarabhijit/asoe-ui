/**
 * Shared helper components + pure utilities for exception detail
 * sub-components. Utilities live here (not in ExceptionDetailPanel)
 * so the orchestrator stays focused on orchestration.
 *
 * ADR-027 Phase C: PIPELINE_NODES + STATE_PROGRESS + buildNodeStates
 * are deleted. The drift surface they represented is closed —
 * EventsTimeline + PipelineDAG consume the trace's `executed_nodes`
 * and the topology endpoint directly, so the UI no longer mirrors
 * the backend graph shape.
 */
"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one business-rule lifecycle literal referenced in
 * ExceptionDetailPanel — cosign banner gate. Mirrors
 * `contracts/models.py::COSIGN_ELIGIBLE_STATES`.
 */
export const COSIGN_LIFECYCLE_STATE = "PENDING_COSIGN" as const;

/**
 * UX-meaningful grouping of lifecycle states where the operator is
 * expected to take action. Drives:
 *   - `AgentAnalysisSection` auto-expand in `ExceptionDetailPanel`
 *   - the "HITL queue" quick-filter pill in `ExceptionListPane`
 *
 * **Not** a backend enum gate — Guardrail #1 forbids hardcoding enum
 * values for filter dropdowns or business logic. This is a UI-side
 * classification (which states represent "human action expected") and
 * the values themselves come from `health.lifecycle_states` at render
 * time. Lives in `shared.tsx` so both detail panel and list pane
 * share one definition.
 */
export const HITL_LIFECYCLE_STATES: ReadonlySet<string> = new Set([
  "PENDING_REVIEW",
  "ESCALATED",
  "PENDING_ADMIN_REVIEW",
  "PENDING_COSIGN",
  "BLOCKED",
]);

/** Collapsible section header — matches Evidence Detail card pattern */
export function CollapsibleHeader({ title, open, onToggle, badge, badgeVariant = "neutral" }: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  badgeVariant?: string;
}) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center justify-between px-16 py-10 bg-transparent border-none cursor-pointer font-sans"
    >
      <div className="flex items-center gap-8">
        <ChevronDown
          size={14}
          className={cn(
            "text-text-tertiary transition-transform duration-fast",
            !open && "-rotate-90",
          )}
        />
        <span className="text-subhead font-semibold text-text-primary">
          {title}
        </span>
        {badge && (
          <span
            className={cn(
              "text-label font-semibold px-2 py-px rounded-full",
              badgeVariant === "success" && "bg-success-subtle text-success",
              badgeVariant === "error" && "bg-error-subtle text-error",
              badgeVariant === "info" && "bg-info-subtle text-info",
              (!badgeVariant || badgeVariant === "neutral") && "bg-surface-secondary text-text-tertiary",
            )}
          >
            {badge}
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * CollapsibleSection — wraps an enrichment section in a collapsible
 * card. Used to keep all panes other than the Recommendation
 * minimised by default (TRB ruling on PO request #4). The wrapped
 * children are mounted only when `open` is true so heavy renders
 * (e.g., big tables, charts) don't run until the operator opens the
 * pane.
 */
export function CollapsibleSection({
  title,
  defaultOpen = false,
  badge,
  badgeVariant,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  badgeVariant?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
      <CollapsibleHeader
        title={title}
        open={open}
        onToggle={() => setOpen((v) => !v)}
        badge={badge}
        badgeVariant={badgeVariant}
      />
      {open && <div className="border-t border-border">{children}</div>}
    </section>
  );
}

/** Price formatting helper */
export function fmtPrice(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
