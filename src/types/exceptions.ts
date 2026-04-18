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
  /** Account ID — references the retail customer account within the tenant. */
  account_id?: string;
  /** Account name — display label for the retail customer (e.g., "Walmart"). */
  account_name?: string;
}

/** One append-only entry in an exception's reanalysis audit trail.
 *  Matches asoe2/api/routes/exceptions.py prior_entry construction. */
export interface ReanalysisEntry {
  attempt: number;
  triggered_at: string;
  triggered_by: string;
  reason: string;
  prior_trace_id?: string;
  prior_shadow_verdict?: string;
  prior_final_status?: string;
  prior_lifecycle_state?: string;
  new_trace_id?: string;
  new_shadow_verdict?: string;
  new_final_status?: string;
  new_lifecycle_state?: string;
}

/** ExceptionDetail — full detail view (GET /api/v1/exceptions/{id}) */
export interface ExceptionDetail extends ExceptionSummary {
  trace_id?: string;
  resolution_data: Record<string, unknown>;
  resolved_by?: string;
  resolved_action?: string;
  resolution_notes?: string;
  /** Append-only history of human-triggered re-analyses. */
  reanalysis_history?: ReanalysisEntry[];
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
  /** Present when a back-order/OOS exception produces inventory gap analysis */
  backorder_analysis?: BackOrderAnalysisData;
  /** Present when an over-max exception produces a trim plan */
  overmax_analysis?: OverMaxAnalysisData;
  /** Present when a min-order-qty exception produces a round-up plan */
  moq_analysis?: MOQAnalysisData;
  /** Present when a pallet config exception produces alignment analysis */
  pallet_analysis?: PalletAnalysisData;
  /** Present when a delivery delay exception produces timing analysis */
  delivery_delay_analysis?: DeliveryDelayAnalysisData;
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

/* ── Back-Order / OOS enrichment types ───────────────────────────────── */

/** Back-order analysis — present when the OOS skill/recipe produces it */
export interface BackOrderAnalysisData {
  /** Quantity ordered by the customer */
  ordered_qty: number;
  /** Quantity currently available (ATP) */
  available_qty: number;
  /** Gap quantity (ordered - available) */
  gap_qty: number;
  /** Gap as percentage of ordered */
  gap_pct: number;
  /** Unit price for at-risk calculation */
  unit_price: number;
  /** Unit of measure */
  uom: string;
  /** Revenue at risk from the gap */
  at_risk: number;
  /** ATP (Available-to-Promise) date */
  atp_date: string;
  /** Primary distribution center */
  primary_dc: WarehouseInfo;
  /** Alternate warehouses with available stock */
  alternate_warehouses: AlternateWarehouse[];
  /** Substitute SKU options */
  substitutes: SubstituteSKU[];
  /** Inbound production order (if any) */
  production?: { qty: number; date: string };
  /** Inbound purchase order (if any) */
  inbound_po?: { qty: number; eta: string; po_num: string } | null;
  /** Ranked resolution options with multi-dimensional scoring */
  resolution_options: ResolutionOption[];
}

/** Warehouse inventory snapshot */
export interface WarehouseInfo {
  plant: string;
  name: string;
  region: string;
  qty: number;
}

/** Alternate warehouse with shipping details */
export interface AlternateWarehouse extends WarehouseInfo {
  eta_days: number;
  freight_delta_per_unit: number;
  freight_delta_total: number;
}

/** Substitute SKU for OOS resolution */
export interface SubstituteSKU {
  sku: string;
  description: string;
  available_qty: number;
  price_delta_pct: number;
  acceptance_rate: number;
  source: string;
  priority: number;
}

/** Resolution option with multi-dimensional scoring */
export interface ResolutionOption {
  id: string;
  type: string;
  title: string;
  description: string;
  /** Composite score (0-1) */
  composite_score: number;
  /** Sub-scores by dimension */
  scores: {
    service: number;
    revenue: number;
    logistics: number;
    preference: number;
  };
  /** SAP transaction steps to execute */
  sap_steps: string[];
  /** Whether this is the recommended ("top pick") option */
  recommended: boolean;
}

/* ── Over Max enrichment types ───────────────────────────────────────── */

/** Over Max analysis — present when the Over Max skill/recipe produces it */
export interface OverMaxAnalysisData {
  /** Total quantity ordered across all lines */
  total_ordered: number;
  /** Maximum allowed quantity (contract or policy) */
  max_qty: number;
  /** Excess quantity (ordered - max) */
  excess_qty: number;
  /** Exceedance percentage */
  exceedance_pct: number;
  /** Unit of measure */
  uom: string;
  /** Revenue at risk from excess */
  at_risk: number;
  /** Contract reference */
  contract_ref: string;
  /** SAP block status */
  block_status: string;
  /** Block reason */
  block_reason: string;
  /** Per-line details */
  order_lines: OverMaxLine[];
  /** AI-generated trim plan */
  trim_plan: TrimPlanLine[];
}

/** Over Max per-line detail */
export interface OverMaxLine {
  sku: string;
  description: string;
  qty: number;
  max_line_qty: number;
  excess: number;
  is_even_layer_item: boolean;
}

/** AI trim plan line */
export interface TrimPlanLine {
  sku: string;
  description: string;
  ordered: number;
  trimmed_to: number;
  delta: number;
  action: "TRIM" | "SKIP" | "OK";
}

/* ── Min Order Qty (MOQ) enrichment types ───────────────────────────── */
/* ── Min Order Qty (MOQ) enrichment types ───────────────────────────── */

/** MOQ analysis — present when the MOQ skill/recipe produces it */
export interface MOQAnalysisData {
  /** Quantity ordered */
  ordered_qty: number;
  /** Minimum order quantity required */
  moq_qty: number;
  /** Shortfall (MOQ - ordered) */
  shortfall_qty: number;
  /** Shortfall as percentage of MOQ */
  shortfall_pct: number;
  /** Primary SKU */
  sku: string;
  /** Material description */
  description: string;
  /** Unit cost */
  unit_cost: number;
  /** Unit of measure */
  uom: string;
  /** Revenue at risk */
  at_risk: number;
  /** MOQ source (e.g., "KNMT-MINBM" or "MARC-MINBE") */
  moq_source: string;
  /** Distribution channel */
  channel: string;
  /** SAP V4082 block message */
  block_message: string;
  /** Contract reference */
  contract_ref: string;
  /** Block status */
  block_status: string;
  /** AI round-up plan */
  round_up_plan: RoundUpPlanLine[];
  /** SAP execution steps */
  sap_steps: SAPStep[];
}

/** Round-up plan line */
export interface RoundUpPlanLine {
  sku: string;
  description: string;
  ordered: number;
  round_up_to: number;
  delta: number;
  action: "ROUND_UP" | "ACCEPT_BELOW" | "ESCALATE";
}

/** SAP execution step */
export interface SAPStep {
  step: number;
  transaction: string;
  table: string;
  field: string;
  description: string;
}

/* ── Pallet Config enrichment types ─────────────────────────────────── */

/** Pallet analysis — present when the Pallet Config skill/recipe produces it */
export interface PalletAnalysisData {
  /** Total cases ordered across all lines */
  total_ordered_cases: number;
  /** Total loose (non-full-layer) cases */
  loose_cases_total: number;
  /** Total at-risk value */
  at_risk_total: number;
  /** Estimated extra labor hours for manual handling */
  extra_labor_est_hrs: number;
  /** Freight waste percentage from partial pallets */
  freight_waste_pct: number;
  /** Number of order lines */
  order_line_count: number;
  /** Per-line pallet alignment details */
  lines: PalletLine[];
  /** AI-suggested plan for pallet alignment */
  suggested_plan: PalletSuggestion[];
}

/** Per-line pallet alignment detail */
export interface PalletLine {
  sku: string;
  description: string;
  uom: string;
  layer_qty: number;
  pallet_qty: number;
  ordered_qty: number;
  complete_layers: number;
  loose_qty: number;
  full_pallets: number;
  pallet_fill_pct: number;
  violation_type: string;
}

/** AI pallet alignment suggestion */
export interface PalletSuggestion {
  sku: string;
  description: string;
  current: number;
  suggested: number;
  delta: number;
  layers: number;
  full_pallets: number;
  reason: string;
}

/* ── Delivery Delay enrichment types ─────────────────────────────────── */

/** Delivery delay analysis — present when the DeliveryDelay skill/recipe produces it */
export interface DeliveryDelayAnalysisData {
  /** Originally promised delivery date */
  planned_date: string;
  /** Current projected ETA after the delay */
  projected_eta: string;
  /** Days late = projected_eta − planned_date */
  days_late: number;
  /** Prototype rule band for visual grouping (e.g., "SD-DELAY-001"). Rendered
   *  verbatim — not branched on in UI logic (Guardrail #2). */
  rule_id: string;
  /** Deterministic delay category (e.g., "CARRIER_DELAY", "PRODUCTION_DELAY",
   *  "LOGISTICS", "WEATHER", "CUSTOMS"). Rendered verbatim. */
  delay_category: string;
  /** One-line human-readable delay reason */
  delay_reason: string;
  /** Number of affected lines on the order */
  affected_lines: number;
  /** Revenue at risk from the delay (SLA penalties + downstream) */
  at_risk: number;
  /** Carrier name */
  carrier: string;
  /** Route or lane identifier */
  route: string;
  /** SLA deadline (if contractually defined) */
  sla_deadline?: string;
  /** Ranked alternate delivery options */
  alternate_options: AlternateDeliveryOption[];
}

/** Alternate delivery option with cost/benefit trade-off */
export interface AlternateDeliveryOption {
  id: string;
  /** Free-text type label (e.g., "EXPEDITE", "SPLIT_SHIP", "PARTIAL",
   *  "RESCHEDULE"). Rendered verbatim — no UI dispatch on the value. */
  type: string;
  title: string;
  description: string;
  new_eta: string;
  /** Extra freight / handling cost in currency units (positive = more cost,
   *  negative = savings). Rendered as-is. */
  extra_cost: number;
  /** Whether this is the top-pick option flagged by the agent */
  recommended: boolean;
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
  /**
   * Full AllowedResolutionAction set (asoe2/constraints/specs.py). Consumed by
   * the Override chooser so resolution action codes are never hardcoded in
   * .tsx (Guardrail #2).
   */
  allowed_resolution_actions: string[];
  /**
   * Controlled vocabulary for override reason-tag categories
   * (asoe2/constraints/specs.py::AllowedOverrideReasonTag). Populates the
   * second chooser in the Override dialog so reason_tag codes are never
   * hardcoded in .tsx.
   */
  allowed_override_reason_tags: string[];
}
