/**
 * ExceptionDetailPanel — sidebar content for exception detail.
 * Section 11.5: AgentReasoningCard (Layer 1/2), WaterfallStepper.
 *
 * Renders inside the Sidebar component on the Exception Queue page.
 */
"use client";

import { useState, useEffect } from "react";
import { AgentReasoningCard } from "@/components/ui/AgentReasoningCard";
import { WaterfallStepper, type NodeState } from "@/components/ui/WaterfallStepper";
import { Badge, lifecycleVariant } from "@/components/ui/Badge";
import { exceptionsApi } from "@/lib/api";
import type { ExceptionDetail, ShadowVerdict, PipelineNode, TraceRecord } from "@/types/exceptions";
import type { TraceResponse } from "@/types/api";

interface ExceptionDetailPanelProps {
  exceptionId: string;
  onClose: () => void;
}

/** Build WaterfallStepper node states from exception + trace data */
function buildNodeStates(exc: ExceptionDetail, trace?: TraceResponse): NodeState[] {
  const NODES: PipelineNode[] = [
    "ingest", "classify", "load_skill", "validate_circuit_breaker",
    "shadow_audit", "select_recipe", "validate_types",
    "resolve_dependencies", "execute_recipe", "apply_effects",
  ];

  // Determine how far the pipeline progressed based on lifecycle state
  const stateProgress: Record<string, number> = {
    INGESTED: 0,
    CLASSIFYING: 1,
    AUDITING: 4,
    PENDING_REVIEW: 5,
    ESCALATED: 5,
    EXECUTING: 8,
    RESOLVED: 10,
    CLOSED: 10,
    FAILED: 8,
    BLOCKED: 5,
    REJECTED: 5,
  };

  const completedUpTo = stateProgress[exc.lifecycle_state] ?? 0;
  const isFailed = ["FAILED", "BLOCKED", "REJECTED"].includes(exc.lifecycle_state);
  const isInProgress = ["CLASSIFYING", "AUDITING", "EXECUTING"].includes(exc.lifecycle_state);

  return NODES.map((node, i): NodeState => {
    if (i < completedUpTo) {
      return {
        node,
        status: "completed",
        duration_ms: 200 + Math.round(Math.random() * 800), // Simulated
        data: buildNodeData(node, exc, trace),
      };
    }
    if (i === completedUpTo && isInProgress) {
      return { node, status: "started" };
    }
    if (i === completedUpTo && isFailed) {
      return { node, status: "failed" };
    }
    if (i > completedUpTo && isFailed) {
      return { node, status: "skipped" };
    }
    return { node, status: "pending" };
  });
}

function buildNodeData(node: PipelineNode, exc: ExceptionDetail, trace?: TraceResponse): Record<string, unknown> | undefined {
  switch (node) {
    case "classify":
      return exc.intent ? { intent: exc.intent, confidence: 0.92 } : undefined;
    case "shadow_audit":
      return exc.shadow_verdict ? { shadow_verdict: exc.shadow_verdict } : undefined;
    case "select_recipe":
      return exc.selected_recipe ? { selected_recipe: exc.selected_recipe } : undefined;
    case "apply_effects":
      return exc.final_status ? { final_status: exc.final_status } : undefined;
    default:
      return undefined;
  }
}

