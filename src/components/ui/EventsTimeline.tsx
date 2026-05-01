/**
 * EventsTimeline — operator-first executed-events list (ADR-027 Phase C).
 *
 * Renders ONLY the nodes that ran for a record's traversal, in
 * chronological order, with the halt point + reason emphasised. Skipped
 * nodes are not rendered; unreachable nodes are not rendered.
 *
 * Source of truth: `executed_nodes: ExecutedNode[]` from the trace
 * (or from a selected ReanalysisHistoryEntry). The hardcoded
 * PIPELINE_NODES + STATE_PROGRESS arrays are retired with this view —
 * Guardrail #2: no hardcoded enum values; node names come from the
 * trace itself.
 *
 * Replaces WaterfallStepper as the default Pipeline Progress surface.
 */
"use client";

import { Check, AlertTriangle, AlertOctagon, ChevronDown, Server } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ExecutedNode } from "@/types/api";

interface EventsTimelineProps {
  /** Ordered nodes that executed for this attempt. */
  executedNodes: ExecutedNode[];
  /** Final lifecycle status (e.g. "COMPLETE", "BLOCKED",
   *  "MANUAL_REVIEW_REQUIRED", "FAIL_TO_HUMAN") used to label the
   *  terminal row. Optional. */
  finalStatus?: string | null;
  /** Optional empty-state message override (e.g. for a pre-Phase-B
   *  reanalysis-history entry). */
  emptyMessage?: string;
  className?: string;
}

const indicatorBase =
  "w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 transition-all duration-fast ease-out";

/**
 * Map an ExecutedNode.status to an icon + color class. Status values
 * are constrained at the contract level (completed | halted | errored)
 * — this is a visual mapping, not business logic.
 */
function statusIndicator(status: ExecutedNode["status"]) {
  switch (status) {
    case "completed":
      return (
        <span className={cn(indicatorBase, "bg-success text-white")}>
          <Check size={12} />
        </span>
      );
    case "halted":
      return (
        <span className={cn(indicatorBase, "bg-warning text-white")}>
          <AlertTriangle size={12} />
        </span>
      );
    case "errored":
      return (
        <span className={cn(indicatorBase, "bg-error text-white")}>
          <AlertOctagon size={12} />
        </span>
      );
  }
}

/**
 * Visual variant for an exit_verdict pill. Verdict strings are open-set
 * (Guardrail #2: no closed mapping in JSX), so this returns a default
 * style and overlays GREEN/YELLOW/RED conventional colors when matched
 * — without branching on closed business strings. The default branch
 * means new verdict labels added in `_VERDICT_LABELS` ship as readable
 * neutral pills with no UI change.
 */
function verdictVariant(label: string): string {
  const l = label.toLowerCase();
  if (l === "green" || l === "ok") return "bg-success-subtle text-success";
  if (l === "yellow") return "bg-warning-subtle text-warning";
  if (
    l === "red"
    || l === "breach"
    || l === "no_recipe"
    || l === "required_gw_fail"
    || l === "invocation_fail"
    || l === "cross_check_disagreement"
  ) return "bg-error-subtle text-error";
  return "bg-surface-secondary text-text-tertiary";
}

/** Human-readable node label without a closed enum mapping. Title-cases
 *  snake_case and replaces underscores with spaces. */
function humanizeNode(id: string): string {
  return id
    .split("_")
    .map((p) => (p.length === 0 ? "" : p[0].toUpperCase() + p.slice(1)))
    .join(" ");
}

