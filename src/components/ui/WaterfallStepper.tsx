/**
 * WaterfallStepper — real-time pipeline progress driven by WebSocket events.
 * Section 11.2: Per-node execution progress visualization.
 *
 * Node states: Pending → In Progress → Completed / Failed
 * Uses ActivityIndicator for domain-aware loading messages.
 */
"use client";

import { Check, X, Minus } from "lucide-react";
import type { PipelineNode } from "@/types/exceptions";
import { ActivityIndicator } from "./ActivityIndicator";
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

const indicatorBase = "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-fast ease-out";

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

export function WaterfallStepper({ nodes, intent, className }: WaterfallStepperProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {nodes.map((n, i) => {
        const isLast = i === nodes.length - 1;
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
              <div className="flex items-center gap-8 min-h-5">
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
