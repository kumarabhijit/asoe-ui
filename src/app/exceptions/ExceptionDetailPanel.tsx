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
 *      + operator-tier enrichment sections; the section named by the
 *        backend `primary_section` hint auto-expands               (Priority 2)
 *   4. Evidence group   — ONE collapsed disclosure gathering the
 *        evidence-tier sections + line-item grid (auto-opens for
 *        needs-human states; collapsed for auto-resolved)          (Layer 2)
 *   5. Diagnostics & Audit group — ONE collapsed disclosure gathering
 *        the audit-tier sections + raw-trace pane (always collapsed) (Layer 2)
 *
 * Tier placement is backend-driven (presentation.section_tiers); the UI
 * groups each tier into a single disclosure and never re-decides
 * placement (Guardrail #0/#1). Stacked-group layout — council 2026-06-07.
 *
 * Governance: Human = Review Authority (Approve/Reject/Escalate only).
 */
"use client";

import { useState, useEffect, useRef, useCallback, cloneElement, type MutableRefObject, type ReactNode, type ReactElement } from "react";
import { signIn } from "next-auth/react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import {
  AgentReasoningCard,
  type ExecutionError,
} from "@/components/ui/AgentReasoningCard";
import { useToast } from "@/components/ui/Toast";
import { useCaseTelemetry } from "@/hooks/useCaseTelemetry";
import { casesRowV2Enabled, cockpitEnabled } from "@/lib/flags";
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
import { COSIGN_LIFECYCLE_STATE, CollapsibleSection, HITL_LIFECYCLE_STATES, Layer2OpenContext, type CollapsibleLevel } from "./shared";
import { HeaderRibbon } from "./HeaderRibbon";
import { ContextStrip } from "./ContextStrip";
import { ImpactBar } from "./ImpactBar";
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
// Cockpit redesign (cockpit-refactor) — presentational opt-in. OFF by
// default, so the classic layout and its locks are unchanged.
const COCKPIT = cockpitEnabled();

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
  /**
   * Extra content to render inside the single "Diagnostics & Audit" group
   * (council follow-up 2026-06-09). The `/cases` workspace owns case-level
   * classification provenance; rather than render its OWN second
   * "Diagnostics & Audit" drawer below this panel (the duplicate the
   * operator flagged), it injects that provenance here so there is exactly
   * ONE Diagnostics & Audit surface. A passed-in node, not UI composition
   * (Guardrail #6) — the panel just renders the slot.
   */
  auditExtras?: ReactNode;
}

/* ── Component ───────────────────────────────────────────────────────── */

