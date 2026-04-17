/**
 * WaterfallStepper — real-time pipeline progress driven by WebSocket events.
 * Section 11.2: Per-node execution progress visualization.
 *
 * Node states: Pending → In Progress → Completed / Failed
 * Uses ActivityIndicator for domain-aware loading messages.
 *
 * Replay mode (optional, props.allowReplay):
 *   When a pipeline has finished and every node carries a real duration_ms,
 *   the operator can click Replay to re-animate the *actual* trace timings.
 *   Unlike the prototype's simulated "watch the AI think" sub-steps, this
 *   plays back verifiable backend data only — the compliance-safe answer
 *   to the debated cognitive-theatre concern.
 *   Respects prefers-reduced-motion: when set, the replay button is hidden.
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X, Minus, RotateCcw, Pause } from "lucide-react";
import type { PipelineNode } from "@/types/exceptions";
import { ActivityIndicator } from "./ActivityIndicator";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export interface NodeState {
  node: PipelineNode;
  status: "pending" | "started" | "completed" | "failed" | "skipped";
  duration_ms?: number;
  data?: Record<string, unknown>;
}

interface WaterfallStepperProps {
  nodes: NodeState[];
  intent?: string;
  className?: string;
  /** When true and all nodes have real durations, shows a Replay control
   *  that animates the pipeline through its recorded timings. */
  allowReplay?: boolean;
}

const NODE_LABELS: Record<PipelineNode, string> = {
  ingest: "Ingest Event",
  classify: "Classify Intent",
  load_skill: "Load Skill",
  validate_circuit_breaker: "Circuit Breaker",
  shadow_audit: "Compliance Shadow",
  select_recipe: "Select Recipe",
  validate_types: "Validate Types",
  resolve_dependencies: "Resolve Dependencies",
  execute_recipe: "Execute Recipe",
  apply_effects: "Apply Effects",
};

const indicatorBase = "w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 transition-all duration-fast ease-out";

function NodeIndicator({ status }: { status: NodeState["status"] }) {
  switch (status) {
    case "completed":
      return <span className={cn(indicatorBase, "bg-success text-white")}><Check size={12} /></span>;
    case "failed":
      return <span className={cn(indicatorBase, "bg-error text-white")}><X size={12} /></span>;
    case "started":
      return (
        <span className={cn(indicatorBase, "bg-transparent border-2 border-brand relative")}>
          <span className="agent-active-dot w-2 h-2 absolute" />
        </span>
      );
    case "skipped":
      return (
        <span className={cn(indicatorBase, "bg-transparent border-2 border-dashed border-border-strong")}>
          <Minus size={10} className="text-text-quaternary" />
        </span>
      );
    default:
      return <span className={cn(indicatorBase, "bg-transparent border-2 border-border")} />;
  }
}

function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function dataSummary(node: PipelineNode, data?: Record<string, unknown>): string | null {
  if (!data) return null;
  switch (node) {
    case "classify":
      if (data.intent) return `Intent: ${data.intent}${data.confidence ? ` (${Math.round(Number(data.confidence) * 100)}%)` : ""}`;
      return null;
    case "shadow_audit":
      if (data.shadow_verdict) return `Verdict: ${data.shadow_verdict}`;
      return null;
    case "select_recipe":
      if (data.selected_recipe) return `Recipe: ${String(data.selected_recipe).replace(".py", "")}`;
      return null;
    case "apply_effects":
      if (data.final_status) return `Status: ${data.final_status}`;
      return null;
    default:
      return null;
  }
}

/** Replay pace divisor — we scale recorded durations down so the replay
 *  is watchable even for sub-second nodes, but we never stretch them. */
const REPLAY_PACE_DIVISOR = 3;
/** Minimum per-node dwell during replay, so ultra-fast nodes are still
 *  perceivable. */
