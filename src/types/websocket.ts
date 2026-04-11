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
  | "error";

export interface WSEvent {
  type: WSEventType;
  trace_id: string;
  exception_id: string;
  tenant_id: string;
  timestamp: string;
  payload: PipelineProgressPayload | ExceptionUpdatePayload | TaskCompletePayload | WSErrorPayload;
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
  updated_fields: Record<string, unknown>;
}

export interface TaskCompletePayload {
  task_id: string;
  final_status: string;
  explanation: string;
}

export interface WSErrorPayload {
  code: string;
  message: string;
}

/* ── Auth message (first message after connect) ────────────────────── */

export interface WSAuthMessage {
  type: "auth";
  token: string;
  last_seen?: string;
}
