/**
 * ExceptionDetailPanel — Unified polymorphic exception detail view.
 *
 * Orchestrates 5 layer sub-components in a consistent layout.
 * Each sub-component is intent-agnostic — driven by data presence,
 * not intent strings. New intents that produce specialized data
 * (e.g., duplicate_detection, order_comparison) get their sections
 * rendered automatically — zero UI code changes.
 *
 * Layout (information hierarchy — 2026-06-07 UX pass):
 *   1. HeaderRibbon      — breadcrumb context identifiers          (Priority 1)
 *   1b. ImpactBar        — financial/business impact, always shown (Priority 1)
 *   2. ContextStrip      — entity profile (impact moved to ImpactBar)
 *   3. AgentReasoningCard — Layer 1/2 recommendation + actions     (Priority 1)
 *   3b. AgentAnalysis    — problem / root cause / recommendation prose
 *      + data-presence enrichment sections; the section named by the
 *        backend `primary_section` hint auto-expands               (Priority 2)
 *   4+5. Evidence / Diagnostics — tabbed; Diagnostics isolated     (Priority 4)
 *
 * The Agent recommendation is never tabbed (Guardrail #4).
 * Governance: Human = Review Authority (Approve/Reject/Escalate only).
 */
"use client";

import { useState, useEffect, useRef, useCallback, type ComponentProps, type MutableRefObject } from "react";
import { signIn } from "next-auth/react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import {
  AgentReasoningCard,
  type ExecutionError,
} from "@/components/ui/AgentReasoningCard";
import { useToast } from "@/components/ui/Toast";
import { useCaseTelemetry } from "@/hooks/useCaseTelemetry";
import { casesRowV2Enabled } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { toCanonicalConfidence } from "@/lib/confidence";
import { useAuth } from "@/hooks/useAuth";
import { useHealth } from "@/hooks/useHealth";
import { useExceptionActions } from "@/hooks/useExceptionActions";
import { EvidenceSelectionProvider } from "@/hooks/useEvidenceSelection";
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
import { COSIGN_LIFECYCLE_STATE, CollapsibleSection, HITL_LIFECYCLE_STATES, Layer2OpenContext } from "./shared";
import { HeaderRibbon } from "./HeaderRibbon";
import { ContextStrip } from "./ContextStrip";
import { ImpactBar } from "./ImpactBar";
import { Tabs } from "@/components/ui/Tabs";
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
import { Edi850Section } from "./Edi850Section";
import { ChangeAnalysisSection } from "./ChangeAnalysisSection";
import { KnowledgeGraphSection } from "./KnowledgeGraphSection";
import { DraftReplySection } from "./DraftReplySection";
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

// ADR-041 P3e §2.2 — gates the Analysis-above-Recommendation
// reorder. Rollout policy in `src/lib/flags.ts` (production stays
// OFF; Vercel preview deploys default ON). When ON,
// `<AgentAnalysisSection>` renders above the Recommendation card.
// ADR-045 CP3 — the flag no longer gates an action host: actions
// live in the Recommendation card in both modes (the separate
// ribbon is retired). Agent Analysis is collapsed by default and
// auto-expands only for HITL states, keeping the card's actions
// above the fold.
const CASES_ROW_V2 = casesRowV2Enabled();

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
  /**
   * S1 findings #1, #5, #7, #8 — when this panel is mounted inside
   * `CaseDetailPanel` on the /cases workspace, the case-level chrome
   * already surfaces customer, case id, status, SLA, and compliance
   * verdict. `embedded` propagates into the child layer components
   * (`HeaderRibbon`, `ContextStrip`) to suppress those duplicated
   * surfaces so the operator does not parse the same fact twice or
   * three times before reaching the action ribbon.
   */
  embedded?: boolean;
}

/* ── Component ───────────────────────────────────────────────────────── */

