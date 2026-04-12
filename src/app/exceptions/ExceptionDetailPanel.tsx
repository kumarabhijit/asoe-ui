/**
 * ExceptionDetailPanel — Right pane of the three-pane "Outlook" layout.
 *
 * Structured into four sections per the master-detail specification:
 *   A — Agent Analysis  (confidence score, intent/recipe mapping)
 *   B — Pipeline Progress  (vertical stepper: Ingest → Compliance Shadow)
 *   C — AI Narrative & Order Details  (line items, pricing waterfall)
 *   D — Evidence & Next Steps  (trace tabs, resolution data)
 *
 * Sticky header shows: SO ID, Total Value, lifecycle badge, and the
 * compliance-gated "Execute Recipe" button (disabled until Compliance
 * Shadow returns GREEN or YELLOW verdict).
 *
 * Data fetching: receives exceptionId from parent. Fetches detail,
 * trace, line items, and order analysis in parallel on mount.
 */
"use client";

import { useState, useEffect } from "react";
import { FileText, Package, Play, AlertTriangle } from "lucide-react";
import { AgentReasoningCard } from "@/components/ui/AgentReasoningCard";
import { WaterfallStepper, type NodeState } from "@/components/ui/WaterfallStepper";
import { PricingWaterfall } from "@/components/ui/PricingWaterfall";
import { Badge, lifecycleVariant, rootCauseVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
  /** Optional — used in full-page view for back navigation */
  onClose?: () => void;
}

/* ── Pipeline node state builder ─────────────────────────────────────── */

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

