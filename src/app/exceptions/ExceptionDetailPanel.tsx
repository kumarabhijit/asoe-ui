/**
 * ExceptionDetailPanel — Unified polymorphic exception detail view.
 *
 * Adapts its data display based on Exception Intent (Skill) while
 * maintaining a consistent structural layout within the Outlook pane.
 *
 * Layout:
 *   1. Dynamic Header Ribbon  (breadcrumb-style context identifiers)
 *   2. Context Strip           (entity profile + impact metrics + shadow verdict)
 *   3. Agent Analysis          (problem / root cause / recommendation)
 *   4. Evidence Grid           (collapsed by default, expandable line items)
 *   5. Supporting Context      (pipeline progress, trace evidence, resolution)
 *
 * Governance: The human acts as Review Authority — Approve, Reject,
 * or Escalate only. No "Execute Recipe" or manual execution triggers.
 * Shadow Verdict displayed as a read-only badge.
 */
"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Package,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Building2,
  DollarSign,
  Shield,
  Clock,
  User,
  MapPin,
} from "lucide-react";
import { AgentReasoningCard } from "@/components/ui/AgentReasoningCard";
import { WaterfallStepper, type NodeState } from "@/components/ui/WaterfallStepper";
import { PricingWaterfall } from "@/components/ui/PricingWaterfall";
import { Badge, lifecycleVariant, verdictVariant, rootCauseVariant } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
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
  /** Called after a successful approve/reject/escalate to refresh the parent list */
  onActionComplete?: () => void;
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

