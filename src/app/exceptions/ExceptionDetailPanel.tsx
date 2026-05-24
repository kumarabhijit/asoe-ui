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
import { signIn } from "next-auth/react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import {
  AgentReasoningCard,
  type ExecutionError,
} from "@/components/ui/AgentReasoningCard";
import { useAuth } from "@/hooks/useAuth";
import { useHealth } from "@/hooks/useHealth";
import { useExceptionActions } from "@/hooks/useExceptionActions";
import { exceptionsApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { OverrideChooserDialog } from "./OverrideChooserDialog";
import type {
  ExceptionDetail,
  ShadowVerdict,
  LineItem,
  OrderAnalysis,
} from "@/types/exceptions";
import type { TraceResponse } from "@/types/api";
import { COSIGN_LIFECYCLE_STATE, CollapsibleSection, HITL_LIFECYCLE_STATES } from "./shared";
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
import { PriceHoldSection } from "./PriceHoldSection";
import { EdiMismatchSection } from "./EdiMismatchSection";
import { EmailOrderEntrySection } from "./EmailOrderEntrySection";
import { EmailSourceSection } from "./EmailSourceSection";
import { EntitiesSection } from "./EntitiesSection";
import { SapDataSection } from "./SapDataSection";
import { OrderEntrySection } from "./OrderEntrySection";
import { EvidenceGrid } from "./EvidenceGrid";
import { DiagnosticsSection } from "./DiagnosticsSection";

/**
 * Convenience predicate over the shared `HITL_LIFECYCLE_STATES`
 * (`shared.tsx`). Drives the auto-expand of the Agent Analysis pane —
 * the reviewer sees the diagnosis the moment they open a row that
 * needs their decision, instead of having to click to reveal it.
 */
function isHumanInTheLoopState(state: string): boolean {
  return HITL_LIFECYCLE_STATES.has(state);
}

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

/* ── Component ───────────────────────────────────────────────────────── */

export default function ExceptionDetailPanel({
  exceptionId,
  onActionComplete,
  onRefreshRef,
  reanalyzing,
}: ExceptionDetailPanelProps) {
  const { hasPermission, user } = useAuth();
  const { health } = useHealth();
  const [detail, setDetail] = useState<ExceptionDetail | null>(null);
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [analysis, setAnalysis] = useState<OrderAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  // `fetchError` is the user-visible reason the detail isn't rendered.
  // Distinct from `detail === null` because there are at least three
  // legitimate states to render differently:
  //   * still loading                → loading=true
  //   * fetch failed (e.g. 401, 5xx) → fetchError set, detail null
  //   * fetch succeeded but no body  → detail null, no error → "not found"
  const [fetchError, setFetchError] = useState<{
    kind: "unauthorized" | "not_found" | "other";
    message: string;
  } | null>(null);

  /* ── Data Fetching ───────────────────────────────────────────────── */

  // Classifies an error from the http() wrapper into the three states the
  // detail panel renders. The wrapper's Error.message format is
  // "<CODE>: <human message>" (api.ts:155-159), so we can string-match
  // the code prefix without parsing JSON.
  const classifyFetchError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("UNAUTHORIZED") || msg.includes("HTTP_401") || msg.startsWith("INVALID_TOKEN")) {
      return { kind: "unauthorized" as const, message: msg };
    }
    if (msg.startsWith("NOT_FOUND") || msg.includes("HTTP_404")) {
      return { kind: "not_found" as const, message: msg };
    }
    return { kind: "other" as const, message: msg };
  };

  // Lazy-fetch state (PO request #4 — defer non-critical payloads until
  // the operator expands the corresponding pane). On first paint we only
  // fetch `detail` + `analysis` so the Recommendation card renders
  // immediately. lineItems is loaded when the Evidence Detail pane is
  // opened (or sooner, if the header totals are first observed in the
  // viewport — handled below). Trace is loaded when the Diagnostics
  // toggle is expanded.
  const [lineItemsLoaded, setLineItemsLoaded] = useState(false);
  const [traceLoaded, setTraceLoaded] = useState(false);

  const refreshDetail = useCallback(async () => {
    try {
      // Always re-fetch detail + analysis (the always-visible
      // Recommendation pane reads from these). Re-fetch trace +
      // lineItems only if we already loaded them once — otherwise
      // they remain lazy.
      const [excData, analysisData] = await Promise.all([
        exceptionsApi.get(exceptionId),
        exceptionsApi.orderAnalysis(exceptionId),
      ]);
      setDetail(excData);
      setAnalysis(analysisData);
      if (lineItemsLoaded) {
        const items = await exceptionsApi.lineItems(exceptionId);
        setLineItems(items);
      }
      if (traceLoaded) {
        const traceData = await exceptionsApi.trace(exceptionId);
        setTrace(traceData);
      }
      setFetchError(null);
    } catch (err) {
      // Surface the failure so the panel can render an actionable
      // message. Previously we logged-and-swallowed, which left the
      // operator looking at a stale/empty panel after a 15-min token
      // expiry with no explanation. SOX-relevant surface: silent
      // partial-truth states are a Verdict 2026-04-22 violation.
      const classified = classifyFetchError(err);
      console.error(
        `Failed to refresh exception detail (${classified.kind}):`,
        classified.message,
      );
      setFetchError(classified);
    }
  }, [exceptionId, lineItemsLoaded, traceLoaded]);

  /* ── Actions (RBAC-gated, toast-routed) ──────────────────────────────
   * All HITL handlers — approve / reject / escalate / override /
   * cosign / reanalyze — live in `useExceptionActions`. The hook also
   * owns the override-chooser dialog state (action/notes/reason_tag +
   * open flag). Keeping this surface hook-shaped lets the orchestrator
   * stay focused on orchestration (M3 of the cross-repo review).
   */
  const {
    actionInFlight,
    handleApprove, handleReject, handleEscalate,
    handleOverride, submitOverride, handleCosign, handleReanalyze,
    overrideOpen, setOverrideOpen,
    overrideAction, setOverrideAction,
    overrideNotes, setOverrideNotes,
    overrideReasonTag, setOverrideReasonTag,
  } = useExceptionActions({
    exceptionId,
    detail,
    setDetail,
    onActionComplete,
    refreshDetail,
  });

  /**
   * View-layer accessor — the recipe's recommended action is surfaced
   * as a hover tooltip on the Approve button (AgentReasoningCard) so
   * the reviewer sees the exact action they're accepting. Stays in the
   * panel rather than the hook because it's pure read-through of
   * `detail.resolution_data` for rendering, not an action.
   */
  function _recommendedAction(): string | null {
    const rd = (detail?.resolution_data ?? {}) as Record<string, unknown>;
    const v = rd.recommended_action;
    return typeof v === "string" ? v : null;
  }

  /* Register refresh callback for WebSocket-driven updates */
  useEffect(() => {
    if (onRefreshRef) {
      onRefreshRef.current = refreshDetail;
      return () => { onRefreshRef.current = null; };
    }
  }, [onRefreshRef, refreshDetail]);

  useEffect(() => {
    let cancelled = false;
    // Reset lazy-load flags when the exception switches so the next
    // detail's heavy payloads are re-deferred until their pane opens.
    setLineItemsLoaded(false);
    setTraceLoaded(false);
    setLineItems([]);
    setTrace(null);
    async function fetchDetail() {
      setLoading(true);
      setFetchError(null);
      try {
        // Critical path only: detail + analysis. The Recommendation
        // card renders from these. lineItems and trace are deferred to
        // the pane-expansion handlers below.
        const [excData, analysisData] = await Promise.all([
          exceptionsApi.get(exceptionId),
          exceptionsApi.orderAnalysis(exceptionId),
        ]);
        if (!cancelled) {
          setDetail(excData);
          setAnalysis(analysisData);
          if (analysisData?.lines?.[0]) setSelectedLine(analysisData.lines[0].line_id);
        }
      } catch (err) {
        const classified = classifyFetchError(err);
        console.error(
          `Failed to fetch exception detail (${classified.kind}):`,
          classified.message,
        );
        if (!cancelled) setFetchError(classified);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDetail();
    return () => { cancelled = true; };
  }, [exceptionId]);

  // Lazy-load callbacks. Each pane fires its loader the first time it
  // opens; subsequent opens are no-ops. The loaders are idempotent and
  // safe to fire from multiple panes (e.g., Evidence Grid + header
  // totals both rely on lineItems).
  const ensureLineItemsLoaded = useCallback(async () => {
    if (lineItemsLoaded) return;
    setLineItemsLoaded(true); // optimistic — prevents double-fetch
    try {
      const items = await exceptionsApi.lineItems(exceptionId);
      setLineItems(items);
      setSelectedLine((cur) => cur ?? items[0]?.line_id ?? null);
    } catch (err) {
      console.error("Failed to fetch line items:", err);
      setLineItemsLoaded(false); // allow retry
    }
  }, [exceptionId, lineItemsLoaded]);

  const ensureTraceLoaded = useCallback(async () => {
    if (traceLoaded) return;
    setTraceLoaded(true);
    try {
      const traceData = await exceptionsApi.trace(exceptionId);
      setTrace(traceData);
    } catch (err) {
      console.error("Failed to fetch trace:", err);
      setTraceLoaded(false);
    }
  }, [exceptionId, traceLoaded]);

  // Background warm-up after the critical path. The header ribbon
  // shows total values that derive from lineItems; we kick this off
  // post-paint so the figures populate quickly without blocking the
  // first render. Trace stays fully lazy — it's only consumed in the
  // Diagnostics pane (which is collapsed by default).
  useEffect(() => {
    if (loading || !detail) return;
    if (!lineItemsLoaded) {
      ensureLineItemsLoaded();
    }
  }, [loading, detail, lineItemsLoaded, ensureLineItemsLoaded]);

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

  if (fetchError) {
    // Render an actionable failure state instead of the previous
    // "Exception not found" silent default. The operator sees what
    // went wrong AND a clear next step (sign-in for a 401, refresh
    // for a transient error). NextAuth's signIn() routes back to
    // the current URL via callbackUrl so the user lands on the
    // same exception after re-auth.
    if (fetchError.kind === "unauthorized") {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="h-full flex flex-col items-center justify-center gap-12 px-16 text-center"
        >
          <div className="text-body font-semibold text-text-primary">
            Your session has expired
          </div>
          <div className="text-caption text-text-secondary max-w-[320px]">
            The access token issued at sign-in is no longer valid. Sign in
            again to continue working on this exception.
          </div>
          <Button
            variant="brand"
            size="sm"
            onClick={() => signIn(undefined, { callbackUrl: window.location.href })}
          >
            Sign in
          </Button>
        </div>
      );
    }
    return (
      <div
        role="alert"
        aria-live="polite"
        className="h-full flex flex-col items-center justify-center gap-12 px-16 text-center"
      >
        <div className="text-body font-semibold text-text-primary">
          Couldn&rsquo;t load this exception
        </div>
        <div className="text-caption text-text-secondary max-w-[420px]">
          {fetchError.kind === "not_found"
            ? "This exception was not found. It may have been deleted or you may not have access."
            : "The backend returned an unexpected error. The detail above has the code; try Refresh."}
        </div>
        <Button variant="ghost" size="sm" onClick={() => refreshDetail()}>
          Refresh
        </Button>
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
          // ADR-027 Phase B: derive the halt node from the trace's
          // executed_nodes list rather than the legacy
          // PIPELINE_NODES-driven nodeStates. The first halted/errored
          // entry IS the halt point.
          node: trace?.executed_nodes?.find(
            (n) => n.status === "halted" || n.status === "errored",
          )?.node,
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
          {detail.lifecycle_state === COSIGN_LIFECYCLE_STATE && (() => {
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

          {/* Agent Reasoning Card (Layer 1/2 pattern) — the
              "Recommendation" pane (PO request #4: pane 2 after Entity
              Profile). Always rendered expanded; this is the primary
              decision surface the operator must always see. */}
          {detail.shadow_verdict ? (
            <AgentReasoningCard
              verdict={detail.shadow_verdict as ShadowVerdict}
              executionError={executionError}
              intent={detail.intent ?? undefined}
              // Backend confidence is 0-100 (asoe2/api/schemas.py
              // AnalysisResponse.confidence). Normalise to 0-1 for the
              // bar. Pass through `undefined` when the analysis hasn't
              // loaded — AgentReasoningCard hides the bar in that case
              // (a fabricated default would silently disagree with the
              // pipeline classify-node confidence — Verdict 2026-04-22
              // partial-truth violation).
              confidence={typeof analysis?.confidence === "number" ? analysis.confidence / 100 : undefined}
              recipeName={detail.selected_recipe ?? undefined}
              // Surfaced as a hover tooltip on the Approve button so the
              // reviewer sees the exact action they're accepting.
              recommendedAction={_recommendedAction() ?? undefined}
              // Don't fall back to a success-sounding default when the pipeline
              // actually failed — leave the execution-error banner as the sole
              // narrative in that case.
              //
              // We deliberately do NOT fall back to `analysis?.diagnosis`
              // here: the diagnosis is the long-form prose owned by the
              // Agent Analysis pane (`AgentAnalysisSection`'s "Problem"
              // block). Falling through duplicated the same paragraph in
              // two cards on Azure (where `trace.explanation` is often
              // absent), making the Recommendation card look like a clone
              // of Agent Analysis. The Recommendation card now stays
              // action-focused; when there is no policy explanation, the
              // operator's eye goes straight to the action buttons.
              explanation={
                executionError ? undefined : trace?.explanation
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
          ) : executionError ? (
            // Lifecycle=FAILED with no shadow_verdict means the pipeline
            // crashed AT or AFTER shadow_audit (lifecycle FAILED maps
            // to STATE_PROGRESS index 9 → 9 nodes ran), but the
            // crashing node never wrote a verdict back. Surface this
            // as a distinct execution-error state instead of the
            // generic "shadow has not yet completed" copy — the
            // pipeline DID run; it broke. The two surfaces (Agent
            // Recommendation vs. Pipeline Progress) now agree on the
            // failure point. Verdict 2026-04-22 / Guardrail #6:
            // distinct facts must render distinctly.
            <div
              role="alert"
              aria-live="polite"
              className="p-12 bg-error-subtle border border-error-border rounded-md flex items-start gap-8"
            >
              <AlertTriangle size={14} className="text-error mt-px shrink-0" />
              <div className="flex flex-col gap-4 min-w-0">
                <div className="text-caption font-semibold text-error">
                  {executionError.node
                    ? `Pipeline failed at ${executionError.node}`
                    : "Pipeline failed"}
                </div>
                <div className="text-label text-text-secondary break-words">
                  {executionError.message}
                </div>
                {executionError.failedAt && (
                  <div className="text-label text-text-tertiary font-mono">
                    {new Date(executionError.failedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 bg-surface-primary rounded-md shadow-sm flex items-center gap-8 text-caption text-text-tertiary">
              <AlertTriangle size={14} />
              Agent analysis pending — Compliance Shadow has not yet completed.
            </div>
          )}

          {/* Agent Analysis: Problem / Root Cause / Recommendation
              narrative. Collapsed by default per the TRB ruling on PO
              request #4. Auto-expands when the exception sits in a
              Human-in-the-Loop state so the reviewer sees the full
              narrative the moment they open a row that needs their
              decision. */}
          {analysis && (
            <AgentAnalysisSection
              analysis={analysis}
              defaultOpen={isHumanInTheLoopState(detail.lifecycle_state)}
            />
          )}

          {/* ── Data-presence-driven enrichment sections ─────────────── */}
          {/* These render ONLY when their data is present in the analysis.
              A new intent that populates these fields automatically gets
              their sections rendered — zero UI code changes needed.
              Each is wrapped in CollapsibleSection (always collapsed —
              PO clarification 2026-05-03): the operator scans the
              Recommendation card first and only drills into the
              evidence sections when they need to assess in detail.
              The wrapper mounts the child only when open so heavy
              renders stay deferred. Section titles match the spec
              expectations exactly so playwright tests can click them
              by name to expand. */}
          {analysis?.price_analysis && (
            <CollapsibleSection title="Price Analysis">
              <PriceAnalysisSection data={analysis.price_analysis} />
            </CollapsibleSection>
          )}
          {analysis?.duplicate_detection && (
            <CollapsibleSection title="Duplicate Detection">
              <DuplicateDetectionSection data={analysis.duplicate_detection} />
            </CollapsibleSection>
          )}
          {analysis?.order_comparison && (
            <CollapsibleSection title="Order Comparison">
              <OrderComparisonSection data={analysis.order_comparison} />
            </CollapsibleSection>
          )}
          {analysis?.backorder_analysis && (
            <CollapsibleSection title="Back-Order Analysis">
              <BackOrderSection
                data={analysis.backorder_analysis}
                resolvedAction={detail.resolved_action}
              />
            </CollapsibleSection>
          )}
          {analysis?.overmax_analysis && (
            <CollapsibleSection title="Over-Max Analysis">
              <OverMaxSection data={analysis.overmax_analysis} />
            </CollapsibleSection>
          )}
          {analysis?.moq_analysis && (
            <CollapsibleSection title="MOQ Analysis">
              <MOQSection data={analysis.moq_analysis} />
            </CollapsibleSection>
          )}
          {analysis?.pallet_analysis && (
            <CollapsibleSection title="Pallet Configuration">
              <PalletConfigSection data={analysis.pallet_analysis} />
            </CollapsibleSection>
          )}
          {analysis?.delivery_delay_analysis && (
            <CollapsibleSection title="Delivery Delay">
              <DeliveryDelaySection data={analysis.delivery_delay_analysis} />
            </CollapsibleSection>
          )}
          {analysis?.price_hold_analysis && (
            <CollapsibleSection title="Price Hold">
              <PriceHoldSection data={analysis.price_hold_analysis} />
            </CollapsibleSection>
          )}
          {analysis?.edi_mismatch_analysis && (
            <CollapsibleSection title="EDI Mismatch">
              <EdiMismatchSection data={analysis.edi_mismatch_analysis} />
            </CollapsibleSection>
          )}
          {/* ADR-034 Phase G — EmailSourceSection mounts ABOVE the
              recipe-recommendation section so the CSA sees the source
              email substrate first, then the agent's recommendation.
              Both gated by data-presence; no per-intent dispatch. */}
          {analysis?.email_source && (
            <CollapsibleSection title="Source Email">
              <EmailSourceSection data={analysis.email_source} />
            </CollapsibleSection>
          )}
          {analysis?.email_order_entry_analysis && (
            <CollapsibleSection title="Email Order Intake">
              <EmailOrderEntrySection data={analysis.email_order_entry_analysis} />
            </CollapsibleSection>
          )}
          {/* ADR-042 Phase 2 — Customer Inbox Entities tab. Data-presence
              gated; preview-only until the composer adapter lands. */}
          {analysis?.entities_analysis && (
            <CollapsibleSection title="Entities">
              <EntitiesSection data={analysis.entities_analysis} />
            </CollapsibleSection>
          )}
          {/* ADR-042 Phase 2 — Customer Inbox SAP Data tab. Data-presence
              gated; preview-only until the SAP-gateway adapter lands. */}
          {analysis?.sap_data_analysis && (
            <CollapsibleSection title="SAP Data">
              <SapDataSection data={analysis.sap_data_analysis} />
            </CollapsibleSection>
          )}
          {/* ADR-042 Phase 3 — Customer Inbox Order Entry tab (extracted order
              form). Data-presence gated; preview-only until the extraction
              gateway lands. */}
          {analysis?.order_entry_extraction && (
            <CollapsibleSection title="Order Entry">
              <OrderEntrySection data={analysis.order_entry_extraction} />
            </CollapsibleSection>
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
            onFirstOpen={ensureLineItemsLoaded}
          />

          {/* ━━ 5. Diagnostics ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <DiagnosticsSection
            detail={detail}
            trace={trace}
            showPreview={showPreview}
            onFirstOpen={ensureTraceLoaded}
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
          Guardrail #2 — the UI never hardcodes enum values. The server
          may narrow the set per-exception via resolution_data.allowed_actions
          (prefer that narrower list). Reason-tag vocabulary is
          per-intent when available, otherwise global.
          The `intent` prop lets the dialog apply UI-side cluster
          grouping per ADR-033 §D (DUPLICATE_PO renders 3 clusters;
          other intents fall back to a flat list). Free-text notes are
          required only when reason is OTHER (ADR-033 §D.3). */}
      {(() => {
        const narrowed = detail?.resolution_data
          && typeof detail.resolution_data === "object"
          && Array.isArray((detail.resolution_data as Record<string, unknown>).allowed_actions)
          ? ((detail.resolution_data as Record<string, unknown>).allowed_actions as string[])
          : null;
        const allowedActions = narrowed ?? health?.allowed_resolution_actions ?? [];
        const perIntentTags = detail?.intent
          ? health?.allowed_override_reason_tags_by_intent?.[detail.intent]
          : undefined;
        const allowedReasonTags = perIntentTags ?? health?.allowed_override_reason_tags ?? [];
        return (
          <OverrideChooserDialog
            open={overrideOpen}
            onOpenChange={setOverrideOpen}
            action={overrideAction}
            onActionChange={setOverrideAction}
            reasonTag={overrideReasonTag}
            onReasonTagChange={setOverrideReasonTag}
            notes={overrideNotes}
            onNotesChange={setOverrideNotes}
            onSubmit={submitOverride}
            submitting={actionInFlight === "override"}
            allowedActions={allowedActions}
            allowedReasonTags={allowedReasonTags}
            intent={detail?.intent ?? undefined}
          />
        );
      })()}
    </div>
  );
}
