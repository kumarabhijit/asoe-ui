/**
 * ActivityIndicator — dynamic text replacing static labels.
 * Section 11.2: Node-specific, domain-aware messages — not generic "Loading..."
 *
 * Messages are defined in a node_activity_messages map selected based
 * on the current pipeline node + available GraphState data.
 */
"use client";

import type { PipelineNode } from "@/types/exceptions";
import type { CSSProperties } from "react";

interface ActivityIndicatorProps {
  node: PipelineNode;
  intent?: string;
  style?: CSSProperties;
}

/**
 * Node-specific activity messages — domain-aware, not generic.
 * Intent-aware variants are selected when intent is known.
 */
const NODE_MESSAGES: Record<PipelineNode, string | Record<string, string>> = {
  ingest: "Validating order event fields...",
  classify: "Classifying exception intent...",
  load_skill: {
    CONTRACTUAL_CORRECTION: "Loading pricing correction skill...",
    CREDIT_BLOCK: "Loading credit hold skill...",
    MASS_PRICING_ERROR: "Loading mass pricing skill...",
    DUPLICATE_PO: "Loading duplicate PO detection skill...",
    _default: "Loading skill definition...",
  },
  validate_circuit_breaker: "Checking circuit breaker thresholds...",
  shadow_audit: {
    CONTRACTUAL_CORRECTION: "Auditing price adjustment against compliance policies...",
    CREDIT_BLOCK: "Auditing credit exposure against policies...",
    MASS_PRICING_ERROR: "Auditing batch update against penalty matrix...",
    DUPLICATE_PO: "Auditing duplicate PO against compliance policies...",
    _default: "Running compliance shadow audit...",
  },
  select_recipe: "Selecting execution recipe...",
  validate_types: "Validating recipe parameters and policy thresholds...",
  resolve_dependencies: "Fetching gateway dependencies...",
  execute_recipe: {
    CONTRACTUAL_CORRECTION: "Executing price adjustment recipe...",
    CREDIT_BLOCK: "Executing credit hold release recipe...",
    MASS_PRICING_ERROR: "Executing mass pricing correction...",
    DUPLICATE_PO: "Executing duplicate PO detection...",
    _default: "Executing recipe...",
  },
  apply_effects: "Applying effects to external systems...",
};

function getMessage(node: PipelineNode, intent?: string): string {
  const entry = NODE_MESSAGES[node];
  if (typeof entry === "string") return entry;
  if (intent && intent in entry) return entry[intent];
  return entry._default;
}

export function ActivityIndicator({ node, intent, style }: ActivityIndicatorProps) {
  const message = getMessage(node, intent);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-6)",
        fontSize: "var(--font-size-caption)",
        color: "var(--color-text-tertiary)",
        fontWeight: 500,
        fontStyle: "italic",
        ...style,
      }}
    >
      <span
        className="agent-active-dot"
        style={{ width: 6, height: 6, flexShrink: 0 }}
      />
      {message}
    </span>
  );
}