const REPLAY_MIN_MS = 180;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function WaterfallStepper({ nodes, intent, className, allowReplay }: WaterfallStepperProps) {
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Replay is only meaningful when every node finished and we have real
  // timings to play back. Hide the button otherwise.
  const canReplay = useMemo(() => {
    if (!allowReplay) return false;
    if (prefersReducedMotion()) return false;
    return (
      nodes.length > 0
      && nodes.every((n) => n.status === "completed" || n.status === "skipped")
      && nodes.some((n) => (n.duration_ms ?? 0) > 0)
    );
  }, [allowReplay, nodes]);

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  useEffect(() => clearTimers, []);

  function startReplay() {
    clearTimers();
    setReplayIndex(0);
    let acc = 0;
    nodes.forEach((n, i) => {
      // Skipped nodes don't participate in the active dwell — but we still
      // advance past them quickly so the visible head stays meaningful.
      const dwell = n.status === "skipped"
        ? REPLAY_MIN_MS
        : Math.max(REPLAY_MIN_MS, Math.floor((n.duration_ms ?? 300) / REPLAY_PACE_DIVISOR));
      acc += dwell;
      timersRef.current.push(setTimeout(() => {
        // Advance past this node to the next one; when we pass the last
        // node, `replayIndex === nodes.length` = "replay finished".
        setReplayIndex(i + 1);
      }, acc));
    });
  }

  function stopReplay() {
    clearTimers();
    setReplayIndex(null);
  }

  // Synthesise node states during replay. Before the head index we show
  // completed/skipped as recorded; at the head we show `started`; after
  // the head we show pending. When replay has finished (index === length)
  // we're back to the real data.
  const displayNodes: NodeState[] = useMemo(() => {
    if (replayIndex === null || replayIndex >= nodes.length) return nodes;
    return nodes.map((n, i) => {
      if (i < replayIndex) {
        // Preserve the original terminal status so failed/skipped replays
        // show the real outcome, not a fake "completed".
        return n;
      }
      if (i === replayIndex) {
        return { ...n, status: "started" as const };
      }
      return { ...n, status: "pending" as const };
    });
  }, [nodes, replayIndex]);

  const isReplaying = replayIndex !== null && replayIndex < nodes.length;

  return (
    <div className={cn("flex flex-col", className)}>
      {canReplay && (
        <div className="flex justify-end mb-8">
          {isReplaying ? (
            <Button variant="ghost" size="sm" onClick={stopReplay}>
              <Pause size={12} className="mr-1" /> Stop
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={startReplay}
              title="Re-animate the pipeline using the recorded node timings"
            >
              <RotateCcw size={12} className="mr-1" /> Replay
            </Button>
          )}
        </div>
      )}
      {displayNodes.map((n, i) => {
        const isLast = i === displayNodes.length - 1;
        const summary = n.status === "completed" ? dataSummary(n.node, n.data) : null;

        return (
          <div key={n.node} className="flex gap-12">
            {/* Indicator + connector line */}
            <div className="flex flex-col items-center">
              <NodeIndicator status={n.status} />
              {!isLast && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-4 transition-colors duration-fast",
                    n.status === "completed" ? "bg-success"
                    : n.status === "failed" ? "bg-error"
                    : "bg-border",
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className={cn("flex-1", !isLast && "pb-8")}>
              <div className="flex items-center gap-8 min-h-[20px]">
                <span
                  className={cn(
                    "text-body transition-colors duration-fast",
                    n.status === "started" ? "font-semibold text-text-primary"
                    : n.status === "pending" || n.status === "skipped" ? "font-medium text-text-quaternary"
                    : "font-medium text-text-primary",
                  )}
                >
                  {NODE_LABELS[n.node]}
                </span>
                {n.duration_ms !== undefined && n.status === "completed" && (
                  <span className="text-label text-text-quaternary font-mono">
                    {formatDuration(n.duration_ms)}
                  </span>
                )}
              </div>

              {n.status === "started" && (
                <ActivityIndicator node={n.node} intent={intent} className="mt-4" />
              )}

              {summary && (
                <span className="block text-caption text-text-tertiary font-medium mt-px">
                  {summary}
                </span>
              )}

              {n.status === "failed" && (
                <span className="block text-caption text-error font-medium mt-px">
                  Node failed — subsequent nodes skipped
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
