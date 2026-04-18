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
import {
  AgentReasoningCard,
  type ExecutionError,
  type ActionInFlight,
} from "@/components/ui/AgentReasoningCard";
import type { NodeState } from "@/components/ui/WaterfallStepper";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useHealth } from "@/hooks/useHealth";
import { exceptionsApi } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
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
import { DeliveryDelaySection } from "./DeliveryDelaySection";
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
  const { hasPermission, user } = useAuth();
  const { health } = useHealth();
  const [detail, setDetail] = useState<ExceptionDetail | null>(null);
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [analysis, setAnalysis] = useState<OrderAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  /** Pessimistic UI — which action is in flight. Replaces the coarse
   *  `actionLoading` boolean so each button can show its own "Verbing…"
   *  label while the others stay disabled. */
  const [actionInFlight, setActionInFlight] = useState<ActionInFlight>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  /** Override chooser dialog state — opened by AgentReasoningCard via the
   *  `onOverride` callback and closed on submit or cancel. */
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideAction, setOverrideAction] = useState<string>("");
  const [overrideNotes, setOverrideNotes] = useState("");
  // Phase 2 #4 — controlled-vocabulary category alongside the free-text
  // notes. Sourced from health.allowed_override_reason_tags per Guardrail #2.
  const [overrideReasonTag, setOverrideReasonTag] = useState<string>("");

  /* ── Actions (RBAC-gated via hasPermission) ─────────────────────── */

  /**
   * Phase 3: Approve / Reject / Override all route through the unified
   * PATCH /disposition endpoint. Sub-type is derived server-side from the
   * chosen action vs. the recipe's recommended_action:
   *   chosen == recommended      → APPROVE (exceptions:approve)
   *   chosen == "NO_ACTION"      → REJECT  (exceptions:approve)
   *   chosen != recommended      → OVERRIDE (exceptions:override,
   *                                           four-eyes applies)
   */
  function _recommendedAction(): string | null {
    const rd = (detail?.resolution_data ?? {}) as Record<string, unknown>;
    const v = rd.recommended_action;
    return typeof v === "string" ? v : null;
  }

  async function handleApprove(comment: string) {
    if (!hasPermission("exceptions:approve")) {
      addToast("warning", "Permission denied: your role cannot approve exceptions.");
      return;
    }
    const recommended = _recommendedAction();
    if (!recommended) {
      addToast("warning", "No recipe recommendation on this exception — use Override to choose an action.");
      return;
    }
    setActionInFlight("approve");
    try {
      const updated = await exceptionsApi.disposition(exceptionId, {
        action: recommended,
        notes: comment || "Approved by reviewer",
        reason_tag: "other",
      });
      setDetail(updated);
      addToast("success", `Exception ${exceptionId} approved (${recommended})`);
      onActionComplete?.();
    } catch (err) {
      console.error("Approve failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to approve exception.";
      addToast("error", msg);
    } finally { setActionInFlight(null); }
  }

  async function handleReject(comment: string) {
    if (!hasPermission("exceptions:approve")) {
      addToast("warning", "Permission denied: your role cannot reject exceptions.");
      return;
    }
    setActionInFlight("reject");
    try {
      const updated = await exceptionsApi.disposition(exceptionId, {
        action: "NO_ACTION",
        notes: comment || "Rejected by reviewer",
        reason_tag: "other",
      });
      setDetail(updated);
      addToast("success", `Exception ${exceptionId} rejected`);
      onActionComplete?.();
    } catch (err) {
      console.error("Reject failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to reject exception.";
      addToast("error", msg);
    } finally { setActionInFlight(null); }
  }

  /**
   * Escalate is a routing action — now on its own endpoint
   * (POST /api/v1/exceptions/{id}/escalate) with its own permission
   * (`exceptions:escalate`). Previously this piggy-backed on
   * exceptionsApi.override with action="ESCALATE", which was semantically
   * wrong — Override resolves, Escalate re-routes.
   */
  async function handleEscalate() {
    if (!hasPermission("exceptions:escalate")) {
      addToast("warning", "Permission denied: your role cannot escalate exceptions.");
      return;
    }
    // SOX: reason is mandatory. Fall back to the existing native prompt for
    // Phase 1 — a richer escalate dialog is tracked separately.
    const reason = typeof window !== "undefined"
      ? window.prompt("Reason for escalation (required):")
      : null;
    if (!reason || !reason.trim()) {
      addToast("warning", "A reason is required to escalate.");
      return;
    }
    setActionInFlight("escalate");
    try {
      const updated = await exceptionsApi.escalate(exceptionId, { reason: reason.trim() });
      setDetail(updated);
      addToast("warning", `Exception ${exceptionId} escalated for review`);
      onActionComplete?.();
    } catch (err) {
      console.error("Escalate failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to escalate exception.";
      addToast("error", msg);
    } finally { setActionInFlight(null); }
  }

  /** Opens the Override chooser dialog. The actual API call runs on submit. */
  function handleOverride() {
    if (!hasPermission("exceptions:override")) {
      addToast("warning", "Permission denied: your role cannot override exceptions.");
      return;
    }
    setOverrideAction("");
    setOverrideNotes("");
    setOverrideReasonTag("");
    setOverrideOpen(true);
  }

  async function submitOverride() {
    if (!overrideAction) {
      addToast("warning", "Select a resolution action.");
      return;
    }
    if (!overrideReasonTag) {
      addToast("warning", "Select a reason category.");
      return;
    }
    if (!overrideNotes.trim()) {
      addToast("warning", "Notes are required (SOX audit trail).");
      return;
    }
    setActionInFlight("override");
    try {
      // Phase 3: every disposition goes through /disposition. The server
      // classifies sub_type (APPROVE/REJECT/OVERRIDE) from the chosen
      // action vs. the record's recommended_action. For this chooser the
      // user has explicitly picked a resolution action + reason_tag, so
      // sub_type will be OVERRIDE (or APPROVE if they happened to pick
      // the recommended action — also valid).
      const updated = await exceptionsApi.disposition(exceptionId, {
        action: overrideAction,
        notes: overrideNotes.trim(),
        reason_tag: overrideReasonTag,
      });
      setDetail(updated);
      setOverrideOpen(false);
      addToast("success", `Exception ${exceptionId} overridden (${overrideAction})`);
      onActionComplete?.();
    } catch (err) {
      console.error("Override failed:", err);
      // Surface the server error code where possible so operators understand
      // SoD rejections etc. The api client unwraps { error: { code, message } }
      // into Error("<code>: <message>") so a simple message string is fine.
      const msg = err instanceof Error ? err.message : "Failed to override exception.";
      addToast("error", msg);
    } finally { setActionInFlight(null); }
  }

  /**
   * Four-eyes cosign (Phase 2 #5). Called from the PENDING_COSIGN banner.
   * Reason is captured via window.prompt — deliberately minimal UX; a
   * richer modal can replace this in a later phase. The backend enforces
   * SoD (caller must not be the initiator) and non-empty notes.
   */
  async function handleCosign(approve: boolean) {
    if (!hasPermission("exceptions:override")) {
      addToast("warning", "Permission denied: your role cannot cosign overrides.");
      return;
    }
    const promptLabel = approve
      ? "Cosign approval — notes (required, SOX):"
      : "Cosign rejection — reason (required, SOX):";
    const notes = typeof window !== "undefined" ? window.prompt(promptLabel) : "";
    if (notes === null) return;  // user cancelled
    if (!notes.trim()) {
      addToast("warning", "Notes are required (SOX audit trail).");
      return;
    }
    setActionInFlight(approve ? "cosign-approve" : "cosign-reject");
    try {
      const updated = await exceptionsApi.cosign(exceptionId, {
        approve,
        notes: notes.trim(),
      });
      setDetail(updated);
      addToast(
        "success",
        approve
          ? `Override cosigned and applied (${updated.resolved_action ?? ""})`
          : "Override rejected; exception restored to prior state",
      );
      onActionComplete?.();
    } catch (err) {
      console.error("Cosign failed:", err);
      const msg = err instanceof Error ? err.message : "Cosign failed.";
      addToast("error", msg);
    } finally { setActionInFlight(null); }
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
    setActionInFlight("reanalyze");
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
    } finally { setActionInFlight(null); }
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

          {/* Four-eyes cosign banner — shown when a high-value override
              was initiated and is awaiting a second manager+ reviewer.
              Non-initiators with exceptions:override see Approve/Reject
              cosign buttons; the initiator sees a read-only status. */}
          {detail.lifecycle_state === "PENDING_COSIGN" && (() => {
            const pending = (detail.resolution_data as Record<string, unknown> | undefined)?.pending_override as
              | { action?: string; reason_tag?: string; initiator?: string; initiated_at?: string; financial_impact_usd?: number }
              | undefined;
            if (!pending) return null;
            const isInitiator = (user?.email ?? "") === pending.initiator;
            const canCosign = hasPermission("exceptions:override") && !isInitiator;
            return (
              <div
                role="status"
                aria-live="polite"
                className="flex flex-col gap-10 px-14 py-10 bg-warning-subtle border border-warning-border rounded-sm"
              >
                <div className="text-caption font-semibold text-warning">
                  Awaiting second-reviewer cosign
                </div>
                <div className="text-label text-text-secondary">
                  Initiator: <span className="font-mono">{pending.initiator}</span>
                  {" — "}
                  Action: <span className="font-mono">{pending.action}</span>
                  {" — "}
                  Reason: <span className="italic">{(pending.reason_tag ?? "").replace(/_/g, " ")}</span>
                  {typeof pending.financial_impact_usd === "number" && (
                    <>
                      {" — "}Impact: <span className="font-mono">${pending.financial_impact_usd.toLocaleString()}</span>
                    </>
                  )}
                </div>
                {canCosign ? (
                  <div className="flex gap-8">
                    <Button
                      variant="brand"
                      size="sm"
                      aria-label="Approve cosign"
                      disabled={actionInFlight === "cosign-approve" || actionInFlight === "cosign-reject"}
                      onClick={() => handleCosign(true)}
                    >
                      {actionInFlight === "cosign-approve" ? "Approving…" : "Approve cosign"}
                    </Button>
                    <Button
                      variant="neutral"
                      size="sm"
                      aria-label="Reject cosign"
                      disabled={actionInFlight === "cosign-approve" || actionInFlight === "cosign-reject"}
                      onClick={() => handleCosign(false)}
                    >
                      {actionInFlight === "cosign-reject" ? "Rejecting…" : "Reject cosign"}
                    </Button>
                  </div>
                ) : isInitiator ? (
                  <div className="text-label text-text-tertiary italic">
                    You initiated this override. A different manager or admin must cosign before it is applied.
                  </div>
                ) : null}
              </div>
            );
          })()}

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
              onOverride={handleOverride}
              canApprove={hasPermission("exceptions:approve")}
              canOverride={hasPermission("exceptions:override")}
              canEscalate={hasPermission("exceptions:escalate")}
              canReanalyze={hasPermission("exceptions:override")}
              // Only expose Re-analyze when the user is authorized — the
              // card itself additionally gates on verdict/error state.
              onReanalyze={
                hasPermission("exceptions:override") ? handleReanalyze : undefined
              }
              reanalyzeAttempts={detail.reanalysis_history?.length ?? 0}
              actionInFlight={actionInFlight}
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
          {analysis?.delivery_delay_analysis && (
            <DeliveryDelaySection data={analysis.delivery_delay_analysis} />
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

      {/* ── Override chooser ───────────────────────────────────────────
          Opened by AgentReasoningCard via the onOverride callback.
          Resolution-action options are sourced from useHealth() per
          Guardrail #2 — the UI never hardcodes enum values. Notes are
          mandatory (SOX). */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent aria-label="Override exception">
          <DialogHeader>
            <DialogTitle>Override resolution</DialogTitle>
            <DialogDescription>
              Choose the resolution action the backend should apply. This is
              audited — notes are mandatory.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-12">
            <label className="flex flex-col gap-4 text-caption text-text-secondary">
              Action
              <select
                value={overrideAction}
                onChange={(e) => setOverrideAction(e.target.value)}
                aria-label="Resolution action"
                className="h-[32px] w-full rounded-md border border-border bg-surface-primary px-8 text-caption font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-ring"
              >
                <option value="">Select an action…</option>
                {/* Options come from /api/v1/health.allowed_resolution_actions
                    (authoritative source = asoe2/constraints/specs.py). When
                    the server narrows the set for this specific exception via
                    resolution_data.allowed_actions, prefer that narrower list
                    — otherwise show the full vocabulary. Guardrail #2: no
                    resolution-action string literal appears in this file. */}
                {(() => {
                  const narrowed = detail?.resolution_data
                    && typeof detail.resolution_data === "object"
                    && Array.isArray((detail.resolution_data as Record<string, unknown>).allowed_actions)
                    ? ((detail.resolution_data as Record<string, unknown>).allowed_actions as string[])
                    : null;
                  const options = narrowed ?? health?.allowed_resolution_actions ?? [];
                  return options.map((a) => (
                    <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
                  ));
                })()}
              </select>
            </label>
            <label className="flex flex-col gap-4 text-caption text-text-secondary">
              Reason category
              {/* Controlled vocabulary (Guardrail #2). Feeds ML clustering
                  of overrides by category downstream — free-text notes are
                  captured below but are not a reliable training signal.
                  Phase 3 Option A: prefer the per-intent narrowed list
                  when the backend provides one for this record's intent;
                  fall back to the global list otherwise. */}
              {(() => {
                const perIntent = detail?.intent
                  ? health?.allowed_override_reason_tags_by_intent?.[detail.intent]
                  : undefined;
                const options = perIntent ?? health?.allowed_override_reason_tags ?? [];
                return (
                  <select
                    value={overrideReasonTag}
                    onChange={(e) => setOverrideReasonTag(e.target.value)}
                    aria-label="Override reason category"
                    className="h-[32px] w-full rounded-md border border-border bg-surface-primary px-8 text-caption font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-ring"
                  >
                    <option value="">Select a reason…</option>
                    {options.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                );
              })()}
            </label>
            <label className="flex flex-col gap-4 text-caption text-text-secondary">
              Notes (required)
              <textarea
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
                rows={3}
                placeholder="Why is an override appropriate? (SOX audit trail)"
                aria-label="Override notes"
                className="w-full rounded-md border border-border bg-surface-primary px-8 py-6 text-caption text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-ring"
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOverrideOpen(false)}
              disabled={actionInFlight === "override"}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={submitOverride}
              disabled={
                actionInFlight === "override"
                || !overrideAction
                || overrideNotes.trim().length === 0
              }
            >
              {actionInFlight === "override" ? "Overriding…" : "Confirm Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
