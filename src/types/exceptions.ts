/**
 * Exception domain types — aligned with asoe2/contracts/models.py
 *
 * These types mirror the backend Pydantic models. Values for enums
 * (intents, lifecycle states, recipes) are fetched from the health
 * endpoint at runtime per Guardrail #2 — the string unions here
 * exist only for type safety in components that receive API data.
 */

/* ── Enums (fetched from GET /api/v1/health at runtime) ────────────── */

/** Constrained intent values — AllowedIntent in constraints/specs.py */
export type Intent =
  | "CONTRACTUAL_CORRECTION"
  | "CREDIT_BLOCK"
  | "MASS_PRICING_ERROR"
  | "DUPLICATE_PO"
  | "UNKNOWN";

/** Shadow verdict — ShadowStatus in contracts/models.py */
export type ShadowVerdict = "GREEN" | "YELLOW" | "RED";

/** Terminal status — TerminalStatus in contracts/models.py */
export type TerminalStatus =
  | "COMPLETE"
  | "COMPLETE_WITH_CHILDREN"
  | "FAIL_TO_HUMAN"
  | "MANUAL_REVIEW_REQUIRED"
  | "BLOCKED"
  | "REJECTED";

/** Exception lifecycle state — persistence-level state machine (Section 7.1) */
export type LifecycleState =
  | "INGESTED"
  | "CLASSIFYING"
  | "AUDITING"
  | "PENDING_REVIEW"
  | "ESCALATED"
  | "EXECUTING"
  | "RESOLVED"
  | "FAILED"
  | "BLOCKED"
  | "REJECTED"
  | "CLOSED";

/** Constrained recipe names — AllowedRecipeName in constraints/specs.py */
export type RecipeName =
  | "PriceAdjustmentRecipe.py"
  | "CreditHoldReleaseRecipe.py"
  | "DuplicatePORecipe.py";

/** Resolution actions — AllowedResolutionAction in constraints/specs.py */
export type ResolutionAction =
  | "BLOCK_AND_NOTIFY"
  | "MERGE"
  | "SUPERSEDE"
  | "ALLOW_BOTH"
  | "ESCALATE"
  | "REQUEST_BUYER_CONFIRMATION";

/* ── Pipeline node names (10-node LangGraph state machine) ─────────── */

export type PipelineNode =
  | "ingest"
  | "classify"
  | "load_skill"
  | "validate_circuit_breaker"
  | "shadow_audit"
  | "select_recipe"
  | "validate_types"
  | "resolve_dependencies"
  | "execute_recipe"
  | "apply_effects";

export type NodeStatus = "started" | "completed" | "failed";

/* ── Core domain models ────────────────────────────────────────────── */

/** OrderEvent — the input to the pipeline (contracts/models.py) */
export interface OrderEvent {
  order_id: string;
  line_item: number;
  sku?: string;
  event_type: string;
  po_price: number;
  sap_base_price: number;
  retailer_id?: string;
  event_ts?: string;
  requester_role?: string;
  credit_limit?: number;
  current_exposure?: number;
  line_count: number;
  metadata: Record<string, unknown>;
}

/** ComplianceDecision — output of the Compliance Shadow */
export interface ComplianceDecision {
  status: ShadowVerdict;
  trace_id: string;
  reasons: string[];
  policy_hits: string[];
  constrained_by?: string;
}

/** ExecutionLog — trace of recipe execution */
export interface ExecutionLog {
  trace_id: string;
  recipe_name?: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  errors: string[];
  constrained_outputs: Record<string, string>;
  intent_selected?: string;
  rag_chunks: string[];
  shadow_policy_hits: string[];
  skill_name?: string;
  shadow_verdict?: string;
  resolved_by?: string;
  resolved_action?: string;
  resolution_notes?: string;
}

/** GatewayResponse — result of a gateway call */
export interface GatewayResponse {
  gateway_name: string;
  operation: string;
  status: "SUCCESS" | "FAILED" | "TIMEOUT" | "UNAVAILABLE";
  data: Record<string, unknown>;
  error?: string;
  duration_ms?: number;
}

/* ── Exception record (persistence model) ──────────────────────────── */

/** ExceptionSummary — list view (GET /api/v1/exceptions) */
export interface ExceptionSummary {
  id: string;
  tenant_id: string;
  order_id: string;
  event_type: string;
  intent?: string;
  lifecycle_state: LifecycleState;
  shadow_verdict?: ShadowVerdict;
  selected_recipe?: string;
  final_status?: string;
  created_at: string;
  updated_at: string;
}

/** ExceptionDetail — full detail view (GET /api/v1/exceptions/{id}) */
export interface ExceptionDetail extends ExceptionSummary {
  trace_id?: string;
  resolution_data: Record<string, unknown>;
  resolved_by?: string;
  resolved_action?: string;
  resolution_notes?: string;
}

/** TraceRecord — full audit trail (GET /api/v1/exceptions/{id}/trace) */
export interface TraceRecord {
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
}

/* ── UI display types (not backend contract types) ───────────────────
   These types support the enriched UI views (line-item grids, pricing
   waterfall). When asoe2 adds line-item endpoints, these will be
   aligned to match the Pydantic models. Until then they are UI-only.
   ──────────────────────────────────────────────────────────────────── */

/** Pricing condition type for waterfall visualization */
export type PricingConditionType =
  | "BASE"
  | "CONTRACT"
  | "TPR"
  | "UOM"
  | "RESULT"
  | "ERROR";

/** A single step in a pricing waterfall (condition chain) */
export interface PricingWaterfallStep {
  type: PricingConditionType;
  label: string;
  record: string;
  value: number | null;
  running: number | null;
  detail: string;
  error?: string;
}

/** Order line item for the exception queue line-item grid */
export interface LineItem {
  line_id: string;
  sku: string;
  description: string;
  uom: string;
  quantity: number;
  erp_price: number;
  po_price: number;
  root_cause?: string;
}

/** Per-line agent analysis with optional pricing waterfall */
export interface LineItemAnalysis {
  line_id: string;
  diagnosis: string;
  resolution: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  waterfall: PricingWaterfallStep[];
}

/** Order-level agent analysis (drives detail panel enrichments) */
export interface OrderAnalysis {
  diagnosis: string;
  confidence: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  resolution: string;
  lines: LineItemAnalysis[];
}

/* ── Health endpoint (dynamic enum source per Guardrail #2) ────────── */

export interface HealthResponse {
  status: string;
  version: string;
  kill_switch: boolean;
  explain_mode: boolean;
  allowed_intents: string[];
  lifecycle_states: string[];
  allowed_recipes: string[];
}
