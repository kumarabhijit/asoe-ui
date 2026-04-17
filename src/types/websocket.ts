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
  | "reanalysis_started";

export interface WSEvent {
  type: WSEventType;
  trace_id: string;
  exception_id: string;
  tenant_id: string;
  timestamp: string;
  payload:
    | PipelineProgressPayload
    | ExceptionUpdatePayload
    | TaskCompletePayload
    | WSErrorPayload
    | ReanalysisStartedPayload;
}

/* ── Payload types ─────────────────────────────────────────────────── */

export interface PipelineProgressPayload {
  node: PipelineNode;
  status: NodeStatus;
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

/* ── Auth message (first message after connect) ────────────────────── */

export interface WSAuthMessage {
  type: "auth";
  token: string;
  last_seen?: string;
}
