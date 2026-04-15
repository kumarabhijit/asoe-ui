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
  | "PENDING_ADMIN_REVIEW"
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
  record?: string;
  value: number | null;
  running: number | null;
  detail?: string;
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
  /** Underlying deterministic root cause (e.g., "Promo Expired", "Duplicate ID within 48h") */
  root_cause: string;
  /** One-line specific action recommendation (e.g., "Adjust price to contract") */
  recommendation: string;
  /** Master data context for the exception entity */
  entity_profile: EntityProfile;
  /** Quantitative "blast radius" of the exception */
  impact_metrics: ImpactMetrics;
  lines: LineItemAnalysis[];

  /* ── Data-presence-driven enrichment fields ───────────────────────
     These optional fields are populated by the backend only when
     relevant. The UI renders sections based on whether the data
     is present, not on which intent string the exception carries.
     Adding a new field here + its section component is all that's
     needed to support a new enrichment — zero dispatch logic.
     ──────────────────────────────────���───────────────────────────── */

  /** Present when the DuplicatePO recipe has detected a duplicate */
  duplicate_detection?: DuplicateDetectionData;
  /** Present when two orders need side-by-side comparison */
  order_comparison?: OrderComparisonData;
  /** Present when a pricing exception produces price delta analysis */
  price_analysis?: PriceAnalysisData;
}

/* ── Duplicate PO enrichment types (UI-only, not backend contract) ──── */

/** Duplicate detection summary — present when DuplicatePO Skill/Recipe produces it */
export interface DuplicateDetectionData {
  original_order: OrderSnapshot;
  duplicate_order: OrderSnapshot;
  /** How the duplicate was detected (e.g., "Same customer + SKU + qty within 7 days") */
  detection_method: string;
  /** Calendar days between the two submissions */
  days_between: number;
  /** Detection confidence 0-100 */
  confidence: number;
  /** Agent-recommended action (e.g., "Cancel duplicate SO-002") */
  recommended_action: string;
  /** SO number the agent recommends cancelling */
  cancellation_target: string;
  /** Autonomy level applied with rationale (e.g., "L1 — Auto-block, value < $1,000") */
  autonomy_applied: string;
}

/** Snapshot of an order for comparison */
export interface OrderSnapshot {
  so_number: string;
  po_number: string;
  created_date: string;
  total_value: number;
  line_count: number;
  status: string;
}

/** Side-by-side order comparison — present when two orders need comparison */
export interface OrderComparisonData {
  orders: ComparisonOrder[];
  /** Fields that matched to trigger duplicate detection */
  matching_fields: string[];
  /** Fields that differ between the orders */
  differing_fields: string[];
}

export interface ComparisonOrder {
  so_number: string;
  po_number: string;
  created_date: string;
  customer: string;
  lines: ComparisonLineItem[];
  total_value: number;
  status: string;
}

export interface ComparisonLineItem {
  sku: string;
  description: string;
  qty: number;
  unit_price: number;
}

/* ── Price analysis enrichment types ─────────────────────────────────── */

/** Price analysis summary — present when a pricing skill/recipe produces it */
export interface PriceAnalysisData {
  /** ERP (SAP) base price per unit after condition chain */
  erp_unit_price: number;
  /** PO (customer) price per unit */
  po_unit_price: number;
  /** Absolute variance per unit */
  variance_amount: number;
  /** Variance percentage (positive = PO below ERP) */
  variance_pct: number;
  /** Total revenue at risk (delta × quantity) */
  total_at_risk: number;
  /** Total quantity across affected lines */
  total_quantity: number;
  /** Unit of measure */
  uom: string;
  /** SAP document type (e.g., "Sales Order", "Delivery") */
  doc_type: string;
  /** SAP document number */
  doc_number: string;
  /** Primary SKU number */
  sku: string;
  /** Material description */
  material_desc: string;
  /** Order date */
  order_date: string;
  /** Rule that triggered the exception (e.g., "SO-PRICE-001") */
  rule_id: string;
  /** Deterministic root cause category */
  root_cause_category: string;
  /** Active contract reference (if any) */
  contract_ref?: string;
  /** Active promotion reference (if any) */
  promotion_ref?: string;
}

/** Entity profile — master data relevant to the exception context */
export interface EntityProfile {
  customer_name: string;
  bp_number: string;
  customer_tier?: string;
  vip_status?: boolean;
  credit_standing?: string;
  location?: string;
  region?: string;
}

/** Impact metrics — quantitative "blast radius" of the exception */
export interface ImpactMetrics {
  revenue_at_risk: number;
  delta_amount: number;
  delta_percentage: number;
  fulfillment_gap_pct?: number;
  /** SLA priority as a string — rendered dynamically, not hardcoded in UI logic */
  sla_priority: string;
  sla_deadline?: string;
  affected_lines: number;
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
