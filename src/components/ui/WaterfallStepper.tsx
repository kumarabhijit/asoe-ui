/**
 * WaterfallStepper — real-time pipeline progress driven by WebSocket events.
 * Section 11.2: Per-node execution progress visualization.
 *
 * Node states: Pending → In Progress → Completed / Failed
 * Uses ActivityIndicator for domain-aware loading messages.
 */
"use client";

import { Check, X, Minus } from "lucide-react";
import type { PipelineNode, NodeStatus } from "@/types/exceptions";
import { ActivityIndicator } from "./ActivityIndicator";
import type { CSSProperties } from "react";

export interface NodeState {
  node: PipelineNode;
  status: "pending" | "started" | "completed" | "failed" | "skipped";
  duration_ms?: number;
  data?: Record<string, unknown>;
}

interface WaterfallStepperProps {
  nodes: NodeState[];
  intent?: string;
  style?: CSSProperties;
}

/** Human-readable node labels */
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

function NodeIndicator({ status }: { status: NodeState["status"] }) {
  const size = 20;
  const shared: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "var(--radius-full)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all var(--dur-fast) var(--ease-out)",
  };

  switch (status) {
    case "completed":
      return (
        <span style={{ ...shared, background: "var(--color-success)", color: "#fff" }}>
          <Check size={12} />
        </span>
      );
    case "failed":
      return (
        <span style={{ ...shared, background: "var(--color-error)", color: "#fff" }}>
          <X size={12} />
        </span>
      );
    case "started":
      return (
        <span
          style={{
            ...shared,
            background: "transparent",
            border: "2px solid var(--color-brand)",
            position: "relative",
          }}
        >
          <span
            className="agent-active-dot"
            style={{ width: 8, height: 8, position: "absolute" }}
          />
        </span>
      );
    case "skipped":
      return (
        <span
          style={{
            ...shared,
            background: "transparent",
            border: "2px dashed var(--color-border-strong)",
          }}
        >
          <Minus size={10} color="var(--color-text-quaternary)" />
        </span>
      );
    default: // pending
      return (
        <span
          style={{
            ...shared,
            background: "transparent",
            border: "2px solid var(--color-border-default)",
          }}
        />
      );
  }
}

function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Format data summary for completed nodes */
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

export function WaterfallStepper({ nodes, intent, style }: WaterfallStepperProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        ...style,
      }}
    >
      {nodes.map((n, i) => {
        const isLast = i === nodes.length - 1;
        const summary = n.status === "completed" ? dataSummary(n.node, n.data) : null;

        return (
          <div key={n.node} style={{ display: "flex", gap: "var(--space-12)" }}>
            {/* Indicator + connector line */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0,
              }}
            >
              <NodeIndicator status={n.status} />
              {!isLast && (
                <div
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 16,
                    background:
                      n.status === "completed"
                        ? "var(--color-success)"
                        : n.status === "failed"
                        ? "var(--color-error)"
                        : "var(--color-border-default)",
                    transition: "background var(--dur-fast)",
                  }}
                />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : "var(--space-8)" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-8)",
                  minHeight: 20,
                }}
              >
                <span
                  style={{
                    fontSize: "var(--font-size-body)",
                    fontWeight: n.status === "started" ? 600 : 500,
                    color:
                      n.status === "pending" || n.status === "skipped"
                        ? "var(--color-text-quaternary)"
                        : "var(--color-text-primary)",
                    transition: "color var(--dur-fast)",
                  }}
                >
                  {NODE_LABELS[n.node]}
                </span>
                {n.duration_ms !== undefined && n.status === "completed" && (
                  <span
                    className="mono-sm"
                    style={{
                      fontSize: "var(--font-size-label)",
                      color: "var(--color-text-quaternary)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {formatDuration(n.duration_ms)}
                  </span>
                )}
              </div>

              {/* Activity indicator for in-progress nodes */}
              {n.status === "started" && (
                <ActivityIndicator
                  node={n.node}
                  intent={intent}
                  className="mt-4"
                />
              )}

              {/* Data summary for completed nodes */}
              {summary && (
                <span
                  style={{
                    display: "block",
                    fontSize: "var(--font-size-caption)",
                    color: "var(--color-text-tertiary)",
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  {summary}
                </span>
              )}

              {/* Error for failed nodes */}
              {n.status === "failed" && (
                <span
                  style={{
                    display: "block",
                    fontSize: "var(--font-size-caption)",
                    color: "var(--color-error)",
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
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
