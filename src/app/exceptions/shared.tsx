/**
 * Shared helper components + pure utilities for exception detail
 * sub-components. Utilities live here (not in ExceptionDetailPanel)
 * so the orchestrator stays focused on orchestration.
 */
"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExceptionDetail, OrderAnalysis, PipelineNode } from "@/types/exceptions";
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
 * never emits it anymore).
 *
 * Indices align with PIPELINE_NODES below; numbers updated for the
 * post-2026-04-22 graph reorder (ADR-025) which moved
 * select_recipe / resolve_dependencies / validate_types BEFORE
 * shadow_audit (so audit-bearing evidence is captured for every
 * record), and added `build_analysis` (Pillar 2) at the end. The
 * sequence is now 11 nodes; AUDITING (shadow_audit in progress) is
 * at index 7 (was 4); RESOLVED / terminal states map to 11 (every
 * node done, including build_analysis).
 *
 * Shadow-gated paths (BLOCKED, REJECTED, MANUAL_REVIEW_REQUIRED →
 * PENDING_REVIEW / ESCALATED / cosign states) skip execute_recipe
 * (8) and apply_effects (9) but still run build_analysis (10) on the
 * terminal route. The renderer below handles that by marking those
 * two middle nodes as "skipped" while keeping build_analysis
 * "completed".
 */
const STATE_PROGRESS: Record<string, number> = {
  INGESTED: 0, CLASSIFYING: 1, AUDITING: 7,
  PENDING_REVIEW: 11, ESCALATED: 11,
  PENDING_ADMIN_REVIEW: 11, PENDING_COSIGN: 11,
  RESOLVED: 11, CLOSED: 11,
  FAILED: 9, BLOCKED: 11, REJECTED: 11,
};

const PIPELINE_NODES: PipelineNode[] = [
  "ingest", "classify", "load_skill", "validate_circuit_breaker",
  "select_recipe", "resolve_dependencies", "validate_types",
  "shadow_audit", "execute_recipe", "apply_effects",
  "build_analysis",
];

const FAILED_STATES = new Set(["FAILED"]);
const IN_PROGRESS_STATES = new Set(["CLASSIFYING", "AUDITING"]);
// Lifecycles where shadow blocks execution: shadow_audit ran, but
// execute_recipe + apply_effects were skipped. build_analysis still
// runs on the terminal route.
const SHADOW_GATED_TERMINAL_STATES = new Set([
  "BLOCKED", "REJECTED",
  "PENDING_REVIEW", "ESCALATED",
  "PENDING_ADMIN_REVIEW", "PENDING_COSIGN",
]);

/**
 * Compact display payload per pipeline node. Per Verdict 2026-04-22 /
 * Guardrail #6: every value rendered must come from the backend, never
 * synthesised. So this projects fields that are already on the
 * `ExceptionDetail` (lifecycle, recipe, verdict, final status) and on
 * the `OrderAnalysis` (LLM confidence) — both of which are produced by
 * the same `build_analysis` graph node. Returns ``undefined`` when the
 * authoritative field is absent — never a placeholder, never a
 * fallback. The WaterfallStepper handles the missing case.
 */
function buildNodeData(
  node: PipelineNode,
  exc: ExceptionDetail,
  analysis?: OrderAnalysis | null,
): Record<string, unknown> | undefined {
  switch (node) {
    case "classify": {
      if (!exc.intent) return undefined;
      // analysis.confidence is on a 0-100 scale (matches asoe2/api/schemas.py
      // AnalysisResponse.confidence). Normalise to 0-1 for the UI; omit the
      // confidence key entirely when the analysis hasn't loaded yet so the
      // step renders as "no value yet" rather than a fabricated number.
      const data: Record<string, unknown> = { intent: exc.intent };
      if (typeof analysis?.confidence === "number") {
        data.confidence = analysis.confidence / 100;
      }
      return data;
    }
    case "shadow_audit": return exc.shadow_verdict ? { shadow_verdict: exc.shadow_verdict } : undefined;
    case "select_recipe": return exc.selected_recipe ? { selected_recipe: exc.selected_recipe } : undefined;
    case "apply_effects": return exc.final_status ? { final_status: exc.final_status } : undefined;
    case "build_analysis": return exc.final_status ? { final_status: exc.final_status } : undefined;
    default: return undefined;
  }
}

/**
 * Project pipeline-node states for the WaterfallStepper from the
 * exception's current lifecycle_state, optionally enriched with the
 * `OrderAnalysis` payload for backend-authoritative values like
 * confidence.
 *
 * Pure. Does NOT synthesise step timings: per-node ``duration_ms``
 * comes back undefined unless the backend (a future
 * `TraceResponse.completed_nodes` projection) provides real
 * measurements. Showing random durations was a Verdict 2026-04-22 /
 * Guardrail #6 violation — the renderer now honestly displays nothing
 * in the place of timings we don't have.
 *
 * `trace` is currently unused; kept in the signature for the planned
 * extension where the trace payload carries real per-node timings +
 * data captured by ``api/events.py::PipelineProgressPayload``.
 */
export function buildNodeStates(
  exc: ExceptionDetail,
  _trace?: TraceResponse,
  analysis?: OrderAnalysis | null,
): NodeState[] {
  const completedUpTo = STATE_PROGRESS[exc.lifecycle_state] ?? 0;
  const isFailed = FAILED_STATES.has(exc.lifecycle_state);
  const isInProgress = IN_PROGRESS_STATES.has(exc.lifecycle_state);
  const isShadowGated = SHADOW_GATED_TERMINAL_STATES.has(exc.lifecycle_state);
  // Indices in PIPELINE_NODES that shadow-gated paths skip.
  const SKIPPED_ON_SHADOW_GATE = new Set([8, 9]); // execute_recipe, apply_effects

  return PIPELINE_NODES.map((node, i): NodeState => {
    // Shadow-gated terminal lifecycles: execute_recipe + apply_effects
    // are skipped but build_analysis still ran on the terminal route.
    if (isShadowGated && SKIPPED_ON_SHADOW_GATE.has(i)) {
      return { node, status: "skipped" };
    }
    if (i < completedUpTo) {
      return {
        node,
        status: "completed",
        // duration_ms intentionally omitted — backend doesn't expose
        // per-node timings via the analysis/detail payloads yet, and
        // synthesising one (e.g. Math.random()) violates Verdict
        // 2026-04-22 / Guardrail #6.
        data: buildNodeData(node, exc, analysis),
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
