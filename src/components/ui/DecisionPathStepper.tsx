/**
 * DecisionPathStepper — the agent's reasoning as a numbered path
 * (cockpit study, council 2026-06-10).
 *
 * An at-a-glance, additive projection of the SAME `executed_nodes` the
 * EventsTimeline renders, recast as an ordered "1 → 2 → 3" decision path
 * so the operator reads the reconstruction as a sequence of steps the
 * agents took (classify → shadow → recipe → effects) rather than a flat
 * list. It is a THIRD Pipeline view alongside Timeline and DAG — it adds,
 * it never hides (Guardrail #7); the detailed Timeline stays one click
 * away for per-node decisions, sub-spans, and policy hits.
 *
 * Pure projector (Guardrail #6): node names + statuses + verdicts come
 * straight from the trace; no client-side composition, no fabricated
 * steps. Node-name humanisation and status→icon are visual mappings with
 * default branches (Guardrail #1/#2: open-set, no enum gate).
 *
 * Accessibility: an ordered list (`<ol>`/`<li>`) so the path's sequence
 * is conveyed structurally; every step carries an icon AND a text status
 * (never colour alone — WCAG 1.4.1).
 */
"use client";

import { Check, AlertTriangle, AlertOctagon, Circle, ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { humanizeNodeId } from "@/lib/format";
import type { ExecutedNode } from "@/types/api";

interface DecisionPathStepperProps {
  /** Ordered nodes that executed for this attempt (trace.executed_nodes). */
  executedNodes: ExecutedNode[];
  /** Final lifecycle status used to label the terminal chip. Optional. */
  finalStatus?: string | null;
  /** Optional empty-state message override (parity with EventsTimeline). */
  emptyMessage?: string;
  className?: string;
}

const stepIndexBase =
  "w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 text-label font-bold font-mono";

/**
 * Status → icon + text label + tone. Status is constrained at the
 * contract (completed | halted | errored); the default branch keeps a
 * new status readable (mirrors EventsTimeline.statusIndicator). The text
 * label is what carries meaning for screen readers + colour-blind users.
 */
function stepStatus(status: ExecutedNode["status"]): {
  icon: typeof Check;
  label: string;
  tone: string;
} {
  switch (status) {
    case "completed":
      return { icon: Check, label: "completed", tone: "text-success" };
    case "halted":
      return { icon: AlertTriangle, label: "halted", tone: "text-warning" };
    case "errored":
      return { icon: AlertOctagon, label: "errored", tone: "text-error" };
    default:
      return { icon: Circle, label: status ?? "ran", tone: "text-text-tertiary" };
  }
}

function isHaltOrError(node: ExecutedNode): boolean {
  return node.status === "halted" || node.status === "errored";
}

export function DecisionPathStepper({
  executedNodes,
  finalStatus,
  emptyMessage,
  className,
}: DecisionPathStepperProps) {
  if (!executedNodes || executedNodes.length === 0) {
    return (
      <div
        className={cn(
          "px-12 py-16 rounded-sm bg-surface-secondary text-caption text-text-tertiary",
          className,
        )}
      >
        {emptyMessage ??
          "Executed-path evidence not available — entry pre-dates per-node tracking."}
      </div>
    );
  }

  const haltIndex = executedNodes.findIndex(isHaltOrError);

  return (
    <ol
      aria-label="Decision path"
      className={cn("flex flex-wrap items-stretch gap-y-8 list-none p-0 m-0", className)}
    >
      {executedNodes.map((node, i) => {
        const st = stepStatus(node.status);
        const Icon = st.icon;
        const isHalt = i === haltIndex;
        return (
          <Fragment key={`${node.node}-${node.entered_at}-${i}`}>
            <li
              className={cn(
                "flex items-center gap-8 rounded-md px-10 py-6 border",
                isHalt
                  ? "border-error/40 bg-error-subtle/40"
                  : "border-border-subtle bg-surface-primary",
              )}
            >
              {/* 1-based step index — the "path" affordance. */}
              <span
                className={cn(
                  stepIndexBase,
                  isHalt
                    ? "bg-error text-white"
                    : "bg-surface-secondary text-text-tertiary",
                )}
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="flex flex-col">
                <span className="text-caption font-semibold text-text-primary leading-tight">
                  {humanizeNodeId(node.node)}
                </span>
                <span className={cn("flex items-center gap-4 text-label", st.tone)}>
                  <Icon size={11} aria-hidden />
                  {/* text status — never colour alone (WCAG 1.4.1) */}
                  <span className="capitalize">{st.label}</span>
                  {node.exit_verdict && (
                    <span className="font-mono text-text-tertiary">
                      · {node.exit_verdict}
                    </span>
                  )}
                </span>
              </span>
            </li>
            {i < executedNodes.length - 1 && (
              <li
                aria-hidden
                className="flex items-center px-2 text-text-quaternary self-center"
              >
                <ChevronRight size={14} />
              </li>
            )}
          </Fragment>
        );
      })}
      {finalStatus && (
        <li
          className="flex items-center gap-6 self-center ml-4 px-10 py-6 rounded-md bg-surface-secondary"
          aria-label={`Final status ${finalStatus}`}
        >
          <span className="text-label font-bold uppercase tracking-wider text-text-quaternary">
            Result
          </span>
          <span className="text-caption font-mono font-semibold text-text-primary">
            {finalStatus}
          </span>
        </li>
      )}
    </ol>
  );
}