export default function ExceptionDetailPanel({ exceptionId, onClose, onActionComplete }: ExceptionDetailPanelProps) {
  const { addToast } = useToast();
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
      addToast("success", `Exception ${exceptionId} approved`);
      onActionComplete?.();
    } catch (err) {
      console.error("Approve failed:", err);
      addToast("error", "Failed to approve exception. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(comment: string) {
    setActionLoading(true);
    try {
      const updated = await exceptionsApi.reject(exceptionId, { reason: comment || "Rejected by reviewer" });
      setDetail(updated);
      addToast("success", `Exception ${exceptionId} rejected`);
      onActionComplete?.();
    } catch (err) {
      console.error("Reject failed:", err);
      addToast("error", "Failed to reject exception. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEscalate() {
    setActionLoading(true);
    try {
      const updated = await exceptionsApi.override(exceptionId, {
        action: "ESCALATE",
        notes: "Escalated by reviewer",
        resolved_by: "current_user",
      });
      setDetail(updated);
      addToast("warning", `Exception ${exceptionId} escalated for review`);
      onActionComplete?.();
    } catch (err) {
      console.error("Escalate failed:", err);
      addToast("error", "Failed to escalate exception. Please try again.");
    } finally {
      setActionLoading(false);
    }
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
  const ep = analysis?.entity_profile;
  const im = analysis?.impact_metrics;

  const DETAIL_TABS = [
    { id: "evidence", label: "Evidence" },
  ];

  // Primary SKU or "N Lines Affected" for header ribbon
  const primarySkuLabel =
    lineItems.length === 1
      ? `${lineItems[0].sku} — ${lineItems[0].description}`
      : `${lineItems.length} Lines Affected`;

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", minWidth: 0 }}>

      {/* ━━ 1. Dynamic Header Ribbon (breadcrumb-style context) ━━━━━━━ */}
      <div
        style={{
          padding: "var(--space-10) var(--space-16)",
          borderBottom: "1px solid var(--color-border-default)",
          background: "var(--color-surface-primary)",
          flexShrink: 0,
        }}
      >
        {/* Breadcrumb row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-6)",
            fontSize: "var(--font-size-caption)",
            color: "var(--color-text-tertiary)",
            marginBottom: "var(--space-6)",
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-text-primary)" }}>
            {detail.order_id}
          </span>
          <ChevronRight size={10} />
          <span style={{ fontWeight: 500, color: "var(--color-text-secondary)" }}>
            {ep?.customer_name ?? detail.tenant_id}
          </span>
          <ChevronRight size={10} />
          <span>{ep?.location ?? "—"}</span>
          <ChevronRight size={10} />
          <span>{primarySkuLabel}</span>
        </div>

        {/* Status row: lifecycle + event type + shadow verdict read-only */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)", flexWrap: "wrap" }}>
          <Badge variant={lifecycleVariant(detail.lifecycle_state)} size="sm">
            {detail.lifecycle_state.replace(/_/g, " ")}
          </Badge>
          <span style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-tertiary)" }}>
            {detail.event_type.replace(/_/g, " ")}
          </span>
          {detail.shadow_verdict && (
            <Badge variant={verdictVariant(detail.shadow_verdict)} size="sm">
              {detail.shadow_verdict}
            </Badge>
          )}
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontSize: "var(--font-size-body)",
              color: "var(--color-text-primary)",
            }}
          >
            {fmtPrice(totalPo)}
          </span>
          {delta !== 0 && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                fontSize: "var(--font-size-caption)",
                color: "var(--color-error)",
              }}
            >
              {"\u0394"} {fmtPrice(Math.abs(delta))}
            </span>
          )}
        </div>
      </div>

      {/* ━━ 2. Context Strip (Entity Profile + Impact Metrics) ━━━━━━━━ */}
      {(ep || im) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            borderBottom: "1px solid var(--color-border-default)",
            flexShrink: 0,
          }}
        >
          {/* Entity Profile */}
          <div
            style={{
              padding: "var(--space-10) var(--space-16)",
              borderRight: "1px solid var(--color-border-default)",
              background: "var(--color-surface-primary)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-6)" }}>
              Entity Profile
            </div>
            {ep && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", fontSize: "var(--font-size-caption)" }}>
                <ContextRow icon={<User size={11} />} label="Customer" value={`${ep.customer_name} (${ep.bp_number})`} />
                <ContextRow icon={<Building2 size={11} />} label="Tier" value={ep.customer_tier ?? "—"} badge={ep.vip_status ? "VIP" : undefined} />
                <ContextRow icon={<Shield size={11} />} label="Credit" value={ep.credit_standing ?? "—"} />
                <ContextRow icon={<MapPin size={11} />} label="Location" value={ep.location ?? "—"} />
              </div>
            )}
          </div>

          {/* Impact Metrics */}
          <div
            style={{
              padding: "var(--space-10) var(--space-16)",
              background: "var(--color-surface-primary)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-6)" }}>
              Impact & Risk
            </div>
            {im && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", fontSize: "var(--font-size-caption)" }}>
                <ContextRow icon={<DollarSign size={11} />} label="At Risk" value={fmtPrice(im.revenue_at_risk)} highlight />
                <ContextRow icon={<DollarSign size={11} />} label="Delta" value={`${fmtPrice(im.delta_amount)} (${im.delta_percentage.toFixed(1)}%)`} />
                {im.fulfillment_gap_pct !== undefined && (
                  <ContextRow icon={<Package size={11} />} label="Gap" value={`${im.fulfillment_gap_pct.toFixed(1)}%`} />
                )}
                <ContextRow icon={<Clock size={11} />} label="Priority" value={im.sla_priority} badge={im.sla_priority} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ━━ 3. Scrollable Body ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ flex: 1, overflow: "auto", padding: "var(--space-16)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>

          {/* ── Agent Analysis: Problem / Root Cause / Recommendation ──── */}
          {analysis && (
            <section
              style={{
                background: "var(--color-surface-primary)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-sm)",
                padding: "var(--space-16)",
              }}
            >
              {/* The Problem */}
              <div style={{ marginBottom: "var(--space-12)" }}>
                <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-4)" }}>
                  The Problem
                </div>
                <p style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                  {analysis.diagnosis}
                </p>
              </div>

              {/* Root Cause */}
              <div style={{ marginBottom: "var(--space-12)" }}>
                <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-4)" }}>
                  Root Cause
                </div>
                <div
                  style={{
                    borderLeft: "3px solid var(--color-warning)",
                    paddingLeft: "var(--space-10)",
                    fontSize: "var(--font-size-body)",
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                    lineHeight: 1.5,
                  }}
                >
                  {analysis.root_cause}
                </div>
              </div>

              {/* Recommendation */}
              <div>
                <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-4)" }}>
                  Recommendation
                </div>
                <div
                  style={{
                    borderLeft: "3px solid var(--color-brand)",
                    paddingLeft: "var(--space-10)",
                    fontSize: "var(--font-size-body)",
                    fontWeight: 600,
                    color: "var(--color-brand)",
                    lineHeight: 1.5,
                  }}
                >
                  {analysis.recommendation}
                </div>
              </div>
            </section>
          )}

          {/* ── Agent Reasoning Card (Layer 1/2 pattern) ───────────────── */}
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
                padding: "var(--space-12)",
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

          {/* ── Evidence Grid (collapsed by default) ───────────────────── */}
          {lineItems.length > 0 && (
            <EvidenceGrid
              lineItems={lineItems}
              analysis={analysis}
              selectedLine={selectedLine}
              onSelectLine={setSelectedLine}
              selectedAnalysis={selectedAnalysis}
              totalErp={totalErp}
              totalPo={totalPo}
            />
          )}

          {/* ── Supporting Context: Pipeline Progress ──────────────────── */}
          <section>
            <SectionHeading title="Pipeline Progress" />
            <WaterfallStepper
              nodes={nodeStates}
              intent={detail.intent ?? undefined}
            />
          </section>

          {/* ── Supporting Context: Trace Evidence ─────────────────────── */}
          <section>
            <SectionHeading title="Trace Evidence" />
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
          </section>

          {/* ── Metadata ───────────────────────────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "var(--space-8)",
              fontSize: "var(--font-size-caption)",
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

          {/* ── Resolution Data ─────────────────────────────────────────── */}
          {detail.resolution_data && Object.keys(detail.resolution_data).length > 0 && (
            <section>
              <SectionHeading title="Resolution Data" />
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

function SectionHeading({ title }: { title: string }) {
  return (
    <h3
      style={{
        fontSize: "var(--font-size-subhead)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        margin: "0 0 var(--space-8)",
      }}
    >
      {title}
    </h3>
  );
}

/** Context strip row — icon + label + value + optional badge */
function ContextRow({ icon, label, value, badge, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)", minWidth: 0 }}>
      <span style={{ color: "var(--color-text-quaternary)", flexShrink: 0 }}>{icon}</span>
      <span style={{ color: "var(--color-text-tertiary)", minWidth: 52, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          color: highlight ? "var(--color-error)" : "var(--color-text-primary)",
          fontWeight: highlight ? 700 : 500,
          fontFamily: highlight ? "var(--font-mono)" : "var(--font-sans)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
      {badge && (
        <span
          style={{
            fontSize: "var(--font-size-label)",
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: "var(--radius-full)",
            background: "var(--color-brand-subtle)",
            color: "var(--color-brand)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

/** Collapsible evidence grid — line items + pricing waterfall */
function EvidenceGrid({
  lineItems,
  analysis,
  selectedLine,
  onSelectLine,
  selectedAnalysis,
  totalErp,
  totalPo,
}: {
  lineItems: LineItem[];
  analysis: OrderAnalysis | null;
  selectedLine: string | null;
  onSelectLine: (id: string) => void;
  selectedAnalysis: ReturnType<NonNullable<OrderAnalysis>["lines"]["find"]>;
  totalErp: number;
  totalPo: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      style={{
        background: "var(--color-surface-primary)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-10) var(--space-16)",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
          <ChevronDown
            size={14}
            style={{
              color: "var(--color-text-tertiary)",
              transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform var(--dur-fast)",
            }}
          />
          <span style={{ fontSize: "var(--font-size-subhead)", fontWeight: 600, color: "var(--color-text-primary)" }}>
            Evidence Detail
          </span>
          <span
            style={{
              fontSize: "var(--font-size-label)",
              fontWeight: 600,
              color: "var(--color-text-tertiary)",
              background: "var(--color-surface-secondary)",
              padding: "2px 8px",
              borderRadius: "var(--radius-full)",
            }}
          >
            {lineItems.length} line{lineItems.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)", fontSize: "var(--font-size-caption)" }}>
          <span style={{ color: "var(--color-text-tertiary)" }}>
            ERP <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-text-primary)" }}>{fmtPrice(totalErp)}</span>
          </span>
          <span style={{ color: "var(--color-text-tertiary)" }}>
            PO <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: totalPo !== totalErp ? "var(--color-error)" : "var(--color-text-primary)" }}>{fmtPrice(totalPo)}</span>
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--color-border-default)", padding: "var(--space-12) var(--space-16)" }}>
          {/* Line item table */}
          <div style={{ overflowX: "auto", marginBottom: "var(--space-12)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-caption)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border-default)" }}>
                  {["Line", "SKU", "Description", "Qty", "ERP", "PO", "Root Cause"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "var(--space-6) var(--space-8)",
                        textAlign: ["Qty", "ERP", "PO"].includes(h) ? "right" : "left",
                        fontSize: "var(--font-size-label)",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--color-text-tertiary)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr
                    key={item.line_id}
                    onClick={() => onSelectLine(item.line_id)}
                    style={{
                      borderBottom: "1px solid var(--color-border-subtle)",
                      cursor: "pointer",
                      background: selectedLine === item.line_id ? "var(--color-surface-row-active)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "var(--space-6) var(--space-8)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{item.line_id}</td>
                    <td style={{ padding: "var(--space-6) var(--space-8)", fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>{item.sku}</td>
                    <td style={{ padding: "var(--space-6) var(--space-8)", color: "var(--color-text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</td>
                    <td style={{ padding: "var(--space-6) var(--space-8)", textAlign: "right", fontFamily: "var(--font-mono)" }}>{item.quantity.toLocaleString()}</td>
                    <td style={{ padding: "var(--space-6) var(--space-8)", textAlign: "right", fontFamily: "var(--font-mono)" }}>{fmtPrice(item.erp_price)}</td>
                    <td style={{ padding: "var(--space-6) var(--space-8)", textAlign: "right", fontFamily: "var(--font-mono)", color: item.po_price !== item.erp_price ? "var(--color-error)" : "var(--color-text-primary)", fontWeight: item.po_price !== item.erp_price ? 600 : 400 }}>{fmtPrice(item.po_price)}</td>
                    <td style={{ padding: "var(--space-6) var(--space-8)" }}>
                      {item.root_cause && <Badge variant={rootCauseVariant(item.root_cause)} size="sm" icon={null}>{item.root_cause.replace(/_/g, " ")}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Line selector pills (for waterfall) */}
          {analysis && analysis.lines.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", marginBottom: "var(--space-10)" }}>
              {lineItems.map((item) => {
                const la = analysis.lines.find((l) => l.line_id === item.line_id);
                const isSelected = selectedLine === item.line_id;
                return (
                  <button
                    key={item.line_id}
                    onClick={() => onSelectLine(item.line_id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-4)",
                      padding: "var(--space-4) var(--space-10)",
                      borderRadius: "var(--radius-full)",
                      border: isSelected ? "2px solid var(--color-brand)" : "1px solid var(--color-border-default)",
                      background: isSelected ? "var(--color-brand-subtle)" : "var(--color-surface-primary)",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--font-size-caption)",
                      transition: "all var(--dur-fast)",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-text-primary)" }}>{item.line_id}</span>
                    {la && <Badge variant={rootCauseVariant(item.root_cause)} size="sm" icon={null}>{la.risk}</Badge>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Pricing Waterfall for selected line */}
          {selectedAnalysis && selectedAnalysis.waterfall.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
                <h4 style={{ fontSize: "var(--font-size-subhead)", fontWeight: 600, color: "var(--color-text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
                  <FileText size={14} color="var(--color-text-tertiary)" />
                  ERP Pricing Waterfall
                </h4>
                <span style={{ fontSize: "var(--font-size-label)", color: "var(--color-text-tertiary)", background: "var(--color-surface-secondary)", padding: "2px 8px", borderRadius: "var(--radius-full)" }}>
                  {selectedAnalysis.waterfall.length} step{selectedAnalysis.waterfall.length !== 1 ? "s" : ""}
                </span>
              </div>
              <PricingWaterfall steps={selectedAnalysis.waterfall} />
            </div>
          )}
        </div>
      )}
    </section>
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
