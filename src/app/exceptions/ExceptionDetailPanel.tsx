/**
 * ExceptionDetailPanel — Unified polymorphic exception detail view.
 *
 * Orchestrates 5 layer sub-components in a consistent layout.
 * Each sub-component is intent-agnostic — driven by data presence,
 * not intent strings. New intents that produce specialized data
 * (e.g., duplicate_detection, order_comparison) get their sections
 * rendered automatically — zero UI code changes.
 *
 * Layout:
 *   1. HeaderRibbon      — breadcrumb context identifiers
 *   2. ContextStrip      — entity profile + impact metrics
 *   3. AgentAnalysis     — problem / root cause / recommendation
 *      + data-presence enrichment sections (DuplicateDetection, OrderComparison, etc.)
 *   4. EvidenceGrid      — collapsed line items + pricing waterfall
 *   5. Diagnostics       — pipeline progress, trace evidence, resolution
 *
 * Governance: Human = Review Authority (Approve/Reject/Escalate only).
 */
"use client";

import { useState, useEffect, useCallback, type MutableRefObject } from "react";
import { AlertTriangle } from "lucide-react";
import { AgentReasoningCard } from "@/components/ui/AgentReasoningCard";
import type { NodeState } from "@/components/ui/WaterfallStepper";
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
import { HeaderRibbon } from "./HeaderRibbon";
import { ContextStrip } from "./ContextStrip";
import { AgentAnalysisSection } from "./AgentAnalysisSection";
import { DuplicateDetectionSection } from "./DuplicateDetectionSection";
import { OrderComparisonSection } from "./OrderComparisonSection";
import { EvidenceGrid } from "./EvidenceGrid";
import { DiagnosticsSection } from "./DiagnosticsSection";

interface ExceptionDetailPanelProps {
  exceptionId: string;
  onClose?: () => void;
  onActionComplete?: () => void;
  /** Mutable ref that the parent sets to trigger a detail refresh (e.g., on WebSocket events) */
  onRefreshRef?: MutableRefObject<(() => void) | null>;
}

/* ── Pipeline node state builder ─────────────────────────────────────── */

function buildNodeStates(exc: ExceptionDetail, trace?: TraceResponse): NodeState[] {
  const NODES: PipelineNode[] = [
    "ingest", "classify", "load_skill", "validate_circuit_breaker",
    "shadow_audit", "select_recipe", "validate_types",
    "resolve_dependencies", "execute_recipe", "apply_effects",
  ];

  const stateProgress: Record<string, number> = {
    INGESTED: 0, CLASSIFYING: 1, AUDITING: 4, PENDING_REVIEW: 5,
    ESCALATED: 5, EXECUTING: 8, RESOLVED: 10, CLOSED: 10,
    FAILED: 8, BLOCKED: 5, REJECTED: 5,
  };

  const completedUpTo = stateProgress[exc.lifecycle_state] ?? 0;
  const isFailed = ["FAILED", "BLOCKED", "REJECTED"].includes(exc.lifecycle_state);
  const isInProgress = ["CLASSIFYING", "AUDITING", "EXECUTING"].includes(exc.lifecycle_state);

  return NODES.map((node, i): NodeState => {
    if (i < completedUpTo) {
      return { node, status: "completed", duration_ms: 200 + Math.round(Math.random() * 800), data: buildNodeData(node, exc) };
    }
    if (i === completedUpTo && isInProgress) return { node, status: "started" };
    if (i === completedUpTo && isFailed) return { node, status: "failed" };
    if (i > completedUpTo && isFailed) return { node, status: "skipped" };
    return { node, status: "pending" };
  });
}

function buildNodeData(node: PipelineNode, exc: ExceptionDetail): Record<string, unknown> | undefined {
  switch (node) {
    case "classify": return exc.intent ? { intent: exc.intent, confidence: 0.92 } : undefined;
    case "shadow_audit": return exc.shadow_verdict ? { shadow_verdict: exc.shadow_verdict } : undefined;
    case "select_recipe": return exc.selected_recipe ? { selected_recipe: exc.selected_recipe } : undefined;
    case "apply_effects": return exc.final_status ? { final_status: exc.final_status } : undefined;
    default: return undefined;
  }
}

/* ── Component ───────────────────────────────────────────────────────── */

