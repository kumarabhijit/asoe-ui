/**
 * API request/response types — aligned with asoe2/api/schemas.py
 *
 * These types mirror the FastAPI Pydantic request/response models
 * for all REST endpoints defined in Section 6.2.
 */

import type {
  ExceptionDetail,
  ExceptionSummary,
  GatewayResponse,
} from "./exceptions";

/* ── Resolve endpoints ─────────────────────────────────────────────── */

/** POST /api/v1/exceptions/resolve — request body */
export interface ResolveRequest {
  order_id: string;
  line_item?: number;
  sku?: string;
  event_type?: string;
  po_price: number;
  sap_base_price: number;
  retailer_id?: string;
  event_ts?: string;
  requester_role?: string;
  credit_limit?: number;
  current_exposure?: number;
  line_count?: number;
  metadata?: Record<string, unknown>;
}

/** POST /api/v1/exceptions/resolve — response */
export interface ResolveResponse {
  exception_id: string;
  trace_id?: string;
  intent?: string;
  shadow_verdict?: string;
  selected_recipe?: string;
  final_status?: string;
  explanation?: string;
  execution_log?: Record<string, unknown>;
  effect_results: Record<string, unknown>[];
}

/** POST /api/v1/exceptions/resolve/async — response */
export interface AsyncResolveResponse {
  task_id: string;
  status: "queued";
}

/* ── Exception list (cursor-based pagination) ──────────────────────── */

export interface PaginatedResponse<T> {
  data: T[];
  cursor?: string;
  has_more: boolean;
}

export type ExceptionListResponse = PaginatedResponse<ExceptionSummary>;

/* ── Exception detail ──────────────────────────────────────────────── */

export type ExceptionDetailResponse = ExceptionDetail;

/* ── Override (privileged — GREEN/YELLOW/RED) ─────────────────────── */

/**
 * OverrideRequest — mirrors asoe2/api/schemas.py.
 *
 * `resolved_by` was removed as part of the trust-boundary fix: the backend
 * always uses the caller's identity (from the auth dependency), not a value
 * supplied by the client.
 */
export interface OverrideRequest {
  action: string;
  notes: string;  // mandatory (SOX)
  /**
   * Controlled-vocabulary tag categorizing the override reason. Must be one
   * of health.allowed_override_reason_tags. Phase 2 compatibility: omitting
   * defaults to "other" server-side; Phase 3 will require it.
   */
  reason_tag?: string;
}

/* ── Escalate (analyst+) ──────────────────────────────────────────── */

/**
 * EscalateRequest — POST /api/v1/exceptions/{id}/escalate.
 *
 * Decoupled from Override: routing action only, does not resolve the
 * exception. `to_role` is optional — backend routes to the caller's
 * next-up by default.
 */
export interface EscalateRequest {
  reason: string;
  to_role?: "admin" | "manager";
}

/* ── Shared mutating-request options ──────────────────────────────── */

/**
 * Per-request options for mutating API calls. Supplies an Idempotency-Key
 * when the caller wants to coordinate retries; otherwise the client
 * generates one automatically (UUID v4) per invocation to guard against
 * double-clicks and network retries.
 */
export interface RequestOptions {
  idempotencyKey?: string;
}

/* ── Approve / Reject (HITL) ──────────────────────────────────────── */

export interface ApproveRequest {
  notes?: string;
}

export interface RejectRequest {
  reason?: string;
}

/* ── Reanalyze (YELLOW/RED/FAILED — manager+) ─────────────────────── */

export interface ReanalyzeRequest {
  /** Mandatory free-text justification (SOX audit trail). */
  reason: string;
}

/* ── Challenge (GREEN tier — analyst+) ────────────────────────────── */

export interface ChallengeRequest {
  challenge_reason: string;
}

/* ── Admin Release (RED tier — admin only) ────────────────────────── */

export interface AdminReleaseRequest {
  release_reason: string;
  risk_acknowledgment: boolean;
}

/* ── Stats (dashboard) ─────────────────────────────────────────────── */

export interface StatsResponse {
  total_exceptions: number;
  open_exceptions: number;
  auto_resolved: number;
  manual_review: number;
  blocked: number;
  failed: number;
  avg_resolution_time_seconds?: number;
  by_intent: Record<string, number>;
  by_lifecycle_state: Record<string, number>;
  by_shadow_verdict: Record<string, number>;
}

/* ── Trace ─────────────────────────────────────────────────────────── */

/** A recommended SAP transaction-level step. Human-facing only —
 *  not machine-consumed, no constrained generation required. */
export interface SAPActionStep {
  transaction: string;
  table?: string;
  field?: string;
  description: string;
}

export interface TraceResponse {
  trace_id: string;
  event_id: string;
  skill_name?: string;
  intent_selected?: string;
  shadow_verdict?: string;
  shadow_policy_hits: string[];
  recipe_name?: string;
  constrained_output_schemas: Record<string, string>;
  gateway_calls: string[];
  backend_fallback?: string;
  is_fallback_generated: boolean;
  final_status?: string;
  explanation?: string;

  /* ── Human-facing structured narrative (Layer 2 enrichment) ─────
     All optional. Rendered in DiagnosticsSection when present. */
  /** Multi-paragraph human explanation of what the agent did. */
  narrative?: string;
  /** Ordered actionable steps for the operator. */
  resolution_steps?: string[];
  /** Recommended SAP steps (T-codes, tables, fields). */
  sap_actions?: SAPActionStep[];
  /** Copy-paste-ready customer communication draft. */
  customer_email_draft?: string;
}

/* ── Workflow ──────────────────────────────────────────────────────── */

export interface WorkflowStepRequest {
  step_id: string;
  intent: string;
  description: string;
  input_mapping?: Record<string, string>;
  compensation_recipe?: string;
}

export interface WorkflowRequest {
  workflow_id: string;
  name: string;
  steps: WorkflowStepRequest[];
  base_event: ResolveRequest;
}

export interface WorkflowStepResult {
  step_id: string;
  intent: string;
  status: string;
  exception_id?: string;
  explanation?: string;
}

export interface WorkflowResult {
  workflow_id: string;
  workflow_name: string;
  status: "COMPLETE" | "FAILED" | "COMPENSATED" | "PARTIAL";
  step_results: WorkflowStepResult[];
  compensation_log: string[];
}

/* ── Policy ────────────────────────────────────────────────────────── */

export interface PolicyOverrideRequest {
  policy_key: string;
  value: unknown;
  change_reason?: string;
}

export interface PolicyOverrideResponse {
  id: string;
  tenant_id: string;
  policy_key: string;
  value: unknown;
  effective_from: string;
  created_by: string;
}

/* ── Standard error envelope (Section 6.3) ─────────────────────────── */

export interface APIError {
  error: {
    code: string;
    message: string;
    trace_id?: string;
    details?: Record<string, unknown>;
  };
}