function fmtDuration(ms?: number): string | null {
  if (typeof ms !== "number") return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function isHaltOrError(node: ExecutedNode): boolean {
  return node.status === "halted" || node.status === "errored";
}

export function EventsTimeline({
  executedNodes,
  finalStatus,
  emptyMessage,
  className,
}: EventsTimelineProps) {
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
  const haltNode = haltIndex >= 0 ? executedNodes[haltIndex] : null;

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      {executedNodes.map((node, i) => {
        const isHalt = haltNode === node;
        return (
          <TimelineRow
            key={`${node.node}-${node.entered_at}-${i}`}
            node={node}
            isHalt={isHalt}
          />
        );
      })}
      {haltNode && finalStatus && (
        <div className="border-l-[3px] border-error pl-12 py-4 text-caption">
          <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-2">
            Halted at {humanizeNode(haltNode.node)}
          </div>
          <div className="text-text-secondary">
            Final status: <span className="font-mono">{finalStatus}</span>
            {haltNode.exit_verdict && (
              <>
                {" — "}
                <span className="font-mono">{haltNode.exit_verdict}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineRow({ node, isHalt }: { node: ExecutedNode; isHalt: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const duration = fmtDuration(node.duration_ms);
  const hasSubSpans = node.sub_spans && node.sub_spans.length > 0;
  const hasDecision =
    node.decision && Object.keys(node.decision).length > 0;
  const expandable = hasSubSpans || hasDecision;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-sm",
        isHalt && "bg-error-subtle/40 px-10 py-8",
      )}
    >
      <button
        type="button"
        onClick={() => expandable && setExpanded((v) => !v)}
        className={cn(
          "flex items-center gap-10 bg-transparent border-none p-0 text-left",
          expandable && "cursor-pointer",
        )}
        aria-expanded={expandable ? expanded : undefined}
      >
        {statusIndicator(node.status)}
        <span className="text-caption font-semibold text-text-primary">
          {humanizeNode(node.node)}
        </span>
        {duration && (
          <span className="text-label font-mono text-text-tertiary">
            {duration}
          </span>
        )}
        {node.exit_verdict && (
          <span
            className={cn(
              "text-label font-semibold px-6 py-px rounded-full font-mono",
              verdictVariant(node.exit_verdict),
            )}
          >
            {node.exit_verdict}
          </span>
        )}
        {node.policy_hits && node.policy_hits.length > 0 && (
          <span className="text-label text-text-tertiary">
            {node.policy_hits.length}{" "}
            {node.policy_hits.length === 1 ? "policy hit" : "policy hits"}
          </span>
        )}
        {expandable && (
          <ChevronDown
            size={12}
            className={cn(
              "ml-auto text-text-tertiary transition-transform duration-fast",
              !expanded && "-rotate-90",
            )}
          />
        )}
      </button>
      {expanded && (
        <div className="pl-30 flex flex-col gap-8">
          {hasDecision && (
            <DecisionPayload decision={node.decision} />
          )}
          {node.policy_hits.length > 0 && (
            <PolicyHits hits={node.policy_hits} />
          )}
          {hasSubSpans && (
            <SubSpansList spans={node.sub_spans} />
          )}
        </div>
      )}
    </div>
  );
}

function DecisionPayload({ decision }: { decision: Record<string, unknown> }) {
  return (
    <div>
      <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
        Decision
      </div>
      <pre className="m-0 px-10 py-6 rounded-sm bg-surface-secondary text-label font-mono text-text-secondary overflow-auto">
        {JSON.stringify(decision, null, 2)}
      </pre>
    </div>
  );
}

function PolicyHits({ hits }: { hits: string[] }) {
  return (
    <div>
      <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
        Policy hits
      </div>
      <ul className="list-disc pl-20 m-0 flex flex-col gap-2">
        {hits.map((h, i) => (
          <li
            key={i}
            className="text-label text-text-secondary font-mono"
          >
            {h}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubSpansList({
  spans,
}: {
  spans: ExecutedNode["sub_spans"];
}) {
  return (
    <div>
      <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
        Gateway calls
      </div>
      <div className="flex flex-col gap-4">
        {spans.map((s, i) => (
          <div
            key={`${s.gateway}-${s.started_at}-${i}`}
            className="flex items-center gap-8 text-label"
          >
            <Server size={11} className="text-text-tertiary" />
            <span className="font-mono text-text-secondary">{s.gateway}</span>
            {typeof s.duration_ms === "number" && (
              <span className="font-mono text-text-tertiary">
                {fmtDuration(s.duration_ms)}
              </span>
            )}
            <span
              className={cn(
                "font-mono px-4 py-px rounded-full",
                s.status === "ok"
                  ? "bg-success-subtle text-success"
                  : s.status === "timeout"
                  ? "bg-warning-subtle text-warning"
                  : "bg-error-subtle text-error",
              )}
            >
              {s.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