function buildNodeData(
  node: PipelineNode,
  exc: ExceptionDetail,
  _trace?: TraceResponse,
): Record<string, unknown> | undefined {
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

/* ── Component ───────────────────────────────────────────────────────── */

export default function ExceptionDetailPanel({ exceptionId, onClose }: ExceptionDetailPanelProps) {
  const [detail, setDetail] = useState<ExceptionDetail | null>(null);
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [analysis, setAnalysis] = useState<OrderAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("evidence");

  /* ── Actions ─────────────────────────────────────────────────────── */

  async function handleApprove(comment: string) {
    setActionLoading(true);
    try {
      const updated = await exceptionsApi.approve(exceptionId, { notes: comment || undefined });
      setDetail(updated);
    } catch (err) {
      console.error("Approve failed:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(comment: string) {
    setActionLoading(true);
    try {
      const updated = await exceptionsApi.reject(exceptionId, { reason: comment || "Rejected by reviewer" });
      setDetail(updated);
    } catch (err) {
      console.error("Reject failed:", err);
    } finally {
      setActionLoading(false);
    }
  }

  function handleEscalate() {
    console.log("Escalate", exceptionId);
  }

  /* ── Data Fetching ───────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    async function fetchDetail() {
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
    fetchDetail();
    return () => { cancelled = true; };
  }, [exceptionId]);

  /* ── Loading / Empty states ──────────────────────────────────────── */

  if (loading) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "var(--space-16)",
            borderBottom: "1px solid var(--color-border-default)",
            background: "var(--color-surface-primary)",
          }}
        >
          <div className="skeleton" style={{ height: 20, width: 200, borderRadius: "var(--radius-sm)" }} />
        </div>
        <div style={{ flex: 1, padding: "var(--space-16)", display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: "var(--radius-sm)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-quaternary)",
          fontSize: "var(--font-size-body)",
        }}
      >
        Exception not found.
      </div>
    );
  }

  /* ── Derived values ──────────────────────────────────────────────── */

  const nodeStates = buildNodeStates(detail, trace ?? undefined);
  const selectedAnalysis = analysis?.lines?.find((l) => l.line_id === selectedLine);
  const totalErp = lineItems.reduce((s, l) => s + l.erp_price * l.quantity, 0);
  const totalPo = lineItems.reduce((s, l) => s + l.po_price * l.quantity, 0);
  const delta = totalPo - totalErp;

  // Pro-tip: Execute Recipe gated by Compliance Shadow verdict
  const canExecuteRecipe = detail.shadow_verdict === "GREEN" || detail.shadow_verdict === "YELLOW";

  const DETAIL_TABS = [
    { id: "evidence", label: "Evidence" },
    { id: "sap", label: "SAP Data" },
    { id: "changes", label: "Change Analysis" },
  ];

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)" }}>

      {/* ━━ Sticky Header ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div
        style={{
          padding: "var(--space-12) var(--space-16)",
          borderBottom: "1px solid var(--color-border-default)",
          background: "var(--color-surface-primary)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-10)", minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-sm)",
              background: "var(--color-text-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Package size={16} color="var(--color-text-inverse)" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)", flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  fontSize: "var(--font-size-subhead)",
                  color: "var(--color-text-primary)",
                }}
              >
                {detail.order_id}
              </span>
              <Badge variant={lifecycleVariant(detail.lifecycle_state)} size="sm">
                {detail.lifecycle_state.replace(/_/g, " ")}
              </Badge>
            </div>
            <div style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-tertiary)", marginTop: 2 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-text-primary)" }}>
                {fmtPrice(totalPo)}
              </span>
              {delta !== 0 && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    color: "var(--color-error)",
                    marginLeft: "var(--space-6)",
                  }}
                >
                  {"\u0394"} {fmtPrice(Math.abs(delta))}
                </span>
              )}
              <span style={{ marginLeft: "var(--space-6)" }}>
                {" \u00B7 "}{detail.event_type.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>

        {/* Execute Recipe (compliance-gated) */}
        <Button
          variant="brand"
          size="sm"
          disabled={!canExecuteRecipe}
          title={
            canExecuteRecipe
              ? "Execute the selected recipe"
              : "Requires Compliance Shadow approval (GREEN or YELLOW verdict)"
          }
        >
          <Play size={14} />
          Execute Recipe
        </Button>
      </div>

      {/* ━━ Scrollable Body ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ flex: 1, overflow: "auto", padding: "var(--space-16)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-20)" }}>

          {/* ── Section A: Agent Analysis ──────────────────────────────── */}
          <section>
            <SectionLabel letter="A" title="Agent Analysis" />
            {detail.shadow_verdict ? (
              <AgentReasoningCard
                verdict={detail.shadow_verdict as ShadowVerdict}
                intent={detail.intent ?? undefined}
                confidence={analysis?.confidence ? analysis.confidence / 100 : 0.92}
                recipeName={detail.selected_recipe ?? undefined}
                explanation={
                  trace?.explanation ?? analysis?.diagnosis ?? "Deterministic execution completed successfully."
                }
                policyHits={trace?.shadow_policy_hits}
                trace={
                  trace
                    ? {
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
                      }
                    : undefined
                }
                onApprove={handleApprove}
                onReject={handleReject}
                onEscalate={handleEscalate}
                actionLoading={actionLoading}
              />
            ) : (
              <div
                style={{
                  padding: "var(--space-16)",
                  background: "var(--color-surface-primary)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-sm)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-8)",
                  fontSize: "var(--font-size-caption)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                <AlertTriangle size={14} />
                Agent analysis pending — Compliance Shadow has not yet completed.
              </div>
            )}
          </section>

          {/* ── Section B: Pipeline Progress ───────────────────────────── */}
          <section>
            <SectionLabel letter="B" title="Pipeline Progress" />
            <WaterfallStepper
              nodes={nodeStates}
              intent={detail.intent ?? undefined}
            />

            {/* Compliance Shadow verdict callout */}
            {detail.shadow_verdict && (
              <div
                style={{
                  marginTop: "var(--space-8)",
                  padding: "var(--space-8) var(--space-12)",
                  borderRadius: "var(--radius-sm)",
                  background:
                    detail.shadow_verdict === "GREEN"
                      ? "var(--color-success-subtle)"
                      : detail.shadow_verdict === "YELLOW"
                        ? "var(--color-warning-subtle)"
                        : "var(--color-error-subtle)",
                  border: `1px solid ${
                    detail.shadow_verdict === "GREEN"
                      ? "var(--color-success-border)"
                      : detail.shadow_verdict === "YELLOW"
                        ? "var(--color-warning-border)"
                        : "var(--color-error-border)"
                  }`,
                  fontSize: "var(--font-size-caption)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-6)",
                }}
              >
                <span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "var(--font-size-label)" }}>
                  Compliance Shadow
                </span>
                <Badge
                  variant={
                    detail.shadow_verdict === "GREEN"
                      ? "success"
                      : detail.shadow_verdict === "YELLOW"
                        ? "warning"
                        : "error"
                  }
                  size="sm"
                >
                  {detail.shadow_verdict}
                </Badge>
                <span style={{ color: "var(--color-text-secondary)" }}>
                  {detail.shadow_verdict === "GREEN" && "— Approved for execution"}
                  {detail.shadow_verdict === "YELLOW" && "— Approved with review"}
                  {detail.shadow_verdict === "RED" && "— Blocked by policy"}
                </span>
              </div>
            )}
          </section>

          {/* ── Section C: AI Narrative & Order Details ─────────────────── */}
          <section>
            <SectionLabel letter="C" title="AI Narrative & Order Details" />

            {/* Diagnosis callout */}
            {analysis && (
              <div
                style={{
                  borderLeft: "3px solid var(--color-brand)",
                  paddingLeft: "var(--space-12)",
                  fontSize: "var(--font-size-body)",
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.6,
                  marginBottom: "var(--space-12)",
                }}
              >
                {analysis.diagnosis}
              </div>
            )}

            {/* Order metrics mini-grid */}
            {lineItems.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: "var(--space-8)",
                  marginBottom: "var(--space-12)",
                  padding: "var(--space-12)",
                  background: "var(--color-surface-primary)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-xs)",
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

            {/* Line-Item Selector */}
            {lineItems.length > 0 && analysis && analysis.lines.length > 0 && (
              <div style={{ marginBottom: "var(--space-12)" }}>
                <h4
                  style={{
                    fontSize: "var(--font-size-caption)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--color-text-tertiary)",
                    margin: "0 0 var(--space-6)",
                  }}
                >
                  Select Line Item
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)" }}>
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
                          gap: "var(--space-4)",
                          padding: "var(--space-4) var(--space-10)",
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
                        <span
                          style={{
                            color: "var(--color-text-tertiary)",
                            maxWidth: 80,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
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
                    marginBottom: "var(--space-6)",
                  }}
                >
                  <h4
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
                  </h4>
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
          </section>

          {/* ── Section D: Evidence & Next Steps ───────────────────────── */}
          <section>
            <SectionLabel letter="D" title="Evidence & Next Steps" />

            {/* Tab bar */}
            <div
              style={{
                display: "flex",
                gap: "var(--space-4)",
                borderBottom: "1px solid var(--color-border-default)",
                marginBottom: "var(--space-10)",
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

            {/* Evidence tab */}
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

            {/* Next Steps */}
            {analysis && (
              <div style={{ marginTop: "var(--space-12)" }}>
                <h4
                  style={{
                    fontSize: "var(--font-size-caption)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--color-text-tertiary)",
                    margin: "0 0 var(--space-6)",
                  }}
                >
                  Recommended Next Steps
                </h4>
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: "var(--space-20)",
                    fontSize: "var(--font-size-caption)",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.8,
                  }}
                >
                  <li>Review the agent analysis and confidence score above</li>
                  <li>Verify the pricing waterfall for the flagged line items</li>
                  {canExecuteRecipe ? (
                    <li>
                      <strong style={{ color: "var(--color-success)" }}>Execute Recipe</strong> — Compliance Shadow has approved
                    </li>
                  ) : (
                    <li>
                      <strong style={{ color: "var(--color-warning)" }}>Await Compliance Shadow</strong> — recipe execution is blocked until approval
                    </li>
                  )}
                  <li>Monitor pipeline progress for completion</li>
                </ol>
              </div>
            )}
          </section>

          {/* Resolution Data */}
          {detail.resolution_data && Object.keys(detail.resolution_data).length > 0 && (
            <section>
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
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Helper components ───────────────────────────────────────────────── */

function SectionLabel({ letter, title }: { letter: string; title: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-8)",
        marginBottom: "var(--space-10)",
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "var(--radius-full)",
          background: "var(--color-brand-subtle)",
          color: "var(--color-brand)",
          fontSize: "var(--font-size-label)",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {letter}
      </span>
      <h3
        style={{
          fontSize: "var(--font-size-subhead)",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          margin: 0,
        }}
      >
        {title}
      </h3>
    </div>
  );
}

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
      <span
        style={{
          color: "var(--color-text-quaternary)",
          fontSize: "var(--font-size-label)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
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
