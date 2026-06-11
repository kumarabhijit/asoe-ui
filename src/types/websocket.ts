/**
 * WebSocket event types — aligned with asoe2/api/events.py
 *
 * These types define the real-time communication protocol (Section 8)
 * for pipeline progress updates that drive the WaterfallStepper component.
 */

import type { PipelineNode, NodeStatus } from "./exceptions";

/* ── Event envelope ────────────────────────────────────────────────── */

export type WSEventType =
  | "pipeline_progress"
  | "exception_update"
  | "task_complete"
  | "error"
  | "reanalysis_started"
  // ADR-038 §H.6 / Phase 28.5 — case-level events. `useCases` invalidates
  // the case list on these. Carry `case_id` rather than `exception_id`.
  | "case_open"
  | "case_update"
  | "case_close"
  // ADR-042 Phase 4 — AI Draft Reply live events. Carry `exception_id`.
  // `useCases` invalidates the list on these too (a drafted/sent reply
  // changes the record the case projects).
  | "reply_drafted"
  | "reply_sent";

export interface WSEvent {
  type: WSEventType;
  trace_id: string;
  /** Set on per-event subjects (pipeline_progress, exception_update,
   *  task_complete, error, reanalysis_started). Null on case_* events. */
  exception_id: string | null;
  /** Set on case-level events (case_open, case_update, case_close).
   *  Null on per-event subjects. */
  case_id: string | null;
  tenant_id: string;
  timestamp: string;
  payload:
    | PipelineProgressPayload
    | ExceptionUpdatePayload
    | TaskCompletePayload
    | WSErrorPayload
    | ReanalysisStartedPayload
    | CaseOpenedPayload
    | CaseUpdatedPayload
    | CaseClosedPayload
    | ReplyDraftedPayload
    | ReplySentPayload;
}

/* ── Payload types ─────────────────────────────────────────────────── */

/**
 * Mirrors `PipelineProgressPayload` in asoe2/api/events.py.
 *
 * ADR-027 Phase B batches one event per record state change, carrying
 * the full executed-nodes list to date in `executed_nodes` (the UI
 * reconciles idempotently against the full list). The per-node fields
 * (`node`, `status`, `duration_ms`, `data`) are the legacy unbatched
 * shape — optional on the wire and unused on the Phase B path.
 */
export interface PipelineProgressPayload {
  node?: PipelineNode;
  status?: NodeStatus;
  duration_ms?: number;
  data?: {
    intent?: string;
    confidence?: number;
    shadow_verdict?: string;
    shadow_reasons?: string[];
    selected_recipe?: string;
    final_status?: string;
    explanation?: string;
  };
  /** Phase B batched form — full executed-nodes list to date. */
  executed_nodes?: Array<Record<string, unknown>>;
  final_status?: string;
}

export interface ExceptionUpdatePayload {
  lifecycle_state: string;
  updated_fields: string[];
}

export interface TaskCompletePayload {
  task_id: string;
  final_status: string;
  explanation?: string;
}

export interface WSErrorPayload {
  code: string;
  message: string;
}

/** Published at the start of a human-triggered reanalysis, before
 *  run_graph runs. UI uses this to flip the detail panel into a
 *  "re-running" state ahead of the streaming pipeline_progress events. */
export interface ReanalysisStartedPayload {
  attempt: number;
  triggered_by: string;
  reason: string;
  prior_trace_id?: string;
  prior_shadow_verdict?: string;
  prior_final_status?: string;
}

/* ── Case-level events (ADR-038 §H.6 / Phase 28.5) ─────────────────── */

export interface CaseOpenedPayload {
  /** Mirrors `CaseOpenedPayload.origin` in asoe2/api/events.py
   *  (the OrderCase origin enum value, e.g. CUSTOMER / EDI). */
  origin: string;
  source_channel: string;
  status: string;
  sla_deadline?: string;
  customer_po_number?: string;
  sales_order_id?: string;
}

export interface CaseUpdatedPayload {
  status: string;
  updated_fields: string[];
  sla_deadline?: string;
  // Issue #133 PO #17 — last-activity timestamp, bumped on every
  // CaseStore mutation. Mirrors `CaseUpdatedPayload.updated_at` in
  // `asoe2/api/events.py`. Optional until every emitter is on V014+.
  updated_at?: string;
}

export interface CaseClosedPayload {
  status: string;
  closed_at: string;
}

/* ── AI Draft Reply events (ADR-042 Phase 4) ───────────────────────── */
// The reply body is not carried on the wire (large, human-facing); fetch the
// record detail (resolution_data.reply_draft / reply_sent) on invalidation.

export interface ReplyDraftedPayload {
  status: string; // DRAFTED | REJECTED
  template_name?: string;
  recipient?: string;
  subject?: string;
  drafted_by?: string;
}

export interface ReplySentPayload {
  status: string; // SENT | FAILED
  recipient?: string;
  subject?: string;
  delivered?: boolean;
  sent_by?: string;
}

/* ── Auth message (first message after connect) ────────────────────── */

export interface WSAuthMessage {
  type: "auth";
  token: string;
  last_seen?: string;
}