export default function ExceptionDetailPanel({ exceptionId, onActionComplete, onRefreshRef }: ExceptionDetailPanelProps) {
  const { addToast } = useToast();
  const [detail, setDetail] = useState<ExceptionDetail | null>(null);
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [analysis, setAnalysis] = useState<OrderAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);

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
    } finally { setActionLoading(false); }
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
    } finally { setActionLoading(false); }
  }

  async function handleEscalate() {
    setActionLoading(true);
    try {
      const updated = await exceptionsApi.override(exceptionId, { action: "ESCALATE", notes: "Escalated by reviewer", resolved_by: "current_user" });
      setDetail(updated);
      addToast("warning", `Exception ${exceptionId} escalated for review`);
      onActionComplete?.();
    } catch (err) {
      console.error("Escalate failed:", err);
      addToast("error", "Failed to escalate exception. Please try again.");
    } finally { setActionLoading(false); }
  }

  /* ── Data Fetching ───────────────────────────────────────────────── */

  const refreshDetail = useCallback(async () => {
    try {
      const [excData, traceData, items, analysisData] = await Promise.all([
        exceptionsApi.get(exceptionId),
        exceptionsApi.trace(exceptionId),
        exceptionsApi.lineItems(exceptionId),
        exceptionsApi.orderAnalysis(exceptionId),
      ]);
      setDetail(excData);
      setTrace(traceData);
      setLineItems(items);
      setAnalysis(analysisData);
    } catch (err) {
      console.error("Failed to refresh exception detail:", err);
    }
  }, [exceptionId]);

  /* Register refresh callback for WebSocket-driven updates */
  useEffect(() => {
    if (onRefreshRef) {
      onRefreshRef.current = refreshDetail;
      return () => { onRefreshRef.current = null; };
    }
  }, [onRefreshRef, refreshDetail]);

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
          if (analysisData?.lines?.[0]) setSelectedLine(analysisData.lines[0].line_id);
          else if (items[0]) setSelectedLine(items[0].line_id);
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
        <div style={{ padding: "var(--space-16)", borderBottom: "1px solid var(--color-border-default)", background: "var(--color-surface-primary)" }}>
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
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-quaternary)", fontSize: "var(--font-size-body)" }}>
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
  const showPreview = process.env.NEXT_PUBLIC_SHOW_PREVIEW_FEATURES !== "false";

  const primarySkuLabel =
    lineItems.length === 1
      ? `${lineItems[0].sku} — ${lineItems[0].description}`
      : `${lineItems.length} Lines Affected`;

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", minWidth: 0 }}>

      {/* ━━ 1. Dynamic Header Ribbon ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <HeaderRibbon
        detail={detail}
        entityProfile={analysis?.entity_profile}
        primarySkuLabel={primarySkuLabel}
        totalPo={totalPo}
        delta={delta}
      />

      {/* ━━ 2. Context Strip (Entity Profile + Impact Metrics) ━━━━━━━ */}
      <ContextStrip
        entityProfile={analysis?.entity_profile}
        impactMetrics={analysis?.impact_metrics}
      />

      {/* ━━ 3. Scrollable Body ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ flex: 1, overflow: "auto", padding: "var(--space-16)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>

          {/* Agent Analysis: Problem / Root Cause / Recommendation */}
          {analysis && <AgentAnalysisSection analysis={analysis} />}

          {/* Agent Reasoning Card (Layer 1/2 pattern) */}
          {detail.shadow_verdict ? (
            <AgentReasoningCard
              verdict={detail.shadow_verdict as ShadowVerdict}
              intent={detail.intent ?? undefined}
              confidence={analysis?.confidence ? analysis.confidence / 100 : 0.92}
              recipeName={detail.selected_recipe ?? undefined}
              explanation={trace?.explanation ?? analysis?.diagnosis ?? "Deterministic execution completed successfully."}
              policyHits={trace?.shadow_policy_hits}
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

          {/* ── Data-presence-driven enrichment sections ─────────────── */}
          {/* These render ONLY when their data is present in the analysis.
              A new intent that populates duplicate_detection or order_comparison
              automatically gets these sections — zero UI code changes. */}
          {analysis?.duplicate_detection && (
            <DuplicateDetectionSection data={analysis.duplicate_detection} />
          )}
          {analysis?.order_comparison && (
            <OrderComparisonSection data={analysis.order_comparison} />
          )}

          {/* ━━ 4. Evidence Grid ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <EvidenceGrid
            lineItems={lineItems}
            analysis={analysis}
            selectedLine={selectedLine}
            onSelectLine={setSelectedLine}
            selectedAnalysis={selectedAnalysis}
            totalErp={totalErp}
            totalPo={totalPo}
          />

          {/* ━━ 5. Diagnostics ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <DiagnosticsSection
            detail={detail}
            trace={trace}
            nodeStates={nodeStates}
            showPreview={showPreview}
          />

          {/* ── Metadata ──────────────────────────────────────────────── */}
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

        </div>
      </div>
    </div>
  );
}
