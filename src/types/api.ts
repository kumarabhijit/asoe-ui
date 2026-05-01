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

/* ── Override / Cosign / Escalate ────────────────────────────────────
 *
 * Phase 2 #9: these DTOs are now re-exported from ./contracts.ts, which
 * in turn pulls from ./generated.ts (produced by `npm run generate-types`
 * from asoe2's committed OpenAPI schema). Hand-editing the shape of these
 * requests is no longer allowed — change the Pydantic model in
 * asoe2/api/schemas.py and regenerate.
 */
export type {
  CosignRequest,
  EscalateRequest,
  DispositionRequest,
} from "./contracts";

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

  /* ── Verdict Pillar 2.3 — structured audit-gap surface ──────────────
     When the build_analysis node flags AUDIT_CONTEXT_MISSING, these
     fields carry the Pydantic class name + ordered list of missing
     audit-bearing fields so auditors don't have to regex the
     free-text explanation. Both undefined when coverage was
     complete. Mirrors asoe2 api/schemas.py::TraceResponse. */
  /** Pydantic class name whose audit-bearing fields were incomplete. */
  audit_context_missing_class?: string;
  /** Ordered list of audit-bearing field names that could not be
   *  populated for this record. */
  audit_context_missing_fields?: string[];

  /* ── ADR-027 Phase B — per-node executed-trace evidence ────────
     Ordered list of nodes that ran for this record's traversal,
     each entry carrying timing + decision + exit verdict + policy
     hits + per-gateway sub-spans. Empty when the record's trace
     was written before Phase B's instrumentation landed (banner
     "executed-path evidence not available — entry pre-dates
     per-node tracking"). Mirrors asoe2 api/schemas.py::TraceResponse. */
  executed_nodes?: ExecutedNode[];
}


/* ── ADR-027 Phase A — pipeline topology (for the DAG view) ──────
   Mirrors asoe2 api/schemas.py::PipelineTopology. Cached client-
   side by topology_hash; revalidated on the useHealth polling tick. */

export interface PipelineTopologyNode {
  id: string;
  label: string;
  kind: "node" | "terminal";
}

export interface PipelineTopologyEdge {
  from_node: string;
  to_node: string;
  conditional: boolean;
  /** Human verdict label that drove the edge. Null on unconditional
   *  edges. Examples: "ok", "breach", "no_recipe", "required_gw_fail",
   *  "invocation_fail", "red", "yellow", "green",
   *  "cross_check_disagreement". */
  verdict_label: string | null;
}

export interface PipelineTopology {
  topology_hash: string;
  nodes: PipelineTopologyNode[];
  edges: PipelineTopologyEdge[];
}


/* ── ADR-027 Phase B — per-node executed-trace evidence ──────────
   Mirrors asoe2 contracts/models.py::ExecutedNode. */

export interface GatewayCallSpan {
  gateway: string;
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  status: "ok" | "error" | "timeout";
}

export interface ExecutedNode {
  /** Canonical orchestration node name (matches PipelineTopologyNode.id). */
  node: string;
  /** ISO-8601 — node start. */
  entered_at: string;
  /** ISO-8601 — node end (undefined if errored mid-flight). */
  completed_at?: string;
  /** Wall-clock duration; for resolve_dependencies this is the fan-out
   *  span (per-gateway durations live in sub_spans). */
  duration_ms?: number;
  /** Convenience top-level — equals entered_at. Kept for trace-style
   *  consistency with shadow_verdict / final_status row labels. */
  timestamp: string;
  status: "completed" | "halted" | "errored";
  /** Node-specific decision payload (intent + confidence on classify,
   *  recipe on select_recipe, shadow_status on shadow_audit, etc.). */
  decision: Record<string, unknown>;
  /** Verdict label that drove the next route. Null for nodes whose
   *  exit is not a conditional gate (ingest, load_skill,
   *  execute_recipe, apply_effects, build_analysis). */
  exit_verdict?: string | null;
  /** Populated on shadow_audit; [] elsewhere. */
  policy_hits: string[];
  /** Populated on resolve_dependencies; [] elsewhere. */
  sub_spans: GatewayCallSpan[];
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
