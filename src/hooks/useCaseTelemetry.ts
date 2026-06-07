// useCaseTelemetry — case-open telemetry lifecycle hook.
//
// ADR-041 P3e Phase 3 sign-off gate #5. Captures three metrics
// per case-open cycle:
//
//   * time-to-first-action — `markFirstAction(action)` fires the
//     metric with the dwell since hook mount. Idempotent: only
//     the FIRST call per case_id fires (subsequent calls are
//     no-ops). The caller — the Agent Recommendation pane's action
//     handlers (ADR-045 CP3) — invokes this on every action click;
//     the hook guards.
//
//   * analysis-scroll-depth — `trackAnalysisScroll(pct)` accumulates
//     the maximum scroll depth observed during the case-open cycle.
//     The accumulated value is reported on unmount.
//
// The hook is gated externally on `NEXT_PUBLIC_CASES_ROW_V2`. Flag-
// off callers never import it; flag-on callers mount it on every
// case-detail render. SSR-safe — `performance.now()` is only
// touched after mount.

"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  reportAnalysisScrollDepth,
  reportTimeToFirstAction,
  reportTimeToActionSubmit,
  type TimeToFirstActionReport,
  type TimeToActionSubmitReport,
} from "@/lib/telemetry";

export interface UseCaseTelemetryApi {
  /** Call when the operator clicks the first HITL action.
   *  Idempotent — subsequent calls are no-ops until the next
   *  case-open cycle. */
  markFirstAction: (action: TimeToFirstActionReport["first_action"]) => void;
  /** S2 finding #8 — fire when the operator confirms an action
   *  (post comment + reason_tag pick). Distinct from
   *  `markFirstAction`: that one measures time-to-decide, this one
   *  measures end-to-end CSA time. Idempotent per case-open cycle
   *  for the SAME action; a subsequent reanalyze + re-approve on
   *  the same case-open is allowed to fire again because the
   *  measurement window is the action, not the case. */
  markActionSubmit: (
    action: TimeToActionSubmitReport["action"],
    reasonTag?: string,
  ) => void;
  /** Call from the Agent Analysis section's scroll handler with
   *  the current scroll fraction (0..1). The hook keeps the max
   *  observed value and reports it on unmount. */
  trackAnalysisScroll: (pct: number) => void;
}

export function useCaseTelemetry(caseId: string | undefined): UseCaseTelemetryApi {
  // Mount timestamp — `performance.now()` is monotonic, immune to
  // wall-clock skew from operator clock fixes mid-session.
  const mountedAtRef = useRef<number | null>(null);
  const firstActionFiredRef = useRef(false);
  const maxScrollRef = useRef(0);
  const actedRef = useRef(false);
  // Latch the case id we're tracking so the unmount cleanup
  // reports against the right case even if the prop has flipped.
  const trackedCaseIdRef = useRef<string | undefined>(undefined);

  // Reset every time the case_id changes — each case is its own
  // measurement cycle. The previous case's unmount fires
  // analysis-scroll-depth before reset.
  useEffect(() => {
    if (!caseId) return;
    mountedAtRef.current = performance.now();
    firstActionFiredRef.current = false;
    maxScrollRef.current = 0;
    actedRef.current = false;
    trackedCaseIdRef.current = caseId;
    const trackedId = caseId;

    return () => {
      // Cleanup fires on unmount OR when caseId flips. Report
      // the scroll depth for the case we WERE tracking.
      const finalMax = maxScrollRef.current;
      if (finalMax > 0) {
        reportAnalysisScrollDepth({
          case_id: trackedId,
          max_scroll_pct: finalMax,
          acted: actedRef.current,
        });
      }
    };
  }, [caseId]);

  const markFirstAction = useCallback(
    (action: TimeToFirstActionReport["first_action"]) => {
      if (firstActionFiredRef.current) return;
      if (mountedAtRef.current === null) return;
      if (!trackedCaseIdRef.current) return;
      firstActionFiredRef.current = true;
      actedRef.current = true;
      reportTimeToFirstAction({
        case_id: trackedCaseIdRef.current,
        dwell_ms: Math.round(performance.now() - mountedAtRef.current),
        first_action: action,
      });
    },
    [],
  );

  const markActionSubmit = useCallback(
    (action: TimeToActionSubmitReport["action"], reasonTag?: string) => {
      if (mountedAtRef.current === null) return;
      if (!trackedCaseIdRef.current) return;
      // Also marks "acted" so the analysis-scroll-depth cleanup
      // reports the operator did follow through with a confirmation
      // — distinct from the first-action mark which fires earlier.
      actedRef.current = true;
      reportTimeToActionSubmit({
        case_id: trackedCaseIdRef.current,
        dwell_ms: Math.round(performance.now() - mountedAtRef.current),
        action,
        reason_tag: reasonTag,
      });
    },
    [],
  );

  const trackAnalysisScroll = useCallback((pct: number) => {
    // Clamp to [0, 1] — guard against out-of-range observer
    // readings under animated scroll.
    const clamped = Math.max(0, Math.min(1, pct));
    if (clamped > maxScrollRef.current) {
      maxScrollRef.current = clamped;
    }
  }, []);

  return { markFirstAction, markActionSubmit, trackAnalysisScroll };
}
