/**
 * ActivityIndicator — dynamic text replacing static labels.
 * Section 11.2: Node-specific, domain-aware messages — not generic "Loading..."
 */
"use client";

import { cn } from "@/lib/utils";
import { intentLabelFor } from "@/config/erp-label-map";
import type { PipelineNode } from "@/types/exceptions";

interface ActivityIndicatorProps {
  node: PipelineNode;
  intent?: string;
  className?: string;
}

/**
 * Per-node progress copy. Intent-specialised nodes hold a template that
 * receives the *humanised* intent label, so the message stays domain-aware
 * (Guardrail #4) WITHOUT branching on hardcoded enum literals (Guardrail #2):
 * adding a new intent in asoe2 requires zero changes here. `label` is null
 * when no intent is known yet, falling back to neutral copy.
 */
type NodeMessage = string | ((label: string | null) => string);

const NODE_MESSAGES: Record<PipelineNode, NodeMessage> = {
  ingest: "Validating order event fields...",
  classify: "Classifying exception intent...",
  load_skill: (label) =>
    label ? `Loading ${label} skill...` : "Loading skill definition...",
  validate_circuit_breaker: "Checking circuit breaker thresholds...",
  shadow_audit: (label) =>
    label
      ? `Auditing ${label} against compliance policies...`
      : "Running compliance shadow audit...",
  select_recipe: "Selecting execution recipe...",
  validate_types: "Validating recipe parameters and policy thresholds...",
  resolve_dependencies: "Fetching gateway dependencies...",
  execute_recipe: (label) =>
    label ? `Executing ${label} recipe...` : "Executing recipe...",
  apply_effects: "Applying effects to external systems...",
  build_analysis: "Enforcing audit-bearing field coverage...",
};

function getMessage(node: PipelineNode, intent?: string): string {
  const entry = NODE_MESSAGES[node];
  if (typeof entry === "string") return entry;
  return entry(intent ? intentLabelFor(intent) : null);
}

export function ActivityIndicator({ node, intent, className }: ActivityIndicatorProps) {
  const message = getMessage(node, intent);

  return (
    <span className={cn("inline-flex items-center gap-6 text-caption text-text-tertiary font-medium italic", className)}>
      <span className="agent-active-dot w-1.5 h-1.5 shrink-0" />
      {message}
    </span>
  );
}