export default function ExceptionDetailPanel({ exceptionId, onClose }: ExceptionDetailPanelProps) {
  const [detail, setDetail] = useState<ExceptionDetail | null>(null);
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoading(true);
      try {
        const [excData, traceData] = await Promise.all([
          exceptionsApi.get(exceptionId),
          exceptionsApi.trace(exceptionId),
        ]);
        if (!cancelled) {
          setDetail(excData);
          setTrace(traceData);
        }
      } catch (err) {
        console.error("Failed to fetch exception detail:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, [exceptionId]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 60, borderRadius: "var(--radius-sm)" }} />
        ))}
      </div>
    );
  }

  if (!detail) {
    return (
      <p style={{ color: "var(--color-text-quaternary)", fontSize: "var(--font-size-body)" }}>
        Exception not found.
      </p>
    );
  }

  const nodeStates = buildNodeStates(detail, trace ?? undefined);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-20)" }}>
      {/* Header info */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-size-subhead)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
            }}
          >
            {detail.order_id}
          </span>
          <Badge variant={lifecycleVariant(detail.lifecycle_state)}>
            {detail.lifecycle_state.replace(/_/g, " ")}
          </Badge>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-8)",
            fontSize: "var(--font-size-caption)",
          }}
        >
          <div>
            <span style={{ color: "var(--color-text-quaternary)" }}>Event Type</span>
            <div style={{ color: "var(--color-text-secondary)", fontWeight: 500, marginTop: 2 }}>
              {detail.event_type.replace(/_/g, " ")}
            </div>
          </div>
          <div>
            <span style={{ color: "var(--color-text-quaternary)" }}>Tenant</span>
            <div style={{ color: "var(--color-text-secondary)", fontWeight: 500, marginTop: 2 }}>
              {detail.tenant_id}
            </div>
          </div>
          <div>
            <span style={{ color: "var(--color-text-quaternary)" }}>Created</span>
            <div style={{ color: "var(--color-text-secondary)", fontWeight: 500, marginTop: 2, fontFamily: "var(--font-mono)" }}>
              {new Date(detail.created_at).toLocaleString()}
            </div>
          </div>
          <div>
            <span style={{ color: "var(--color-text-quaternary)" }}>Updated</span>
            <div style={{ color: "var(--color-text-secondary)", fontWeight: 500, marginTop: 2, fontFamily: "var(--font-mono)" }}>
              {new Date(detail.updated_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Reasoning Card */}
      {detail.shadow_verdict && (
        <AgentReasoningCard
          verdict={detail.shadow_verdict as ShadowVerdict}
          intent={detail.intent ?? undefined}
          confidence={0.92}
          recipeName={detail.selected_recipe ?? undefined}
          explanation={trace?.explanation ?? "Deterministic execution completed successfully."}
          policyHits={trace?.shadow_policy_hits}
          trace={trace ? {
            trace_id: trace.trace_id,
            event_id: trace.event_id,
            skill_name: trace.skill_name,
            intent_selected: trace.intent_selected,
            shadow_verdict: trace.shadow_verdict,
            shadow_policy_hits: trace.shadow_policy_hits,
            recipe_name: trace.recipe_name,
            constrained_output_schemas: trace.constrained_output_schemas,
            gateway_calls: trace.gateway_calls,
            backend_fallback: trace.backend_fallback,
            is_fallback_generated: trace.is_fallback_generated,
            final_status: trace.final_status,
            explanation: trace.explanation,
          } : undefined}
          onApprove={() => console.log("Approve", exceptionId)}
          onReject={() => console.log("Reject", exceptionId)}
          onEscalate={() => console.log("Escalate", exceptionId)}
        />
      )}

      {/* Pipeline Waterfall */}
      <div>
        <h3
          style={{
            fontSize: "var(--font-size-subhead)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            margin: "0 0 var(--space-12)",
          }}
        >
          Pipeline Progress
        </h3>
        <WaterfallStepper
          nodes={nodeStates}
          intent={detail.intent ?? undefined}
        />
      </div>

      {/* Resolution Data */}
      {detail.resolution_data && Object.keys(detail.resolution_data).length > 0 && (
        <div>
          <h3
            style={{
              fontSize: "var(--font-size-subhead)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: "0 0 var(--space-8)",
            }}
          >
            Resolution Data
          </h3>
          <pre
            style={{
              background: "var(--color-surface-secondary)",
              padding: "var(--space-12)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--font-size-caption)",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-secondary)",
              overflow: "auto",
              margin: 0,
            }}
          >
            {JSON.stringify(detail.resolution_data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