export default function ExceptionDetailPanel({
  exceptionId,
  onActionComplete,
  onRefreshRef,
  reanalyzing,
  embedded = false,
}: ExceptionDetailPanelProps) {
  const { hasPermission, user } = useAuth();
  const { health } = useHealth();
  const { addToast } = useToast();
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

  // DoR #11 — automation-bias telemetry. Measure time-on-case and whether the
  // operator expanded any Layer-2 evidence before acting; reported once per
  // decision. Both reset when the operator switches to a different case.
  const detailOpenedAtRef = useRef<number>(Date.now());
  const layer2OpenedRef = useRef<boolean>(false);
  // ADR-043 §2.7 — whether an in-document evidence highlight was shown for this
  // decision (decision-quality cohort).
  const highlightShownRef = useRef<boolean>(false);
  useEffect(() => {
    detailOpenedAtRef.current = Date.now();
    layer2OpenedRef.current = false;
    highlightShownRef.current = false;
  }, [exceptionId]);
  const markLayer2Opened = useCallback(() => {
    layer2OpenedRef.current = true;
  }, []);
  const markHighlightShown = useCallback(() => {
    highlightShownRef.current = true;
  }, []);
  const reportingOnActionComplete = useCallback(() => {
    void exceptionsApi.reportReviewerActivity({
      dwell_ms: Date.now() - detailOpenedAtRef.current,
      layer2_opened: layer2OpenedRef.current,
      highlight_shown: highlightShownRef.current,
    });
    onActionComplete?.();
  }, [onActionComplete]);

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

  /**
   * Operator edit of the AI draft reply (ADR-042 Phase 7 follow-on). The
   * write goes through `editDraftReply` (which appends an OPERATOR_EDIT
   * revision server-side) and then a full refresh re-projects the new
   * revision chain onto `analysis.draft_reply`. Errors propagate to the
   * inline composer in `DraftReplySection` (which surfaces the message);
   * the success toast fires only on a clean write. Kept here rather than in
   * `useExceptionActions` because it targets the analysis projection, not
   * the exception lifecycle — no `actionInFlight` coupling.
   */
  const handleEditDraftReply = useCallback(
    async (edit: { subject: string; body: string }) => {
      await exceptionsApi.editDraftReply(exceptionId, {
        subject: edit.subject,
        body: edit.body,
        notes: "Operator edited AI draft reply before send.",
      });
      await refreshDetail();
      addToast("success", "Draft reply updated — new revision saved.");
    },
    [exceptionId, refreshDetail, addToast],
  );

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
    handleOverride, submitOverride, handleReanalyze,
    openCosign, submitCosign,
    overrideOpen, setOverrideOpen,
    overrideAction, setOverrideAction,
    overrideNotes, setOverrideNotes,
    overrideReasonTag, setOverrideReasonTag,
    cosignPending, setCosignPending,
    cosignNotes, setCosignNotes,
  } = useExceptionActions({
    exceptionId,
    detail,
    setDetail,
    onActionComplete: reportingOnActionComplete,
    refreshDetail,
  });

  // ADR-041 P3e Phase 3 sign-off gate #5 — telemetry for the V2
  // surfaces. Hook always mounts (Rules of Hooks); passing
  // undefined for the case id makes `markFirstAction` a no-op so
  // flag-off mode is byte-for-byte identical at the wire level.
  // ADR-045 CP3 — the wrapped handlers now feed the single
  // AgentReasoningCard action host (the StickyActionRibbon is
  // retired); telemetry stays preview-gated via telemetryCaseId.
  const telemetryCaseId = CASES_ROW_V2
    ? (detail?.parent_case_id ?? undefined)
    : undefined;
  const { markFirstAction, markActionSubmit, trackAnalysisScroll } =
    useCaseTelemetry(telemetryCaseId);

  // S2 finding #7 (sprint 2026-05-28) — propagate the operator-picked
  // reason_tag (YELLOW/RED Approve/Reject) through the telemetry
  // wrapper into the action hook. Undefined preserves the GREEN
  // auto-pick path.
  //
  // S2 finding #8 (sprint 2026-05-28) — fire the end-to-end CSA-time
  // metric alongside the legacy first-action metric. Both fire from
  // the same confirm callback today; the new metric carries
  // reason_tag for calibration joins, the legacy one stays for
  // backward-compat dashboards.
  const handleApproveWithTelemetry = (comment: string, reasonTagOverride?: string) => {
    markFirstAction("approve");
    markActionSubmit("approve", reasonTagOverride);
    handleApprove(comment, reasonTagOverride);
  };
  const handleRejectWithTelemetry = (comment: string, reasonTagOverride?: string) => {
    markFirstAction("reject");
    markActionSubmit("reject", reasonTagOverride);
    handleReject(comment, reasonTagOverride);
  };
  const handleEscalateWithTelemetry = (reason: string) => {
    markFirstAction("escalate");
    handleEscalate(reason);
  };
  const handleOverrideWithTelemetry = () => {
    markFirstAction("override");
    handleOverride();
  };
  const handleReanalyzeWithTelemetry = (reason: string) => {
    markFirstAction("reanalyze");
    markActionSubmit("reanalyze");
    handleReanalyze(reason);
  };

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

  // ADR-032 — prefer the typed confidence signal (canonical 0–1 + calibration
  // provenance) over the legacy 0–100 scalar. Both carry the same raw score;
  // the signal also tells the card whether to frame it as calibrated.
  const confidenceSignal = analysis?.confidence_signal ?? null;
  const confidenceValue = confidenceSignal
    ? toCanonicalConfidence(confidenceSignal.value, "unit")
    : typeof analysis?.confidence === "number"
      ? toCanonicalConfidence(analysis.confidence, "percent")
      : undefined;

  // Presentation hint (backend `AnalysisResponse.primary_section`): the
  // OrderAnalysis field name of the recipe-authoritative comparison. The
  // matching enrichment section auto-expands so the Priority-2 delta is
  // visible without a click. Data-driven — no hardcoded intent dispatch
  // (Guardrail #1); a new intent that sets primary_section to its own
  // field auto-expands with zero UI changes.
  const primarySection = analysis?.primary_section ?? null;

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
    <Layer2OpenContext.Provider value={markLayer2Opened}>
    {/* ADR-043 field↔source linking — shared evidence selection across the
        entity sections and the in-document viewer. Keyed by exceptionId so
        switching records drops a stale highlight (provider remounts). */}
    <EvidenceSelectionProvider key={exceptionId}>
    <div className="h-full flex flex-col font-sans min-w-0">

      {/* ━━ 1. Dynamic Header Ribbon ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <HeaderRibbon
        detail={detail}
        entityProfile={analysis?.entity_profile}
        primarySkuLabel={primarySkuLabel}
        totalPo={totalPo}
        delta={delta}
        embedded={embedded}
      />

      {/* ━━ 1b. Impact Bar (Priority-1 financial impact) ━━━━━━━━━━━━━
          Lifts the quantitative blast radius to the top of the viewport
          so revenue-at-risk + delta are answerable in <3s without
          expanding ContextStrip. Owns the impact half of the old two-pane
          ContextStrip; the strip below now carries the entity profile
          only, so the figure is not rendered twice (S1 redundancy). */}
      <ImpactBar impactMetrics={analysis?.impact_metrics} />

      {/* ━━ 2. Context Strip (Entity Profile) ━━━━━━━━━━━━━━━━━━━━━━━━
          Impact metrics moved up into the always-visible ImpactBar; the
          strip carries customer master-data only now (no duplication). */}
      <ContextStrip
        entityProfile={analysis?.entity_profile}
        embedded={embedded}
      />

      {/* ━━ 2c. Section anchor bar (S1 finding #10) ━━━━━━━━━━━━━━━━━
          Sticky in-pane nav for the three always-present major
          sections so the operator does not linearly scroll five-to-
          eight stacked sections to reach Evidence or Diagnostics.
          Anchors target the section ids set on the major blocks
          below. The bar itself is a single Tab stop; arrow-key nav
          inside an `<a>` list is conventional and the focus ring on
          each link is design-token driven. */}
      <SectionAnchorBar
        hasSourceEmail={!!analysis?.email_source}
        hasKnowledgeGraph={!!analysis?.knowledge_graph}
        hasDraftReply={!!analysis?.draft_reply}
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
                className="flex flex-col gap-10 px-16 py-10 bg-warning-subtle border border-warning-border rounded-sm"
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
                {canCosign && !cosignPending ? (
                  <div className="flex gap-8">
                    <Button
                      variant="brand"
                      size="sm"
                      aria-label="Approve cosign"
                      disabled={actionInFlight === "cosign-approve" || actionInFlight === "cosign-reject"}
                      onClick={() => openCosign(true)}
                    >
                      {actionInFlight === "cosign-approve" ? "Approving…" : "Approve cosign"}
                    </Button>
                    <Button
                      variant="neutral"
                      size="sm"
                      aria-label="Reject cosign"
                      disabled={actionInFlight === "cosign-approve" || actionInFlight === "cosign-reject"}
                      onClick={() => openCosign(false)}
                    >
                      {actionInFlight === "cosign-reject" ? "Rejecting…" : "Reject cosign"}
                    </Button>
                  </div>
                ) : canCosign && cosignPending ? (
                  /* ADR-045 CP3 — mandatory SOX notes captured in-panel
                     (was window.prompt). Same constrained pattern as the
                     other action dialogs. */
                  <div
                    className="flex flex-col gap-8 p-12 bg-surface-primary rounded-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Cosign ${cosignPending.approve ? "approval" : "rejection"} notes required`}
                  >
                    <label className="flex flex-col gap-4 text-caption font-semibold text-text-secondary">
                      {cosignPending.approve ? "Cosign approval notes" : "Cosign rejection notes"}
                      <span aria-hidden className="text-error ml-2">*</span>
                      <textarea
                        value={cosignNotes}
                        onChange={(e) => setCosignNotes(e.target.value)}
                        placeholder="Required for the SOX audit trail — ⌘↵ to submit"
                        autoFocus
                        rows={3}
                        aria-required="true"
                        aria-keyshortcuts="Meta+Enter"
                        className="w-full px-12 py-8 border border-border rounded-sm text-caption font-sans text-text-primary bg-surface-primary resize-y outline-none focus:border-brand"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.metaKey) submitCosign();
                          if (e.key === "Escape") setCosignPending(null);
                        }}
                      />
                    </label>
                    <div className="flex gap-8 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setCosignPending(null)}>
                        Cancel
                      </Button>
                      <Button
                        variant={cosignPending.approve ? "brand" : "neutral"}
                        size="sm"
                        disabled={
                          !cosignNotes.trim()
                          || actionInFlight === "cosign-approve"
                          || actionInFlight === "cosign-reject"
                        }
                        onClick={submitCosign}
                        title={!cosignNotes.trim() ? "Enter notes first." : undefined}
                      >
                        {cosignPending.approve ? "Confirm cosign approval" : "Confirm cosign rejection"}
                      </Button>
                    </div>
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
              className="flex items-center gap-10 px-16 py-10 bg-info-subtle border border-info-border rounded-sm"
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

          {/* ADR-041 P3e §2.2 — Agent Analysis ABOVE Recommendation
              when V2 is on (cognitive sequence: diagnose → recommend
              → act). HITL auto-expand predicate preserved verbatim;
              the panel rejected widening it to all queue cases. */}
          {CASES_ROW_V2 && analysis && (
            <AgentAnalysisSection
              analysis={analysis}
              defaultOpen={isHumanInTheLoopState(detail.lifecycle_state)}
              // ADR-041 P3e Phase 3 gate #5 — wire the scroll
              // observer so the hook accumulates max-depth for
              // the analysis-scroll-depth telemetry.
              onScrollDepth={trackAnalysisScroll}
            />
          )}

          {/* S1 finding #10 — anchor target for the SectionAnchorBar.
              Zero-height span; the bar's "Recommendation" link
              scrolls here. Living outside the conditional so the
              anchor is stable whether or not a verdict is present. */}
          <span
            id="section-recommendation"
            data-section-anchor="recommendation"
            aria-hidden
          />

          {/* Agent Reasoning Card (Layer 1/2 pattern) — the
              "Recommendation" pane (PO request #4: pane 2 after Entity
              Profile). Always rendered expanded; this is the primary
              decision surface the operator must always see.
              ADR-045 CP3 — this card is the SOLE action host (the
              separate StickyActionRibbon is retired); the verdict ×
              permission matrix always renders inline here. Actions stay
              above the fold because Agent Analysis is collapsed by
              default (expanded only for HITL states). */}
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
              confidence={confidenceValue}
              confidenceCalibrated={confidenceSignal?.calibrated}
              // Council 2026-06-07 — intent shown in L1 only when it
              // discriminates the decision (backend show_intent). The
              // recipe name is an engine internal and is no longer passed
              // to the card; it lives in the Diagnostics surface.
              showIntent={analysis?.presentation?.show_intent ?? false}
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
              // ADR-045 CP3 — the Agent Recommendation pane is now the
              // SOLE action host (the separate StickyActionRibbon is
              // retired). It uses the telemetry-wrapped handlers so the
              // automation-bias metrics that previously fired only from
              // the ribbon are preserved on the single surviving surface.
              onApprove={handleApproveWithTelemetry}
              onReject={handleRejectWithTelemetry}
              onEscalate={handleEscalateWithTelemetry}
              onOverride={handleOverrideWithTelemetry}
              canApprove={hasPermission("exceptions:approve")}
              canOverride={hasPermission("exceptions:override")}
              canEscalate={hasPermission("exceptions:escalate")}
              canReanalyze={hasPermission("exceptions:override")}
              // Only expose Re-analyze when the user is authorized — the
              // card itself additionally gates on verdict/error state.
              onReanalyze={
                hasPermission("exceptions:override") ? handleReanalyzeWithTelemetry : undefined
              }
              reanalyzeAttempts={detail.reanalysis_history?.length ?? 0}
              actionInFlight={actionInFlight}
              // S2 finding #7 — per-intent reason-tag vocabulary for the
              // mandatory tag picker on YELLOW/RED Approve/Reject, falling
              // back to the global list. Both shapes come from useHealth
              // (Guardrail #2 — no hardcoded enums).
              availableReasonTags={
                detail.intent
                  ? (health?.allowed_override_reason_tags_by_intent?.[detail.intent]
                      ?? health?.allowed_override_reason_tags
                      ?? [])
                  : (health?.allowed_override_reason_tags ?? [])
              }
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
              decision.

              ADR-041 P3e §2.2 — when V2 is on, this section is moved
              ABOVE the Recommendation card (rendered earlier). The
              guard here keeps the legacy ordering for flag-off. */}
          {!CASES_ROW_V2 && analysis && (
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
          {/* Comparison-bearing enrichment sections. The one named by
              `primary_section` auto-expands (Priority-2 delta visible on
              open); the rest stay collapsed. `defaultOpen` is data-driven
              off the backend hint — no hardcoded intent dispatch. */}
          {analysis?.price_analysis && (
            <CollapsibleSection title="Price Analysis" defaultOpen={primarySection === "price_analysis"}>
              <PriceAnalysisSection data={analysis.price_analysis} />
            </CollapsibleSection>
          )}
          {analysis?.duplicate_detection && (
            <CollapsibleSection title="Duplicate Detection" defaultOpen={primarySection === "duplicate_detection"}>
              <DuplicateDetectionSection data={analysis.duplicate_detection} />
            </CollapsibleSection>
          )}
          {analysis?.order_comparison && (
            <CollapsibleSection title="Order Comparison" defaultOpen={primarySection === "order_comparison"}>
              <OrderComparisonSection data={analysis.order_comparison} />
            </CollapsibleSection>
          )}
          {analysis?.backorder_analysis && (
            <CollapsibleSection title="Back-Order Analysis" defaultOpen={primarySection === "backorder_analysis"}>
              <BackOrderSection
                data={analysis.backorder_analysis}
                resolvedAction={detail.resolved_action}
              />
            </CollapsibleSection>
          )}
          {analysis?.overmax_analysis && (
            <CollapsibleSection title="Over-Max Analysis" defaultOpen={primarySection === "overmax_analysis"}>
              <OverMaxSection data={analysis.overmax_analysis} />
            </CollapsibleSection>
          )}
          {analysis?.moq_analysis && (
            <CollapsibleSection title="MOQ Analysis" defaultOpen={primarySection === "moq_analysis"}>
              <MOQSection data={analysis.moq_analysis} />
            </CollapsibleSection>
          )}
          {analysis?.pallet_analysis && (
            <CollapsibleSection title="Pallet Configuration" defaultOpen={primarySection === "pallet_analysis"}>
              <PalletConfigSection data={analysis.pallet_analysis} />
            </CollapsibleSection>
          )}
          {analysis?.delivery_delay_analysis && (
            <CollapsibleSection title="Delivery Delay" defaultOpen={primarySection === "delivery_delay_analysis"}>
              <DeliveryDelaySection data={analysis.delivery_delay_analysis} />
            </CollapsibleSection>
          )}
          {analysis?.price_hold_analysis && (
            <CollapsibleSection title="Price Hold" defaultOpen={primarySection === "price_hold_analysis"}>
              <PriceHoldSection data={analysis.price_hold_analysis} />
            </CollapsibleSection>
          )}
          {analysis?.edi_mismatch_analysis && (
            <CollapsibleSection title="EDI Mismatch" defaultOpen={primarySection === "edi_mismatch_analysis"}>
              <EdiMismatchSection data={analysis.edi_mismatch_analysis} />
            </CollapsibleSection>
          )}
          {/* ADR-034 Phase G — EmailSourceSection mounts ABOVE the
              recipe-recommendation section so the CSA sees the source
              email substrate first, then the agent's recommendation.
              Both gated by data-presence; no per-intent dispatch. */}
          {analysis?.email_source && (
            <CollapsibleSection title="Source Email" id="section-source-email">
              <EmailSourceSection
                data={analysis.email_source}
                caseId={detail.parent_case_id ?? undefined}
                onHighlightShown={markHighlightShown}
              />
            </CollapsibleSection>
          )}
          {analysis?.email_order_entry_analysis && (
            <CollapsibleSection title="Manual Order Intake">
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
          {/* ADR-042 Phase 5 — Customer Inbox EDI 850 Audit tab (deterministic
              X12 850 reconstruction). Data-presence gated; preview-only until
              the edi_850 builder producer lands. */}
          {analysis?.edi_850_audit && (
            <CollapsibleSection title="EDI 850 Audit">
              <Edi850Section data={analysis.edi_850_audit} />
            </CollapsibleSection>
          )}
          {/* ADR-042 Phase 6 — Customer Inbox Change Analysis tab (deterministic
              constraint evaluation + scenarios + decision). Data-presence gated;
              preview-only until the change_analysis producer lands. */}
          {analysis?.change_analysis && (
            <CollapsibleSection title="Change Analysis">
              <ChangeAnalysisSection data={analysis.change_analysis} />
            </CollapsibleSection>
          )}
          {/* ADR-042 Phase 7 — Knowledge Graph tab (derived entity projection).
              Data-presence gated; preview-only / deferrable until the
              knowledge_graph producer lands. */}
          {analysis?.knowledge_graph && (
            <CollapsibleSection title="Knowledge Graph" id="section-knowledge-graph">
              <KnowledgeGraphSection data={analysis.knowledge_graph} />
            </CollapsibleSection>
          )}
          {/* ADR-042 Phase 7 — AI Draft Reply evidence (projected from
              resolution_data.reply_draft). Data-presence gated; absent until a
              DRAFT_REPLY disposition runs. The CSA can edit the draft in place
              (RBAC-gated) — the edit appends an OPERATOR_EDIT revision; the
              "Jump to source email" link expands the Source Email section
              above when that section is present. */}
          {analysis?.draft_reply && (
            <CollapsibleSection title="AI Draft Reply" id="section-draft-reply" defaultOpen>
              <DraftReplySection
                data={analysis.draft_reply}
                sourceSectionId={analysis.email_source ? "section-source-email" : undefined}
                onSubmitEdit={handleEditDraftReply}
                canEdit={hasPermission("exceptions:approve")}
              />
            </CollapsibleSection>
          )}

          {/* ━━ 4+5. Evidence / Diagnostics — tabbed ━━━━━━━━━━━━━━━━━━
              System Diagnostics (raw trace, executed-node timeline, LLM
              metrics) is isolated into its own tab (Priority 4) so it no
              longer sits in the primary scroll under Evidence. Evidence is
              the default tab. The Agent recommendation is NOT tabbed (it
              stays in the persistent header above) — Guardrail #4 forbids
              hiding the AI behind a tab. The "Jump to → Evidence /
              Diagnostics" anchor links still work: DetailLowerTabs selects
              the matching tab on hash, then the inner section's
              useHashOpen expands + scrolls it (jump-to-expand preserved). */}
          <DetailLowerTabs
            detail={detail}
            trace={trace}
            analysis={analysis}
            lineItems={lineItems}
            selectedLine={selectedLine}
            onSelectLine={setSelectedLine}
            selectedAnalysis={selectedAnalysis}
            totalErp={totalErp}
            totalPo={totalPo}
            showPreview={showPreview}
            onEvidenceFirstOpen={ensureLineItemsLoaded}
            onDiagnosticsFirstOpen={ensureTraceLoaded}
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
    </EvidenceSelectionProvider>
    </Layer2OpenContext.Provider>
  );
}


/* ── Section anchor bar ─────────────────────────────────────────────
 * S1 finding #10 — sticky in-pane navigation for the three always-
 * present major sections (Recommendation, Evidence, Diagnostics).
 *
 * The five-to-eight-section vertical stack on a typical exception
 * detail forces the operator to scroll past Analysis + enrichment
 * cards every time they want to reach Evidence or Diagnostics. The
 * anchor bar adds three keyboard-reachable in-page links that scroll
 * to the section ids set on the major blocks above.
 *
 * Anchors target ids; the browser owns scroll behaviour (no custom
 * scrollIntoView so we inherit `scroll-padding` / `scroll-margin`
 * design tokens). The bar is mounted once between ContextStrip and
 * the StickyActionRibbon so it sits above the scroll body.
 */
function SectionAnchorBar({
  hasSourceEmail = false,
  hasKnowledgeGraph = false,
  hasDraftReply = false,
}: {
  hasSourceEmail?: boolean;
  hasKnowledgeGraph?: boolean;
  hasDraftReply?: boolean;
}) {
  // Data-presence-driven (Guardrail #1): the three always-present majors plus
  // any optional enrichment section that actually rendered for this record.
  // Targeting a collapsed section's id makes CollapsibleSection open + scroll
  // (shared.tsx), so every link reveals its section rather than scrolling to a
  // collapsed shell. Order follows the on-page vertical order.
  const links: { href: string; label: string }[] = [
    { href: "#section-recommendation", label: "Recommendation" },
    ...(hasSourceEmail ? [{ href: "#section-source-email", label: "Source Email" }] : []),
    ...(hasKnowledgeGraph ? [{ href: "#section-knowledge-graph", label: "Knowledge Graph" }] : []),
    ...(hasDraftReply ? [{ href: "#section-draft-reply", label: "AI Draft Reply" }] : []),
    { href: "#section-evidence", label: "Evidence" },
    { href: "#section-diagnostics", label: "Diagnostics" },
  ];
  return (
    <nav
      aria-label="Detail sections"
      className="px-16 py-6 border-b border-border-subtle bg-surface-secondary shrink-0 flex items-center gap-12 text-caption overflow-x-auto"
    >
      <span className="text-label uppercase tracking-wider text-text-quaternary shrink-0">
        Jump to
      </span>
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          className="text-text-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm px-4 whitespace-nowrap"
        >
          {l.label}
        </a>
      ))}
    </nav>
  );
}

