/**
 * Shared helper components + pure utilities for exception detail
 * sub-components. Utilities live here (not in ExceptionDetailPanel)
 * so the orchestrator stays focused on orchestration.
 */
"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExceptionDetail, PipelineNode } from "@/types/exceptions";
import type { NodeState } from "@/components/ui/WaterfallStepper";
import type { TraceResponse } from "@/types/api";

/**
 * The one business-rule lifecycle literal referenced in
 * ExceptionDetailPanel — cosign banner gate. Mirrors
 * `contracts/models.py::COSIGN_ELIGIBLE_STATES`.
 */
export const COSIGN_LIFECYCLE_STATE = "PENDING_COSIGN" as const;

/**
 * Pipeline-node progress per lifecycle state. `EXECUTING` was retired
 * in asoe2 Phase 19 when the disposition flow consolidated (backend
 * never emits it anymore). `PENDING_COSIGN` and `PENDING_ADMIN_REVIEW`
 * map to post-shadow-audit so the pipeline viz correctly shows those
 * exceptions as past the classify/shadow/select/validate nodes rather
 * than falling through to 0 (the bug surfaced by cross-repo review C4).
 */
const STATE_PROGRESS: Record<string, number> = {
  INGESTED: 0, CLASSIFYING: 1, AUDITING: 4, PENDING_REVIEW: 5,
  ESCALATED: 5, PENDING_ADMIN_REVIEW: 5, PENDING_COSIGN: 5,
  RESOLVED: 10, CLOSED: 10,
  FAILED: 8, BLOCKED: 5, REJECTED: 5,
};

const PIPELINE_NODES: PipelineNode[] = [
  "ingest", "classify", "load_skill", "validate_circuit_breaker",
  "shadow_audit", "select_recipe", "validate_types",
  "resolve_dependencies", "execute_recipe", "apply_effects",
];

const FAILED_STATES = new Set(["FAILED", "BLOCKED", "REJECTED"]);
const IN_PROGRESS_STATES = new Set(["CLASSIFYING", "AUDITING"]);

/**
 * Compact demo payload per pipeline node. Real runs populate these
 * fields from the TraceRecord / ExecutionLog on the backend; the
 * demo-time helper derives the obvious ones from the exception
 * itself so the waterfall steps have something to show.
 */
function buildNodeData(
  node: PipelineNode,
  exc: ExceptionDetail,
): Record<string, unknown> | undefined {
  switch (node) {
    case "classify": return exc.intent ? { intent: exc.intent, confidence: 0.92 } : undefined;
    case "shadow_audit": return exc.shadow_verdict ? { shadow_verdict: exc.shadow_verdict } : undefined;
    case "select_recipe": return exc.selected_recipe ? { selected_recipe: exc.selected_recipe } : undefined;
    case "apply_effects": return exc.final_status ? { final_status: exc.final_status } : undefined;
    default: return undefined;
  }
}

/**
 * Synthesize pipeline-node states for the WaterfallStepper from an
 * exception's current lifecycle_state. Pure — moving from the
 * orchestrator keeps ExceptionDetailPanel focused on orchestration
 * (review M3). `trace` is currently unused; kept in the signature
 * for when the real trace payload drives the step timings.
 */
export function buildNodeStates(
  exc: ExceptionDetail,
  _trace?: TraceResponse,
): NodeState[] {
  const completedUpTo = STATE_PROGRESS[exc.lifecycle_state] ?? 0;
  const isFailed = FAILED_STATES.has(exc.lifecycle_state);
  const isInProgress = IN_PROGRESS_STATES.has(exc.lifecycle_state);

  return PIPELINE_NODES.map((node, i): NodeState => {
    if (i < completedUpTo) {
      return {
        node,
        status: "completed",
        duration_ms: 200 + Math.round(Math.random() * 800),
        data: buildNodeData(node, exc),
      };
    }
    if (i === completedUpTo && isInProgress) return { node, status: "started" };
    if (i === completedUpTo && isFailed) return { node, status: "failed" };
    if (i > completedUpTo && isFailed) return { node, status: "skipped" };
    return { node, status: "pending" };
  });
}

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

/** Price formatting helper */
export function fmtPrice(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
