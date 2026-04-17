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
import { AlertTriangle, RotateCcw } from "lucide-react";
import { AgentReasoningCard, type ExecutionError } from "@/components/ui/AgentReasoningCard";
import type { NodeState } from "@/components/ui/WaterfallStepper";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
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
import { PriceAnalysisSection } from "./PriceAnalysisSection";
import { BackOrderSection } from "./BackOrderSection";
import { OverMaxSection } from "./OverMaxSection";
import { MOQSection } from "./MOQSection";
import { PalletConfigSection } from "./PalletConfigSection";
import { EvidenceGrid } from "./EvidenceGrid";
import { DiagnosticsSection } from "./DiagnosticsSection";

interface ExceptionDetailPanelProps {
  exceptionId: string;
  onClose?: () => void;
  onActionComplete?: () => void;
  /** Mutable ref that the parent sets to trigger a detail refresh (e.g., on WebSocket events) */
  onRefreshRef?: MutableRefObject<(() => void) | null>;
  /** Live reanalysis banner state — set by the parent on reanalysis_started
   *  WebSocket events, cleared on task_complete. */
  reanalyzing?: {
    exceptionId: string;
    attempt: number;
    reason: string;
    triggeredBy: string;
  } | null;
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

export default function ExceptionDetailPanel({
  exceptionId,
  onActionComplete,
  onRefreshRef,
  reanalyzing,
}: ExceptionDetailPanelProps) {
  const { addToast } = useToast();
  const { hasPermission } = useAuth();
  const [detail, setDetail] = useState<ExceptionDetail | null>(null);
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [analysis, setAnalysis] = useState<OrderAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);

  /* ── Actions (RBAC-gated via hasPermission) ─────────────────────── */