/* ── Lower-detail tabs: Evidence / Diagnostics ──────────────────────
 * Isolates the System Diagnostics surface (raw trace, executed-node
 * timeline, LLM token/cost metrics) into a dedicated tab so it no
 * longer shares the primary scroll with Evidence (Priority 4). Evidence
 * is the default tab.
 *
 * The Agent recommendation is deliberately NOT tabbed — it lives in the
 * persistent header above this control (Guardrail #4: the AI is never
 * hidden behind a tab).
 *
 * Hash-aware: the SectionAnchorBar's "Jump to → Evidence / Diagnostics"
 * links still resolve. On a matching hash this selects the right tab,
 * which mounts the section; the section's own `useHashOpen(anchorId, …)`
 * then expands + scrolls it (the jump-to-expand mechanism, finding #4,
 * is preserved unchanged). Prop types are picked straight off the child
 * components so this passthrough can't drift from their contracts.
 */
function DetailLowerTabs({
  showPreview,
  onEvidenceFirstOpen,
  onDiagnosticsFirstOpen,
  ...rest
}: {
  showPreview: boolean;
  onEvidenceFirstOpen: () => void;
  onDiagnosticsFirstOpen: () => void;
} & Pick<
  ComponentProps<typeof EvidenceGrid>,
  | "lineItems"
  | "analysis"
  | "selectedLine"
  | "onSelectLine"
  | "selectedAnalysis"
  | "totalErp"
  | "totalPo"
> &
  Pick<ComponentProps<typeof DiagnosticsSection>, "detail" | "trace">) {
  const [active, setActive] = useState<"evidence" | "diagnostics">("evidence");

  // Select the tab named by the URL hash so the anchor-bar jump links
  // reveal the right surface (then the inner useHashOpen expands it).
  useEffect(() => {
    const sync = () => {
      const h = typeof window !== "undefined" ? window.location.hash : "";
      if (h === "#section-diagnostics") setActive("diagnostics");
      else if (h === "#section-evidence") setActive("evidence");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <Tabs
      ariaLabel="Evidence and diagnostics"
      value={active}
      onValueChange={(id) => setActive(id as "evidence" | "diagnostics")}
      tabs={[
        { id: "evidence", label: "Evidence" },
        { id: "diagnostics", label: "Diagnostics" },
      ]}
      renderPanel={(id) =>
        id === "evidence" ? (
          <div data-section-anchor="evidence" className="pt-12">
            <EvidenceGrid
              lineItems={rest.lineItems}
              analysis={rest.analysis}
              selectedLine={rest.selectedLine}
              onSelectLine={rest.onSelectLine}
              selectedAnalysis={rest.selectedAnalysis}
              totalErp={rest.totalErp}
              totalPo={rest.totalPo}
              onFirstOpen={onEvidenceFirstOpen}
              anchorId="section-evidence"
            />
          </div>
        ) : (
          <div data-section-anchor="diagnostics" className="pt-12">
            <DiagnosticsSection
              detail={rest.detail}
              trace={rest.trace}
              showPreview={showPreview}
              onFirstOpen={onDiagnosticsFirstOpen}
              anchorId="section-diagnostics"
            />
          </div>
        )
      }
    />
  );
}
