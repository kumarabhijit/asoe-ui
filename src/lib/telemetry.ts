// telemetry.ts — best-effort metric reporters for ADR-041 P3e
// Phase 3 sign-off gate #5 ("telemetry instrumentation live").
//
// Three metrics the gate requires:
//
//   * row-click rate          — how often operators open a case
//                               from the queue
//   * time-to-first-action    — dwell from case-open to first
//                               HITL button click
//   * analysis scroll depth   — how far operators read into the
//                               Agent Analysis section before
//                               clicking
//
// All three are best-effort: no-op in mock mode, swallow network
// failures, never raise into the UI. Pattern mirrors
// `exceptionsApi.reportReviewerActivity` (DoR #11).
//
// Gated entirely on `NEXT_PUBLIC_CASES_ROW_V2` at the consumer
// side (see `src/hooks/useCaseTelemetry.ts` and
// `src/app/cases/CasesQueueRowV2.tsx`). Flag-off paths never
// import this module's reporters, so no telemetry fires for the
// legacy row anatomy.

const USE_REAL_API = process.env.NEXT_PUBLIC_USE_REAL_API === "1";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function _post(path: string, body: unknown): Promise<void> {
  if (!USE_REAL_API) return;
  try {
    await fetch(`${API_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Telemetry must never block the operator's interaction. A
      // short timeout via AbortController would be ideal; for v1
      // we rely on the browser's default + swallow errors.
    });
  } catch {
    // best-effort — never surface to the operator
  }
}

export interface RowClickReport {
  case_id: string;
  /** Position in the visible queue (0-indexed) at the time of
   *  click. Surfaces "do operators click the top row most?" for
   *  the SLA-sort effectiveness story. */
  row_index?: number;
  /** Audit verdict color visible on the row at click time —
   *  feeds into "did the verdict color change the operator's
   *  pick?" analysis. */
  audit_verdict_color?: "R" | "A" | "G" | null;
}

/** Fire-and-forget metric for the queue-row-click rate. Called
 *  from `CasesQueueRowV2.onClick` (V2 flag gated). */
export function reportRowClick(report: RowClickReport): void {
  void _post("/api/v1/metrics/cases/row-click", report);
}

export interface TimeToFirstActionReport {
  case_id: string;
  /** Milliseconds from case-detail mount to first HITL button
   *  click (Approve / Reject / Override / Escalate / Re-analyze). */
  dwell_ms: number;
  /** Which action fired first — distinguishes "operator opened
   *  and immediately Approved" from "opened and Escalated". */
  first_action: "approve" | "reject" | "override" | "escalate" | "reanalyze";
}

/** Fire when the operator clicks the first action button on a
 *  case-open cycle. Called from `useCaseTelemetry` (V2 flag
 *  gated). */
export function reportTimeToFirstAction(
  report: TimeToFirstActionReport,
): void {
  void _post("/api/v1/metrics/cases/time-to-first-action", report);
}

export interface AnalysisScrollDepthReport {
  case_id: string;
  /** Maximum scroll depth observed on the Agent Analysis section
   *  content during this case-open cycle, as a fraction 0..1. */
  max_scroll_pct: number;
  /** Whether the operator clicked an action after observing the
   *  reported max scroll. Lets the backend correlate
   *  "did they actually read the analysis before clicking?". */
  acted: boolean;
}

/** Fire when the operator leaves a case (unmount or switch).
 *  Called from `useCaseTelemetry` cleanup (V2 flag gated). */
export function reportAnalysisScrollDepth(
  report: AnalysisScrollDepthReport,
): void {
  void _post("/api/v1/metrics/cases/analysis-scroll-depth", report);
}
