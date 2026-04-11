/**
 * ExceptionDetailPanel — sidebar content for exception detail.
 * Section 11.5: AgentReasoningCard (Layer 1/2), WaterfallStepper,
 * plus enriched order summary, line selector, and PricingWaterfall
 * adapted from samples/asoe-sample-screen.jsx.
 *
 * Renders inside the Sidebar component on the Exception Queue page.
 */
"use client";

import { useState, useEffect } from "react";
import { FileText, Package } from "lucide-react";
import { AgentReasoningCard } from "@/components/ui/AgentReasoningCard";
import { WaterfallStepper, type NodeState } from "@/components/ui/WaterfallStepper";
import { PricingWaterfall } from "@/components/ui/PricingWaterfall";
import { Badge, lifecycleVariant, rootCauseVariant } from "@/components/ui/Badge";
import { exceptionsApi } from "@/lib/api";
import type {
  ExceptionDetail,
  ShadowVerdict,
  PipelineNode,
  LineItem,
  OrderAnalysis,
} from "@/types/exceptions";
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
        duration_ms: 200 + Math.round(Math.random() * 800),
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

function fmtPrice(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ExceptionDetailPanel({ exceptionId, onClose }: ExceptionDetailPanelProps) {
  const [detail, setDetail] = useState<ExceptionDetail | null>(null);
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [analysis, setAnalysis] = useState<OrderAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("evidence");

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      setLoading(true);
      try {
        const [excData, traceData, items, analysisData] = await Promise.all([
          exceptionsApi.get(exceptionId),
          exceptionsApi.trace(exceptionId),
          exceptionsApi.lineItems(exceptionId),
          exceptionsApi.orderAnalysis(exceptionId),
        ]);
        if (!cancelled) {
          setDetail(excData);
          setTrace(traceData);
          setLineItems(items);
          setAnalysis(analysisData);
          if (analysisData?.lines?.[0]) {
            setSelectedLine(analysisData.lines[0].line_id);
          } else if (items[0]) {
            setSelectedLine(items[0].line_id);
          }
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
  const selectedAnalysis = analysis?.lines?.find((l) => l.line_id === selectedLine);

  // Compute line-item totals
  const totalErp = lineItems.reduce((s, l) => s + l.erp_price * l.quantity, 0);
  const totalPo = lineItems.reduce((s, l) => s + l.po_price * l.quantity, 0);
  const delta = totalPo - totalErp;

  const DETAIL_TABS = [
    { id: "evidence", label: "Evidence" },
    { id: "sap", label: "SAP Data" },
    { id: "changes", label: "Change Analysis" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-20)" }}>
      {/* Order Summary Card */}
      <div
        style={{
          background: "var(--color-surface-primary)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-sm)",
          padding: "var(--space-16)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-12)", marginBottom: "var(--space-12)" }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-sm)",
              background: "var(--color-text-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Package size={20} color="var(--color-text-inverse)" />
          </div>
          <div style={{ flex: 1 }}>
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
                fontSize: "var(--font-size-caption)",
                color: "var(--color-text-tertiary)",
                marginTop: "var(--space-2)",
              }}
            >
              {detail.event_type.replace(/_/g, " ")} · {detail.tenant_id}
            </div>
          </div>
        </div>

        {/* 4-metric mini-grid */}
        {lineItems.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
              gap: "var(--space-8)",
              marginBottom: "var(--space-12)",
            }}
          >
            <MiniMetric label="Lines" value={String(lineItems.length)} />
            <MiniMetric label="ERP Total" value={fmtPrice(totalErp)} />
            <MiniMetric label="PO Total" value={fmtPrice(totalPo)} />
            <MiniMetric
              label="Delta"
              value={fmtPrice(Math.abs(delta))}
              color={delta !== 0 ? "var(--color-error)" : undefined}
            />
          </div>
        )}

        {/* Diagnosis */}
        {analysis && (
          <div
            style={{
              borderLeft: "3px solid var(--color-brand)",
              paddingLeft: "var(--space-12)",
              fontSize: "var(--font-size-caption)",
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {analysis.diagnosis}
          </div>
        )}

        {/* Metadata grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "var(--space-8)",
            fontSize: "var(--font-size-caption)",
            marginTop: "var(--space-12)",
          }}
        >
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
          confidence={analysis?.confidence ? analysis.confidence / 100 : 0.92}
          recipeName={detail.selected_recipe ?? undefined}
          explanation={trace?.explanation ?? analysis?.diagnosis ?? "Deterministic execution completed successfully."}
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

      {/* Line-Item Selector */}
      {lineItems.length > 0 && analysis && analysis.lines.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: "var(--font-size-caption)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--color-text-tertiary)",
              margin: "0 0 var(--space-8)",
            }}
          >
            Select Line Item
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-6)" }}>
            {lineItems.map((item) => {
              const lineAnalysis = analysis.lines.find((l) => l.line_id === item.line_id);
              const isSelected = selectedLine === item.line_id;
              return (
                <button
                  key={item.line_id}
                  onClick={() => setSelectedLine(item.line_id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-6)",
                    padding: "var(--space-6) var(--space-12)",
                    borderRadius: "var(--radius-full)",
                    border: isSelected
                      ? "2px solid var(--color-brand)"
                      : "1px solid var(--color-border-default)",
                    background: isSelected ? "var(--color-brand-subtle)" : "var(--color-surface-primary)",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--font-size-caption)",
                    transition: "all var(--dur-fast)",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-text-primary)" }}>
                    {item.line_id}
                  </span>
                  <span style={{ color: "var(--color-text-tertiary)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.description}
                  </span>
                  {lineAnalysis && (
                    <Badge variant={rootCauseVariant(item.root_cause)} size="sm" icon={null}>
                      {lineAnalysis.risk}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pricing Waterfall */}
      {selectedAnalysis && selectedAnalysis.waterfall.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "var(--space-8)",
            }}
          >
            <h3
              style={{
                fontSize: "var(--font-size-subhead)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "var(--space-6)",
              }}
            >
              <FileText size={14} color="var(--color-text-tertiary)" />
              ERP Pricing Waterfall
            </h3>
            <span
              style={{
                fontSize: "var(--font-size-label)",
                color: "var(--color-text-tertiary)",
                background: "var(--color-surface-secondary)",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
              }}
            >
              {selectedAnalysis.waterfall.length} step{selectedAnalysis.waterfall.length !== 1 ? "s" : ""}
            </span>
          </div>
          <PricingWaterfall steps={selectedAnalysis.waterfall} />
        </div>
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

      {/* Detail Tabs */}
      <div>
        <div
          style={{
            display: "flex",
            gap: "var(--space-4)",
            borderBottom: "1px solid var(--color-border-default)",
            marginBottom: "var(--space-12)",
          }}
        >
          {DETAIL_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDetailTab(tab.id)}
              style={{
                padding: "var(--space-6) var(--space-12)",
                background: "none",
                border: "none",
                borderBottom: detailTab === tab.id ? "2px solid var(--color-brand)" : "2px solid transparent",
                cursor: "pointer",
                fontSize: "var(--font-size-caption)",
                fontWeight: detailTab === tab.id ? 600 : 400,
                color: detailTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                fontFamily: "var(--font-sans)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {detailTab === "evidence" && trace && (
          <div style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-secondary)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
              <TraceField label="Trace ID" value={trace.trace_id} mono />
              <TraceField label="Skill" value={trace.skill_name} />
              <TraceField label="Intent" value={trace.intent_selected} />
              <TraceField label="Shadow Verdict" value={trace.shadow_verdict} />
              {trace.shadow_policy_hits.length > 0 && (
                <TraceField label="Policy Hits" value={trace.shadow_policy_hits.join(", ")} />
              )}
              <TraceField label="Recipe" value={trace.recipe_name} />
              {trace.gateway_calls.length > 0 && (
                <TraceField label="Gateway Calls" value={trace.gateway_calls.join(", ")} />
              )}
              <TraceField label="Final Status" value={trace.final_status} />
            </div>
          </div>
        )}

        {detailTab === "sap" && (
          <div style={{ color: "var(--color-text-quaternary)", fontSize: "var(--font-size-caption)", fontStyle: "italic" }}>
            SAP condition records and master data — coming soon.
          </div>
        )}
        {detailTab === "changes" && (
          <div style={{ color: "var(--color-text-quaternary)", fontSize: "var(--font-size-caption)", fontStyle: "italic" }}>
            Change analysis and audit diff — coming soon.
          </div>
        )}
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

/* ── Helper components ────────────────────────────────────────────── */

function MiniMetric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: "var(--font-size-label)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--color-text-quaternary)",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--font-size-body)",
          fontWeight: 700,
          color: color ?? "var(--color-text-primary)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TraceField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <span style={{ color: "var(--color-text-quaternary)", fontSize: "var(--font-size-label)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <div
        style={{
          color: "var(--color-text-secondary)",
          marginTop: 2,
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          fontSize: "var(--font-size-caption)",
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}