export default function ExceptionDetailPanel({
  exceptionId,
  onActionComplete,
  onRefreshRef,
  reanalyzing,
  embedded = false,
  auditExtras,
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

  /* ── Enrichment-section placement (council 2026-06-07) ───────────────
     Each data-present enrichment section is built once here, then routed
     by the backend `presentation.section_tiers` authority:
       operator -> Layer 1 · evidence -> Evidence tier · audit -> Diagnostics tier.
     The UI HONORS the tier and never re-decides placement (Guardrail
     #0/#1). Unknown keys fail-open to "evidence" (shown, not buried).
     Sections are the SAME dumb projectors as before (Guardrail #6) —
     only their placement moved off the flat Layer-1 stack. */
  const enrichmentSections: { key: string; node: ReactNode; anchorId?: string }[] = [];
  if (analysis) {
    if (analysis.price_analysis) enrichmentSections.push({ key: "price_analysis", node: (
      <CollapsibleSection key="price_analysis" title="Price Analysis" defaultOpen={primarySection === "price_analysis"}>
        <PriceAnalysisSection data={analysis.price_analysis} />
      </CollapsibleSection>
    ) });
    if (analysis.duplicate_detection) enrichmentSections.push({ key: "duplicate_detection", node: (
      <CollapsibleSection key="duplicate_detection" title="Duplicate Detection" defaultOpen={primarySection === "duplicate_detection"}>
        <DuplicateDetectionSection data={analysis.duplicate_detection} />
      </CollapsibleSection>
    ) });
    if (analysis.order_comparison) enrichmentSections.push({ key: "order_comparison", node: (
      <CollapsibleSection key="order_comparison" title="Order Comparison" defaultOpen={primarySection === "order_comparison"}>
        <OrderComparisonSection data={analysis.order_comparison} />
      </CollapsibleSection>
    ) });
    if (analysis.backorder_analysis) enrichmentSections.push({ key: "backorder_analysis", node: (
      <CollapsibleSection key="backorder_analysis" title="Back-Order Analysis" defaultOpen={primarySection === "backorder_analysis"}>
        <BackOrderSection data={analysis.backorder_analysis} resolvedAction={detail.resolved_action} />
      </CollapsibleSection>
    ) });
    if (analysis.overmax_analysis) enrichmentSections.push({ key: "overmax_analysis", node: (
      <CollapsibleSection key="overmax_analysis" title="Over-Max Analysis" defaultOpen={primarySection === "overmax_analysis"}>
        <OverMaxSection data={analysis.overmax_analysis} />
      </CollapsibleSection>
    ) });
    if (analysis.moq_analysis) enrichmentSections.push({ key: "moq_analysis", node: (
      <CollapsibleSection key="moq_analysis" title="MOQ Analysis" defaultOpen={primarySection === "moq_analysis"}>
        <MOQSection data={analysis.moq_analysis} />
      </CollapsibleSection>
    ) });
    if (analysis.pallet_analysis) enrichmentSections.push({ key: "pallet_analysis", node: (
      <CollapsibleSection key="pallet_analysis" title="Pallet Configuration" defaultOpen={primarySection === "pallet_analysis"}>
        <PalletConfigSection data={analysis.pallet_analysis} />
      </CollapsibleSection>
    ) });
    if (analysis.delivery_delay_analysis) enrichmentSections.push({ key: "delivery_delay_analysis", node: (
      <CollapsibleSection key="delivery_delay_analysis" title="Delivery Delay" defaultOpen={primarySection === "delivery_delay_analysis"}>
        <DeliveryDelaySection data={analysis.delivery_delay_analysis} />
      </CollapsibleSection>
    ) });
    if (analysis.price_hold_analysis) enrichmentSections.push({ key: "price_hold_analysis", node: (
      <CollapsibleSection key="price_hold_analysis" title="Price Hold" defaultOpen={primarySection === "price_hold_analysis"}>
        <PriceHoldSection data={analysis.price_hold_analysis} />
      </CollapsibleSection>
    ) });
    if (analysis.edi_mismatch_analysis) enrichmentSections.push({ key: "edi_mismatch_analysis", node: (
      <CollapsibleSection key="edi_mismatch_analysis" title="EDI Mismatch" defaultOpen={primarySection === "edi_mismatch_analysis"}>
        <EdiMismatchSection data={analysis.edi_mismatch_analysis} />
      </CollapsibleSection>
    ) });
    if (analysis.email_source) enrichmentSections.push({ key: "email_source", anchorId: "section-source-email", node: (
      <CollapsibleSection key="email_source" title="Source Email" id="section-source-email">
        <EmailSourceSection data={analysis.email_source} caseId={detail.parent_case_id ?? undefined} onHighlightShown={markHighlightShown} />
      </CollapsibleSection>
    ) });
    if (analysis.email_order_entry_analysis) enrichmentSections.push({ key: "email_order_entry_analysis", node: (
      <CollapsibleSection key="email_order_entry_analysis" title="Manual Order Intake">
        <EmailOrderEntrySection data={analysis.email_order_entry_analysis} />
      </CollapsibleSection>
    ) });
    if (analysis.entities_analysis) enrichmentSections.push({ key: "entities_analysis", node: (
      <CollapsibleSection key="entities_analysis" title="Entities">
        <EntitiesSection data={analysis.entities_analysis} />
      </CollapsibleSection>
    ) });
    if (analysis.sap_data_analysis) enrichmentSections.push({ key: "sap_data_analysis", node: (
      <CollapsibleSection key="sap_data_analysis" title="SAP Data">
        <SapDataSection data={analysis.sap_data_analysis} />
      </CollapsibleSection>
    ) });
    if (analysis.order_entry_extraction) enrichmentSections.push({ key: "order_entry_extraction", node: (
      <CollapsibleSection key="order_entry_extraction" title="Order Entry">
        <OrderEntrySection data={analysis.order_entry_extraction} />
      </CollapsibleSection>
    ) });
    if (analysis.edi_850_audit) enrichmentSections.push({ key: "edi_850_audit", node: (
      <CollapsibleSection key="edi_850_audit" title="EDI 850 Audit">
        <Edi850Section data={analysis.edi_850_audit} />
      </CollapsibleSection>
    ) });
    if (analysis.change_analysis) enrichmentSections.push({ key: "change_analysis", node: (
      <CollapsibleSection key="change_analysis" title="Change Analysis">
        <ChangeAnalysisSection data={analysis.change_analysis} />
      </CollapsibleSection>
    ) });
    if (analysis.knowledge_graph) enrichmentSections.push({ key: "knowledge_graph", anchorId: "section-knowledge-graph", node: (
      <CollapsibleSection key="knowledge_graph" title="Knowledge Graph" id="section-knowledge-graph">
        <KnowledgeGraphSection data={analysis.knowledge_graph} />
      </CollapsibleSection>
    ) });
    if (analysis.draft_reply) enrichmentSections.push({ key: "draft_reply", anchorId: "section-draft-reply", node: (
      <CollapsibleSection key="draft_reply" title="AI Draft Reply" id="section-draft-reply" defaultOpen>
        <DraftReplySection data={analysis.draft_reply} sourceSectionId={analysis.email_source ? "section-source-email" : undefined} onSubmitEdit={handleEditDraftReply} canEdit={hasPermission("exceptions:approve")} />
      </CollapsibleSection>
    ) });
  }
  /* Placement authority — the UI honors `section_tiers`, never re-decides. */
  const sectionTierOf = (k: string): "operator" | "evidence" | "audit" =>
    analysis?.presentation?.section_tiers?.[k] ?? "evidence";
  const operatorMembers = enrichmentSections.filter((s) => sectionTierOf(s.key) === "operator");
  const evidenceMembers = enrichmentSections.filter((s) => sectionTierOf(s.key) === "evidence");
  const auditMembers = enrichmentSections.filter((s) => sectionTierOf(s.key) === "audit");
  // Operator-tier sections render at Layer 1 (peers of the Recommendation) so
  // keep their default heading level. Evidence/audit-tier sections render
  // INSIDE a group disclosure, so demote them to the `nested` level (council
  // follow-up 2026-06-09 — the group header must visibly outrank its children
  // instead of every header sitting flat). cloneElement injects the level in
  // one place rather than threading it through all ~19 section builders.
  const asNested = (node: ReactNode) =>
    cloneElement(node as ReactElement<{ level?: CollapsibleLevel }>, { level: "nested" });
  const operatorSections = operatorMembers.map((s) => s.node);
  const evidenceSections = evidenceMembers.map((s) => asNested(s.node));
  const auditSections = auditMembers.map((s) => asNested(s.node));
  // Descendant anchor ids per group (stacked-group layout 2026-06-09) — so a
  // deep link to a child's anchor opens the enclosing group (Refinement 2).
  // The grid/trace anchors live on EvidenceGrid / DiagnosticsSection.
  const evidenceAnchorIds = ["section-line-items", ...evidenceMembers.map((s) => s.anchorId).filter((a): a is string => !!a)];
  const auditAnchorIds = ["section-trace", ...auditMembers.map((s) => s.anchorId).filter((a): a is string => !!a)];

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
      <SectionAnchorBar />

      {/* ━━ 3. Scrollable Body ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex-1 overflow-auto p-16">
        <div className="flex flex-col gap-16">

          {/* ━━ Situation (Tier 1) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              The business event in plain language — council 2026-06-07,
              presentation_tier: operator. Sourced from the backend
              presentation contract (the governed per-intent one-liner);
              structurally omitted when the backend has no honest headline
              (no fabricated text — Guardrail #6).

              Cockpit (cockpit-refactor): the situation is the operator's
              entry point, so it gets a hero treatment — larger type + a
              brand accent rule — instead of the compact classic subhead.
              Same governed text, flag-gated, additive. */}
          {analysis?.presentation?.situation_headline && (
            COCKPIT ? (
              <div className="flex items-start gap-12">
                <span aria-hidden className="mt-1 h-[26px] w-[3px] rounded-full bg-brand shrink-0" />
                <h2 className="text-title font-bold text-text-primary m-0 leading-tight">
                  {analysis.presentation.situation_headline}
                </h2>
              </div>
            ) : (
              <h2 className="text-subhead font-semibold text-text-primary m-0">
                {analysis.presentation.situation_headline}
              </h2>
            )
          )}

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
              // Cockpit hero gauge when the redesign flag is on; the
              // classic Layer-1 bar otherwise. Same value + calibration.
              confidenceVariant={COCKPIT ? "ring" : "bar"}
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

          {/* Enrichment sections are routed by presentation.section_tiers
              (assembled in the component body): operator-tier renders
              here on Layer 1; evidence-tier and audit-tier render inline
              in the Evidence / Diagnostics tiers below (stacked
              collapsible layout). This retires the flat Layer-1 stack —
              the audit ledger the cockpit (Guardrail #0) was created to
              replace. Sections stay dumb data-presence projectors; only
              their placement moved. */}
          {operatorSections}

          {/* ━━ 4. Evidence tier — ONE grouped disclosure ━━━━━━━━━━━━━
              Council 2026-06-07 / Guardrail #0: the evidence-tier sections
              (routed by the backend section_tiers authority) + the
              line-item grid are gathered under a SINGLE "Evidence"
              disclosure instead of a flat sibling stack — the audit ledger
              the cockpit was created to replace. Placement stays
              backend-driven (section_tiers); only the visual container
              changed (no UI-side re-deciding — Guardrail #0/#1).

              defaultOpen = needs-human (Guardrail #5: YELLOW/RED auto-
              expand so the justifying delta is visible without a click);
              collapsed for auto-resolved/GREEN records so they reduce to
              Situation + Recommendation. The group owns the
              #section-evidence jump anchor; descendant anchors (Source
              Email, line items) open the group via extraAnchorIds (#4). */}
          <CollapsibleSection
            title="Evidence"
            id="section-evidence"
            level="group"
            badge={evidenceMembers.length > 0 ? String(evidenceMembers.length) : undefined}
            defaultOpen={isHumanInTheLoopState(detail.lifecycle_state)}
            extraAnchorIds={evidenceAnchorIds}
          >
            <div className="flex flex-col gap-16">
              {evidenceSections}
              <EvidenceGrid
                lineItems={lineItems}
                analysis={analysis}
                selectedLine={selectedLine}
                onSelectLine={setSelectedLine}
                selectedAnalysis={selectedAnalysis}
                totalErp={totalErp}
                totalPo={totalPo}
                onFirstOpen={ensureLineItemsLoaded}
                anchorId="section-line-items"
              />
            </div>
          </CollapsibleSection>

          {/* ━━ 5. Diagnostics & Audit tier — ONE grouped disclosure ━━
              Audit-tier engine artifacts (EDI 850 Audit, Knowledge Graph —
              routed by section_tiers) + the raw-trace Diagnostics pane,
              gathered under a single "Diagnostics & Audit" disclosure.
              Always collapsed by default — pure engine/provenance internals,
              never operator-facing without an explicit open (Guardrail #0).
              Owns #section-diagnostics; descendant anchors (trace, KG) open
              the group via extraAnchorIds. */}
          <CollapsibleSection
            title="Diagnostics & Audit"
            id="section-diagnostics"
            level="group"
            badge={auditMembers.length > 0 ? String(auditMembers.length) : undefined}
            defaultOpen={false}
            extraAnchorIds={auditAnchorIds}
          >
            <div className="flex flex-col gap-16">
              {auditSections}
              <DiagnosticsSection
                detail={detail}
                trace={trace}
                showPreview={showPreview}
                onFirstOpen={ensureTraceLoaded}
                anchorId="section-trace"
              />
              {/* Single Diagnostics & Audit surface — case-level provenance
                  injected by the /cases workspace lands here, not in a second
                  drawer below the panel (the duplicate the operator flagged). */}
              {auditExtras}
            </div>
          </CollapsibleSection>

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
function SectionAnchorBar() {
  // The three always-present major surfaces. Council 2026-06-07: the
  // enrichment sections moved off the flat Layer-1 stack into the
  // Evidence / Diagnostics tiers (routed by section_tiers), so the jump
  // bar no longer enumerates per-section anchors — the two tier surfaces
  // ARE the reach targets. Targeting #section-evidence /
  // #section-diagnostics scrolls to (and reveals) the matching surface.
  const links: { href: string; label: string }[] = [
    { href: "#section-recommendation", label: "Recommendation" },
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