  async function handleApprove(comment: string) {
    if (!hasPermission("exceptions:approve")) {
      addToast("warning", "Permission denied: your role cannot approve exceptions.");
      return;
    }
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
    if (!hasPermission("exceptions:approve")) {
      addToast("warning", "Permission denied: your role cannot reject exceptions.");
      return;
    }
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
    if (!hasPermission("exceptions:override")) {
      addToast("warning", "Permission denied: your role cannot escalate exceptions.");
      return;
    }
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

  async function handleReanalyze(reason: string) {
    // Same permission as override — manager+. Debated as the correct scope in
    // the expert synthesis: re-running the graph is materially similar to
    // overriding an agent decision.
    if (!hasPermission("exceptions:override")) {
      addToast("warning", "Permission denied: your role cannot re-analyze exceptions.");
      return;
    }
    if (!reason.trim()) {
      addToast("warning", "A reason is required for re-analysis.");
      return;
    }
    setActionLoading(true);
    try {
      const updated = await exceptionsApi.reanalyze(exceptionId, { reason });
      setDetail(updated);
      await refreshDetail();
      addToast("success", `Exception ${exceptionId} re-analyzed`);
      onActionComplete?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Re-analysis failed.";
      console.error("Reanalyze failed:", err);
      addToast("error", msg);
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
      <div className="h-full flex flex-col">
        <div className="p-16 border-b border-border bg-surface-primary">
          <div className="skeleton h-[20px] w-[200px] rounded-sm" />
        </div>
        <div className="flex-1 p-16 flex flex-col gap-12">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-[80px] rounded-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="h-full flex items-center justify-center text-text-quaternary text-body">
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

  /* ── Execution-error derivation ──────────────────────────────────────
     A FAILED lifecycle means the backend pipeline crashed (recipe threw,
     gateway timed out, circuit breaker). This is distinct from a RED
     shadow verdict (policy block) or REJECTED (human decision). */
  const executionError: ExecutionError | undefined =
    detail.lifecycle_state === "FAILED"
      ? {
          node: nodeStates.find((n) => n.status === "failed")?.node,
          message: trace?.explanation
            ?? "The pipeline reported a failure but no explanation was returned.",
          failedAt: detail.updated_at,
        }
      : undefined;

  const primarySkuLabel =
    lineItems.length === 1
      ? `${lineItems[0].sku} — ${lineItems[0].description}`
      : `${lineItems.length} Lines Affected`;

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div className="h-full flex flex-col font-sans min-w-0">

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
      <div className="flex-1 overflow-auto p-16">
        <div className="flex flex-col gap-16">

          {/* Live reanalysis banner — appears the moment a manager clicks
              Re-analyze and a reanalysis_started event arrives. Cleared on
              task_complete. Gives the user a visible "re-running" signal
              before the pipeline_progress events start streaming. */}
          {reanalyzing && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-10 px-14 py-10 bg-info-subtle border border-info-border rounded-sm"
            >
              <RotateCcw size={16} className="text-info shrink-0 animate-spin" />
              <div className="flex-1">
                <div className="text-caption font-semibold text-info">
                  Re-analyzing (attempt {reanalyzing.attempt})
                </div>
                <div className="text-label text-text-secondary mt-px">
                  Triggered by{" "}
                  <span className="font-mono">{reanalyzing.triggeredBy}</span>
                  {" — "}
                  <span className="italic">{reanalyzing.reason}</span>
                </div>
              </div>
            </div>
          )}

          {/* Agent Analysis: Problem / Root Cause / Recommendation */}
          {analysis && <AgentAnalysisSection analysis={analysis} />}

          {/* Agent Reasoning Card (Layer 1/2 pattern) */}
          {detail.shadow_verdict ? (
            <AgentReasoningCard
              verdict={detail.shadow_verdict as ShadowVerdict}
              executionError={executionError}
              intent={detail.intent ?? undefined}
              confidence={analysis?.confidence ? analysis.confidence / 100 : 0.92}
              recipeName={detail.selected_recipe ?? undefined}
              // Don't fall back to a success-sounding default when the pipeline
              // actually failed — leave the execution-error banner as the sole
              // narrative in that case.
              explanation={
                executionError
                  ? undefined
                  : trace?.explanation ?? analysis?.diagnosis
              }
              policyHits={trace?.shadow_policy_hits}
              onApprove={handleApprove}
              onReject={handleReject}
              onEscalate={handleEscalate}
              // Only expose Re-analyze when the user is authorized — the
              // card itself additionally gates on verdict/error state.
              onReanalyze={
                hasPermission("exceptions:override") ? handleReanalyze : undefined
              }
              reanalyzeAttempts={detail.reanalysis_history?.length ?? 0}
              actionLoading={actionLoading}
            />
          ) : (
            <div className="p-12 bg-surface-primary rounded-md shadow-sm flex items-center gap-8 text-caption text-text-tertiary">
              <AlertTriangle size={14} />
              Agent analysis pending — Compliance Shadow has not yet completed.
            </div>
          )}

          {/* ── Data-presence-driven enrichment sections ─────────────── */}
          {/* These render ONLY when their data is present in the analysis.
              A new intent that populates these fields automatically gets
              their sections rendered — zero UI code changes needed. */}
          {analysis?.price_analysis && (
            <PriceAnalysisSection data={analysis.price_analysis} />
          )}
          {analysis?.duplicate_detection && (
            <DuplicateDetectionSection data={analysis.duplicate_detection} />
          )}
          {analysis?.order_comparison && (
            <OrderComparisonSection data={analysis.order_comparison} />
          )}
          {analysis?.backorder_analysis && (
            <BackOrderSection data={analysis.backorder_analysis} />
          )}
          {analysis?.overmax_analysis && (
            <OverMaxSection data={analysis.overmax_analysis} />
          )}
          {analysis?.moq_analysis && (
            <MOQSection data={analysis.moq_analysis} />
          )}
          {analysis?.pallet_analysis && (
            <PalletConfigSection data={analysis.pallet_analysis} />
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
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-8 text-caption">
            <div>
              <span className="text-text-quaternary">Created</span>
              <div className="text-text-secondary font-medium mt-px font-mono">
                {new Date(detail.created_at).toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-text-quaternary">Updated</span>
              <div className="text-text-secondary font-medium mt-px font-mono">
                {new Date(detail.updated_at).toLocaleString()}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
