/**
 * Exception domain types — aligned with asoe2/contracts/models.py
 *
 * These types mirror the backend Pydantic models. Values for enums
 * (intents, lifecycle states, recipes) are fetched from the health
 * endpoint at runtime per Guardrail #2 — the string unions here
 * exist only for type safety in components that receive API data.
 */

import type { ExecutedNode } from "./api";

/* ── Enums (fetched from GET /api/v1/health at runtime) ────────────── */

/**
 * Intent values are runtime data sourced from `useHealth().allowed_intents`
 * per Guardrail #1 — the UI never branches on specific intent strings.
 *
 * A hand-written `Intent` union was removed in the parity-cleanup pass:
 * it was drift-prone (fell out of sync with asoe2 every time a new
 * intent landed) and wasn't used as a compile-time constraint anywhere
 * (`ExceptionSummary.intent` and related fields type as `string`).
 * If a component ever needs a union for exhaustive matching, derive
 * it from the generated OpenAPI types in `src/types/generated.ts` or
 * from the health response — don't reintroduce the hand-written list.
 */

/** Shadow verdict — ShadowStatus in contracts/models.py */
export type ShadowVerdict = "GREEN" | "YELLOW" | "RED";

/** Terminal status — TerminalStatus in contracts/models.py */
export type TerminalStatus =
  | "COMPLETE"
  | "COMPLETE_WITH_CHILDREN"
  | "FAIL_TO_HUMAN"
  | "MANUAL_REVIEW_REQUIRED"
  | "BLOCKED"
  | "REJECTED"
  // Registry-enforced audit gap. Emitted by `api/analysis_composer.py`
  // when one or more audit-bearing fields declared in
  // `compliance/audit_bearing_registry.yaml` cannot be populated. The
  // UI runtime is fully wired (DiagnosticsSection, EventsTimeline,
  // WaterfallStepper, EvidenceBlock all switch on this value); the
  // type union just hadn't tracked the addition. Guardrail #3.
  | "AUDIT_CONTEXT_MISSING";

/**
 * Exception lifecycle state — persistence-level state machine
 * (Section 7.1). Mirrors `asoe2/contracts/models.py::LIFECYCLE_STATES`.
 *
 * Note: `EXECUTING` was retired in asoe2 Phase 19 when `/approve` was
 * deleted and `/disposition` consolidated the disposition flow. The
 * backend no longer emits it, so the UI union no longer lists it.
 */
export type LifecycleState =
  | "INGESTED"
  | "CLASSIFYING"
  | "AUDITING"
  | "PENDING_REVIEW"
  | "ESCALATED"
  | "PENDING_ADMIN_REVIEW"
  /** Phase 2 #5 — high-value override staged for second-reviewer cosign. */
  | "PENDING_COSIGN"
  | "RESOLVED"
  | "FAILED"
  | "BLOCKED"
  | "REJECTED"
  | "CLOSED";

/**
 * Recipe name values are runtime data (source: `useHealth().allowed_recipes`).
 * The hand-written `RecipeName` union was removed in the parity-cleanup
 * pass — same rationale as the `Intent` union above. `ExceptionSummary`
 * / `ExceptionDetail` field `selected_recipe` types as `string | undefined`
 * so no compile-time constraint depended on the union.
 */

/** Resolution actions — AllowedResolutionAction in constraints/specs.py */
export type ResolutionAction =
  | "BLOCK_AND_NOTIFY"
  | "MERGE"
  | "SUPERSEDE"
  | "ALLOW_BOTH"
  | "ESCALATE"
  | "REQUEST_BUYER_CONFIRMATION"
  // ADR-034 — EmailOrderEntryRecipe outputs.
  | "ONE_CLICK_APPROVE"
  | "STANDARD_REVIEW"
  | "LOW_CONFIDENCE_FLAG"
  | "AUTO_CORRECT"
  | "REQUEST_CLARIFICATION"
  | "REJECT"
  // ADR-042 §2.2.6 — explicit, financially-binding order-entry ERP submit.
  | "SUBMIT_TO_ERP"
  // ADR-042 Phase 4 — compose a buyer reply draft (send is a separate action).
  | "DRAFT_REPLY"
  // ADR-042 Phase 4 — send the operator-approved buyer reply.
  | "SEND_REPLY";

/* ── Pipeline node names (11-node LangGraph state machine) ─────────────
 *
 * Order matches the post-2026-04-22 graph (ADR-025): the proposal is
 * fully materialised — recipe selected, gateway evidence resolved into
 * enrichment_context, invocation params validated — BEFORE shadow
 * audits it. `build_analysis` (Pillar 2) sits on every terminal edge
 * so audit-bearing field coverage is enforced on every record.
 */

export type PipelineNode =
  | "ingest"
  | "classify"
  | "load_skill"
  | "validate_circuit_breaker"
  | "select_recipe"
  | "resolve_dependencies"
  | "validate_types"
  | "shadow_audit"
  | "execute_recipe"
  | "apply_effects"
  | "build_analysis";

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
/**
 * The per-event child record attached to an OrderCase
 * (`asoe2/contracts/models.py::ChildCase`). UI calls it
 * `ExceptionSummary` for historical reasons; the field set mirrors
 * the backend `ChildCase` Pydantic model field-for-field.
 *
 * Post Case & Intent Super-Group pivot (Phase 2 §6) records carry
 * their own supergroup_code + intent_code (the leaf intent inside
 * the supergroup). For partner roles the backend redacts
 * `divergence_reason` to null and coarsens upstream classifier
 * attribution; the UI just renders what it receives.
 */
export interface ExceptionSummary {
  id: string;
  tenant_id: string;
  order_id: string;
  event_type: string;
  intent?: string;
  /** Phase 2 §6 — the leaf intent inside the parent supergroup
   *  (e.g. `INT_PRICE_MISMATCH`). The canonical typed union lives
   *  in `src/generated/taxonomy.ts::IntentCode`; this stays string
   *  at the wire to tolerate unknown codes (Guardrail #2). The
   *  legacy `intent` field above remains populated as a runtime
   *  fallback during the transition window. */
  intent_code?: string;
  /** Phase 2 §6 — the Intent Super-Group the record classifies
   *  under (e.g. `SG_BLOCK_PRICING`). Typed `SupergroupCode` in
   *  `src/generated/taxonomy.ts`. */
  supergroup_code?: string;
  /** Phase 2 §6 — set when the child's classification diverges
   *  from the parent case's supergroup. Redacted to `null` on
   *  partner-role responses. */
  divergence_reason?: string | null;
  /** Phase 2 §8.5 — the SAP block field this child record carries.
   *  `LIFSK`/`LIFSP` = delivery-block header/item, `FAKSK`/`FAKSP`
   *  = billing-block header/item, `ABGRU` = order-reject code,
   *  `CMGST` = credit-management status, `Z_CUSTOM` = tenant
   *  custom field. `null` for non-SAP records. */
  sap_block_field?:
    | "LIFSK"
    | "LIFSP"
    | "FAKSK"
    | "FAKSP"
    | "ABGRU"
    | "CMGST"
    | "Z_CUSTOM"
    | null;
  /** Phase 2 §8.5 — whether the SAP block applies to the order
   *  header or a specific line item. `null` when not applicable. */
  scope?: "HEADER" | "ITEM" | null;
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
  /** ADR-038 §H.6 — parent OrderCase id when the record is attached
   *  to a case. None on Tier-1 stateless records and pre-Phase-H.3
   *  legacy rows. UI uses this for the "View case" deeplink. */
  parent_case_id?: string | null;
  /** Phase 2 §8.5 — raw SAP block reason code (`LIFSK=Z1`, `ABGRU=42`,
   *  …) for records whose parent case has origin=API. Distinct from
   *  `intent` (the classified business intent recipes dispatch on).
   *  `null` on customer-origin records and pre-ADR-041 legacy rows. */
  sap_block_code?: string | null;
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
  /** ADR-027 Phase B (rev. 3) — the executed_nodes list captured for
   *  THIS attempt at the moment reanalysis kicked off. Preserved on
   *  the entry so prior-path audit evidence isn't destroyed when the
   *  next attempt overwrites trace_data. Empty for entries written
   *  before Phase B's instrumentation landed. */
  executed_nodes?: ExecutedNode[];
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
  /** Underlying deterministic root cause prose (e.g. "Promo Expired").
   *  Optional on the backend contract — `compose_narrative` returns
   *  None when no recipe / trace narrative carries it; the UI's
   *  `AgentAnalysisSection` structurally omits the Root Cause block
   *  in that case (Guardrail #6). */
  root_cause?: string;
  /** One-line specific action recommendation. Optional for the same
   *  reason as `root_cause`. */
  recommendation?: string;
  /** Master data context for the exception entity. Optional —
   *  backend `compose_entity_profile` returns None when the record
   *  has no Account linkage. */
  entity_profile?: EntityProfile;
  /** Quantitative "blast radius" of the exception. Optional —
   *  backend `compose_impact_metrics` returns None when the record
   *  carries no line items (a zero-filled struct would imply
   *  "verified zero impact" which is partial-truth). */
  impact_metrics?: ImpactMetrics;
  lines: LineItemAnalysis[];

  /* ── Data-presence-driven enrichment fields ───────────────────────
     These optional fields are populated by the backend only when
     relevant. The UI renders sections based on whether the data
     is present, not on which intent string the exception carries.
     Adding a new field here + its section component is all that's
     needed to support a new enrichment — zero dispatch logic.

     Review L2 / H5 status (2026-04-22): `price_hold_analysis` and
     `edi_mismatch_analysis` are now backend-backed by
     `asoe2/api/analysis_adapters.py` — real asoe2 populates them for
     GREEN records and synthesises them for YELLOW/RED shadow-gated
     records. The remaining 8 fields are still mock-only until their
     own adapters land (tracked as D18 in ui_architecture.md §9 +
     NEXT_PUBLIC_SHOW_PREVIEW_INTENTS backlog in tasks.md). Drop the
     `// preview-only` marker from a field only once the matching
     adapter is wired on the asoe2 side.
     ────────────────────────────────────────────────────────────── */

  /** preview-only — Present when the DuplicatePO recipe has detected a duplicate */
  duplicate_detection?: DuplicateDetectionData;
  /** preview-only — Present when two orders need side-by-side comparison */
  order_comparison?: OrderComparisonData;
  /** preview-only — Present when a pricing exception produces price delta analysis */
  price_analysis?: PriceAnalysisData;
  /** preview-only — Present when a back-order/OOS exception produces inventory gap analysis */
  backorder_analysis?: BackOrderAnalysisData;
  /** Present when an over-max exception produces a trim plan (asoe2 adapt_overmax). */
  overmax_analysis?: OverMaxAnalysisData;
  /** Present when a min-order-qty exception produces a round-up plan (asoe2 adapt_moq). */
  moq_analysis?: MOQAnalysisData;
  /** Present when a pallet config exception produces alignment analysis (asoe2 adapt_pallet). */
  pallet_analysis?: PalletAnalysisData;
  /** Present when a delivery delay exception produces timing analysis (asoe2 adapt_delivery_delay). */
  delivery_delay_analysis?: DeliveryDelayAnalysisData;
  /** Present when a price-hold release event produces variance + action analysis (asoe2 adapt_price_hold). */
  price_hold_analysis?: PriceHoldAnalysisData;
  /** Present when an EDI 850 line mismatch produces sub_type classification (asoe2 adapt_edi_mismatch). */
  edi_mismatch_analysis?: EdiMismatchAnalysisData;
  /** Present when the EmailOrderEntry recipe classifies a non-EDI
   *  email-channel order envelope (ADR-034). Backend-backed:
   *  `asoe2/api/analysis_adapters.py::adapt_email_order_entry` +
   *  audit_bearing_registry rows shipped in Phase B. Floor evidence
   *  (the four non-disable-able booleans) is sourced from the
   *  `email_intake` gateway's four required_for_audit=True operations
   *  via `enrichment_context` (Pillar 1 — gateway READS run before
   *  shadow_audit per ADR-025). */
  email_order_entry_analysis?: EmailOrderEntryAnalysisData;
  /** Inbound email source-of-truth substrate (ADR-034 Phase G —
   *  PO-driven IA correction). Backend-backed:
   *  `asoe2/api/analysis_adapters.py::adapt_email_source` (SECONDARY
   *  adapter on EmailOrderEntryRecipe.py) + audit_bearing_registry
   *  rows for from_address / received_at / subject / body_hash /
   *  attachment_manifest. Sourced from the `email_intake/fetch_message`
   *  gateway's required_for_audit=True response. Mounts above the
   *  EmailOrderEntrySection on the Exception Queue detail page so the
   *  CSA sees both the source email and the agent's recommendation
   *  on a single detail surface. */
  email_source?: EmailSourceData;
  /** ADR-042 Phase 2 — Customer Inbox Entities tab. Extracted entities the
   *  AI intake agent pulled from the email/attachments. Preview-only until
   *  the composer adapter lands. Mirrors `api/schemas.py::EntitiesAnalysisData`. */
  entities_analysis?: EntitiesAnalysisData;
  /** ADR-042 Phase 2 — Customer Inbox SAP Data tab. Live SAP system-of-record
   *  context. Preview-only until the SAP-gateway composer adapter lands.
   *  Mirrors `api/schemas.py::SapDataAnalysisData`. */
  sap_data_analysis?: SapDataAnalysisData;
  /** ADR-042 Phase 3 — Customer Inbox Order Entry tab (extracted order form).
   *  Preview-only until the extraction-gateway composer adapter lands.
   *  Mirrors `api/schemas.py::OrderEntryExtraction`. */
  order_entry_extraction?: OrderEntryExtraction;
  /** ADR-042 Phase 5 — Customer Inbox EDI 850 Audit tab. The deterministic
   *  ANSI X12 5010 purchase-order reconstruction of the reviewed order.
   *  Preview-only until the edi_850 builder producer lands.
   *  Mirrors `api/schemas.py::Edi850Document`. */
  edi_850_audit?: Edi850Document;
  /** ADR-042 Phase 6 — Customer Inbox Change Analysis tab. The deterministic
   *  constraint evaluation + scenarios + decision for a requested order change.
   *  Preview-only until the change_analysis producer lands.
   *  Mirrors `api/schemas.py::ChangeAnalysis`. */
  change_analysis?: ChangeAnalysis;
  /** ADR-042 Phase 7 — Customer Inbox Knowledge Graph tab. A derived node/edge
   *  projection over the case entities. Preview-only / deferrable until the
   *  knowledge_graph producer lands. Mirrors `api/schemas.py::KnowledgeGraphPayload`. */
  knowledge_graph?: KnowledgeGraphPayload;
  /** ADR-042 Phase 7 — AI Draft Reply evidence, projected from
   *  resolution_data.reply_draft. Absent until a DRAFT_REPLY disposition runs.
   *  Mirrors `api/schemas.py::DraftReply`. */
  draft_reply?: DraftReply;
}

/* ── Order Entry section (ADR-042 Phase 3) — mirrors api/schemas.py ── */

export interface OrderEntryHeader {
  customer_po?: string | null;
  order_type?: string | null;
  sales_org?: string | null;
  dist_channel?: string | null;
  ship_window_from?: string | null;
  ship_window_to?: string | null;
  requested_date?: string | null;
}

export interface OrderEntryLineItem {
  line_num: string;
  material: string;
  description?: string | null;
  quantity: number;
  uom?: string | null;
  unit_price?: number | null;
  mdm_matched?: boolean | null;
}

export interface OrderEntryValidationFlag {
  field: string;
  /** ERROR | WARNING | INFO */
  severity: string;
  message: string;
}

export interface OrderEntryExtraction {
  source_type: string;
  confidence: number;
  header: OrderEntryHeader;
  customer_name?: string | null;
  customer_bp?: string | null;
  line_items: OrderEntryLineItem[];
  validation_flags: OrderEntryValidationFlag[];
}

/* ── EDI 850 Audit section (ADR-042 Phase 5) — mirrors api/schemas.py ── */

export interface Edi850Segment {
  seg_id: string;
  elements: string[];
  raw: string;
  meaning: string;
  /** envelope | header | dates | party | line | trailer */
  group: string;
}

export interface Edi850Envelope {
  sender_id: string;
  receiver_id: string;
  interchange_control_number: string;
  group_control_number: string;
  transaction_set_control_number: string;
  usage_indicator: string;
  x12_version: string;
}

export interface Edi850Header {
  purpose_code: string;
  po_type: string;
  po_number: string;
  po_date?: string | null;
  currency?: string | null;
  requested_delivery_date?: string | null;
}

export interface Edi850Party {
  /** BY (buyer) | SE (seller) | ST (ship-to) */
  entity_code: string;
  role: string;
  name: string;
  id_qualifier?: string | null;
  id_value?: string | null;
  address?: string | null;
  city_state_zip?: string | null;
}

export interface Edi850LineItem {
  line_num: string;
  quantity: number;
  uom: string;
  unit_price?: number | null;
  product_qualifier?: string | null;
  product_id?: string | null;
  description?: string | null;
  extended_amount?: number | null;
}

export interface Edi850Totals {
  total_line_items: number;
  total_quantity: number;
  total_amount?: number | null;
}

export interface Edi850Document {
  standard: string;
  transaction_set: string;
  envelope: Edi850Envelope;
  header: Edi850Header;
  parties: Edi850Party[];
  line_items: Edi850LineItem[];
  totals: Edi850Totals;
  segments: Edi850Segment[];
  raw_x12: string;
}

/* ── Change Analysis section (ADR-042 Phase 6) — mirrors api/schemas.py ── */

export interface ConstraintCheck {
  name: string;
  /** PASS | CONDITIONAL | WARNING */
  status: string;
  detail: string;
  metric?: string | null;
  /** Cosmetic label (evaluating discipline) — not audit-bearing. */
  agent?: string | null;
  system_ref?: string | null;
}

export interface ChangeItem {
  field: string;
  from_value?: string | null;
  to_value?: string | null;
}

export interface ConstraintEvaluation {
  lifecycle_stages: string[];
  lifecycle_index?: number | null;
  change_items: ChangeItem[];
  checks: ConstraintCheck[];
  pass_count: number;
  conditional_count: number;
  warning_count: number;
}

export interface ScenarioOption {
  name: string;
  description: string;
  recommended: boolean;
  impact?: string | null;
  financial_delta_usd?: number | null;
}

export interface ChangeDecision {
  recommended_action: string;
  confidence: number;
  rationale?: string | null;
  revenue_impact_usd?: number | null;
  requires_cosign: boolean;
  sap_actions: string[];
}

export interface ChangeAnalysis {
  evaluation: ConstraintEvaluation;
  scenarios: ScenarioOption[];
  decision: ChangeDecision;
}

/* ── Knowledge Graph section (ADR-042 Phase 7) — mirrors api/schemas.py ── */

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  /** order | customer | material | sap_doc | entity */
  kind: string;
  detail?: string | null;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface KnowledgeGraphPayload {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  root_id?: string | null;
}

/* ── Draft Reply section (ADR-042 Phase 7 / Phase 4) — mirrors api/schemas.py ── */

export interface DraftReplyEdit {
  field: string;
  before?: string | null;
  after?: string | null;
}

/**
 * One entry in a draft reply's append-only revision chain. Version 1 is
 * always the AI-generated draft; each subsequent operator edit appends a
 * new revision. The last element is the current draft. Mirrors
 * `api/schemas.py::DraftReplyRevision`. This is the SOX audit substrate for
 * "who changed the reply, to what, and when" — never pruned UI-side.
 */
export interface DraftReplyRevision {
  /** 1-based, monotonic. Last element in `revisions` is the current draft. */
  version: number;
  subject?: string | null;
  body?: string | null;
  /** Field-level before/after diffs introduced BY this revision. */
  edits_applied: DraftReplyEdit[];
  /** AI service id for the generated draft, or the operator sub for an edit. */
  author: string;
  /** ISO-8601 timestamp this revision was authored. */
  authored_at: string;
  /** AI_GENERATED | OPERATOR_EDIT */
  source: string;
}

export interface DraftReply {
  /** DRAFTED | REJECTED */
  status: string;
  reason?: string | null;
  template_name?: string | null;
  recipient?: string | null;
  subject?: string | null;
  body?: string | null;
  edits_applied: DraftReplyEdit[];
  /** Append-only revision chain (ADR-042 Phase 7 follow-on). Empty for legacy
   *  drafts persisted before versioning landed — readers should synthesize a
   *  single AI_GENERATED v1 from the top-level fields in that case. */
  revisions?: DraftReplyRevision[];
  drafted_by?: string | null;
  drafted_at?: string | null;
}

/* ── SAP Data section (ADR-042 Phase 2) — mirrors api/schemas.py ── */

export interface SapDataAnalysisData {
  system: string;
  validation_status: string;
  order_value_usd?: number | null;
  sap_doc_number?: string | null;
}

/* ── Entities section (ADR-042 Phase 2) — mirrors api/schemas.py ── */

/** A single structured value extracted from the email / attachments.
 *  `kind` is the category (order_id | material | date | po | invoice | qty | …);
 *  `source_span` is the verbatim text it came from (provenance). */
export interface ExtractedEntity {
  key: string;
  value: string;
  kind: string;
  confidence?: number | null;
  source_span?: string | null;
}

export interface EntitiesAnalysisData {
  extracted: ExtractedEntity[];
}

/* ── Price Hold Release enrichment types (UI-only, not backend contract) ── */

/** Recipe action for a held order — one per branch in PriceHoldReleaseRecipe.py */
export type PriceHoldAction = "AUTO_RELEASE" | "ESCALATE" | "HARD_BLOCK";

/** Price-hold variance + action summary — present when PriceHoldReleaseRecipe runs */
export interface PriceHoldAnalysisData {
  hold_status: "HELD" | "RELEASED";
  po_price: number;
  sap_base_price: number;
  /** Signed fraction (po − sap) / sap. */
  variance_pct: number;
  /** Auto-release ceiling (decimal fraction) — policy-injected. */
  tolerance_pct: number;
  /** Hard-block floor (decimal fraction) — policy-injected. */
  hard_block_pct: number;
  action: PriceHoldAction;
  /** Human-readable reason (policy hit). */
  reason: string;
}

/* ── EDI Mismatch enrichment types (UI-only, not backend contract) ──── */

/** Recipe classification — one per branch in EdiMismatchRecipe.py */
export type EdiMismatchClassification = "HARD_REJECT" | "REVIEW" | "ESCALATE";

/**
 * EDI 850 line mismatch summary — present when EdiMismatchRecipe runs.
 *
 * `sub_type` is rendered verbatim, matching the pattern used by
 * `delay_category` / `root_cause_category` elsewhere in this file
 * ("Rendered verbatim — no UI dispatch on the value"). Keeping it
 * `string` avoids re-introducing the Guardrail #2 smell that the
 * hand-written Intent / RecipeName unions represent.
 *
 * Note: PRICE_MISMATCH is intentionally absent from the backend's
 * AllowedEdiMismatchSubType vocabulary — it routes to
 * CONTRACTUAL_CORRECTION at classifier time and renders the existing
 * PriceAnalysisSection instead. This section is therefore never
 * mounted for PRICE_MISMATCH.
 */
export interface EdiMismatchAnalysisData {
  sub_type: string;
  classification: EdiMismatchClassification;
  /** Recipe-recommended action (e.g., BLOCK_AND_NOTIFY, REQUEST_BUYER_CONFIRMATION). */
  recommended_action: string;
  // Autonomy vocab v2 (ADR-042 §5): SHIP_TO_MISMATCH resolves to L4 (escalate).
  autonomy_level: "L1" | "L2" | "L3" | "L4";
  expected_value: unknown;
  received_value: unknown;
  notification_template: string | null;
}

/* ── Email Source enrichment types (ADR-034 Phase G) ────────────────── */

/** One row in `EmailSourceData.attachment_manifest`. */
export interface EmailAttachmentManifestEntry {
  name: string;
  mime_type: string;
  bytes: number;
  /** Per-attachment tamper-evidence hash (analog of body_hash); null until
   *  the attachment is persisted to the store. */
  sha256?: string | null;
  /** Stored-blob reference for the download link
   *  (GET /cases/{id}/attachments/{attachment_id}); null until persisted. */
  attachment_id?: string | null;
}

/* ── Evidence highlighting (ADR-043) ────────────────────────────────── */

/** Closed vocabulary of what an anchor supports. Parity-locked with asoe2
 *  `api/schemas.py::EvidenceSupportsKind`
 *  (tests/architectural/evidence_supports_kind_parity.test.ts) — the UI maps it
 *  with a `default` fallback, so adding a kind is a backend-only change. */
export type EvidenceSupportsKind = "extracted_field" | "constraint" | "decision";

/** Deterministic locate key (ADR-043 §2.4) — the viewer does a pure literal
 *  locate with this, never a client-side search (Guardrail #6). */
export interface MatchKey {
  normalized_text: string;
  occurrence_index: number;
}

/**
 * Backend-authoritative highlight anchor (ADR-043 §2.2). The viewer LOCATES and
 * renders these, inventing nothing. The audit-authoritative identity is
 * (attachment_id, source_sha256, text, supports_ref) — decoupled from on-screen
 * position. Phase-1 (`text_derived`) anchors carry no geometry; `page`/`bbox`/
 * `confidence` are Phase-2 spatial fields (ADR-045), verified at runtime.
 */
export interface EvidenceAnchor {
  attachment_id: string;
  anchor_source: "text_derived" | "spatial_extracted";
  text: string;
  match_key: MatchKey;
  supports_kind: EvidenceSupportsKind;
  supports_ref: string;
  label: string;
  source_sha256: string;
  page?: number | null;
  bbox?: number[] | null;
  confidence?: number | null;
  /** Frozen-rendition basis the geometry was computed against (ADR-044 §2.5);
   *  spatial anchors only. Position provenance, never the audit unit. */
  rendition_hash?: string | null;
}

/**
 * Inbound email source-of-truth substrate — present when the
 * EmailOrderEntryRecipe ran and the `email_intake/fetch_message`
 * gateway returned the inbound email metadata.
 *
 * Mounts on the Exception Queue detail page above
 * `EmailOrderEntrySection` via data-presence dispatch (no per-intent
 * page-level branching — CLAUDE.md Guardrail #1). Per ADR-034 §6
 * (PO-driven IA correction), the operator authorising an
 * email-channel order needs both the agent's recommendation AND the
 * source-of-truth for the order they're acting on, on the same
 * detail page.
 */
export interface EmailSourceData {
  from_address: string;
  received_at: string;
  subject: string;
  /** SHA-256 of the canonicalised email body (tamper detection). */
  body_hash: string;
  attachment_manifest: EmailAttachmentManifestEntry[];
  /** Optional human-readable excerpt of the body (typically first 240
   *  chars after canonicalisation). Contextual: absent when redaction
   *  policy strips PII or the body is unavailable. */
  body_excerpt?: string | null;
  /** Optional Inbox correlation id (ADR-034 Phase G). When present,
   *  the Exception Queue detail page surfaces a "View source email"
   *  back-link to /inbox?msg=<id>. Contextual: absent when the
   *  upstream `email-intelligence-agent` integration hasn't shipped. */
  source_email_id?: string | null;
  /** Backend-authoritative highlight anchors (ADR-043) the attachment-preview
   *  viewer locates and renders. Empty when no attachment is stored or no
   *  locatable evidence exists. */
  evidence_anchors?: EvidenceAnchor[];
}

/* ── Email Order Entry enrichment types (ADR-034) ───────────────────── */

/** Confidence-band classification produced by EmailOrderEntryRecipe. */
export type EmailOrderEntryClassification =
  | "ONE_CLICK_APPROVE"
  | "STANDARD_REVIEW"
  | "LOW_CONFIDENCE"
  | "FATAL_REJECT";

/** Closed reject-reason vocabulary mirrored from
 *  recipes/EmailOrderEntryRecipe.py::ALLOWED_REJECT_REASONS. */
export type EmailOrderEntryRejectReason =
  | "sender_unauthorized"
  | "customer_unresolved"
  | "duplicate_po_confirmed"
  | "credit_block"
  | "corrupt_input"
  | "policy_floor_breach";

/**
 * Email-channel order intake summary — present when EmailOrderEntryRecipe
 * has classified a non-EDI order envelope (ADR-034).
 *
 * The four `floor_*` booleans surface the "non-disable-able floor" check
 * results so the operator can see exactly which compliance precondition
 * passed or failed. Per Pillar 3, missing keys are *not* permitted —
 * the backend adapter must populate every floor field once Phase B's
 * gateway evidence path is wired up. Until then the field is marked
 * preview-only on `OrderAnalysis`.
 */
export interface EmailOrderEntryAnalysisData {
  /** Composite extraction + resolution confidence in [0.0, 1.0]. */
  composite_confidence: number;
  classification: EmailOrderEntryClassification;
  /** Recipe-recommended action — must be a member of ResolutionAction. */
  recommended_action: ResolutionAction;
  // L4 (full autonomy) is valid for email-order-entry only — parity with
  // generated.ts::EmailOrderEntryAnalysisData (ADR-042 Phase-0). EDI-mismatch
  // stays L1–L3. Locked by tests/architectural/autonomy_union_parity.test.ts.
  autonomy_level: "L1" | "L2" | "L3" | "L4";
  /** Typed validation-failure codes from the validation suite. */
  validation_failures: string[];
  /** Names of the floor checks that breached, if any. */
  floor_breaches: string[];
  /** Populated only when classification is FATAL_REJECT. */
  reject_reason_code: EmailOrderEntryRejectReason | null;
  /** The four non-disable-able floor checks. Adapter must populate every
   *  field; absence is a coverage failure (audit_bearing_registry).  */
  floor_status: {
    sender_authorized: boolean;
    customer_resolved: boolean;
    duplicate_po_clear: boolean;
    credit_clear: boolean;
  };
  notification_template: string | null;
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

/**
 * Over Max analysis — present when the Over Max skill/recipe produces it.
 *
 * Field tiers (per `asoe2/compliance/audit_bearing_registry.yaml`):
 *   - audit-bearing (required): total_ordered, max_qty, excess_qty,
 *     exceedance_pct, uom, at_risk, order_lines, trim_plan.
 *   - grandfathered audit-bearing → optional (gateway gap, deadline
 *     2026-07-21 under overmax_gateway_gap clause): contract_ref,
 *     block_status, block_reason.
 */
export interface OverMaxAnalysisData {
  /** Total quantity ordered across all lines — audit-bearing. */
  total_ordered: number;
  /** Maximum allowed quantity (contract or policy) — audit-bearing. */
  max_qty: number;
  /** Excess quantity (ordered - max) — audit-bearing. */
  excess_qty: number;
  /** Exceedance percentage — audit-bearing. */
  exceedance_pct: number;
  /** Unit of measure — audit-bearing. */
  uom: string;
  /** Revenue at risk from excess — audit-bearing. */
  at_risk: number;
  /** Per-line details — audit-bearing. */
  order_lines: OverMaxLine[];
  /** AI-generated trim plan — audit-bearing. */
  trim_plan: TrimPlanLine[];
  /** Contract reference — grandfathered until 2026-07-21 (gateway gap). */
  contract_ref?: string;
  /** SAP block status — grandfathered until 2026-07-21 (gateway gap). */
  block_status?: string;
  /** Block reason — grandfathered until 2026-07-21 (gateway gap). */
  block_reason?: string;
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

/**
 * MOQ analysis — present when the MOQ skill/recipe produces it.
 *
 * Tiers (per `asoe2/compliance/audit_bearing_registry.yaml`):
 *   - audit-bearing (required): ordered_qty, moq_qty, shortfall_qty,
 *     shortfall_pct, sku, unit_cost, uom, at_risk, round_up_plan.
 *   - grandfathered audit-bearing → optional (moq_gateway_gap, deadline
 *     2026-07-21): moq_source, channel, contract_ref, block_status.
 *   - contextual → optional: description, block_message.
 *   - sap_steps: legacy mock-only field; no backend producer. Kept for
 *     pre-existing consumers; treat as contextual.
 */
export interface MOQAnalysisData {
  /** Quantity ordered — audit-bearing. */
  ordered_qty: number;
  /** Minimum order quantity required — audit-bearing. */
  moq_qty: number;
  /** Shortfall (MOQ - ordered) — audit-bearing. */
  shortfall_qty: number;
  /** Shortfall as percentage of MOQ — audit-bearing. */
  shortfall_pct: number;
  /** Primary SKU — audit-bearing. */
  sku: string;
  /** Unit cost — audit-bearing. */
  unit_cost: number;
  /** Unit of measure — audit-bearing. */
  uom: string;
  /** Revenue at risk (uplift_value) — audit-bearing. */
  at_risk: number;
  /** AI round-up plan — audit-bearing. */
  round_up_plan: RoundUpPlanLine[];
  /** Material description — contextual. */
  description?: string;
  /** MOQ source (KNMT-MINBM / MARC-MINBE) — grandfathered. */
  moq_source?: string;
  /** Distribution channel — grandfathered. */
  channel?: string;
  /** SAP V4082 block message — contextual. */
  block_message?: string;
  /** Contract reference — grandfathered. */
  contract_ref?: string;
  /** Block status — grandfathered. */
  block_status?: string;
  /** SAP execution steps — UI-only legacy field; no backend producer. */
  sap_steps?: SAPStep[];
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
/**
 * Pallet analysis — present when the Pallet Config skill/recipe produces it.
 *
 * Tiers (per `asoe2/compliance/audit_bearing_registry.yaml`):
 *   - audit-bearing (required): total_ordered_cases, loose_cases_total,
 *     order_line_count, classification, lines, suggested_plan.
 *
 * Fields below classification are UI-only legacy mock fields with no
 * backend producer — kept optional for backwards compat with mock
 * fixtures; real-backend mode they will be undefined and the section
 * structurally omits via EvidenceBlock.
 */
export interface PalletAnalysisData {
  /** Total cases ordered across all lines — audit-bearing. */
  total_ordered_cases: number;
  /** Total loose (non-full-layer) cases — audit-bearing. */
  loose_cases_total: number;
  /** Number of order lines — audit-bearing. */
  order_line_count: number;
  /** Recipe classification (BROKEN_LAYER / PARTIAL_PALLET / MIXED_VIOLATION) — audit-bearing. */
  classification?: string;
  /** Per-line pallet alignment details — audit-bearing. */
  lines: PalletLine[];
  /** AI-suggested plan for pallet alignment — audit-bearing. */
  suggested_plan: PalletSuggestion[];
  /** Total at-risk value — UI-only legacy; no backend producer. */
  at_risk_total?: number;
  /** Estimated extra labor hours — UI-only legacy. */
  extra_labor_est_hrs?: number;
  /** Freight waste percentage — UI-only legacy. */
  freight_waste_pct?: number;
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

/**
 * Delivery delay analysis — present when the DeliveryDelay skill/recipe produces it.
 *
 * Field tiers (per `asoe2/compliance/audit_bearing_registry.yaml`):
 *   - audit-bearing (always populated by the backend or absent
 *     records → AUDIT_CONTEXT_MISSING): planned_date, projected_eta,
 *     days_late, delay_category, affected_lines.
 *   - grandfathered audit-bearing (will be populated post-2026-07-21
 *     when the contract gateway lands): at_risk, sla_deadline.
 *   - conditional (rendered iff resolved_action ∈
 *     {EXPEDITE, SPLIT_SHIP, PARTIAL, RESCHEDULE}):
 *     alternate_options.
 *   - contextual (UI uses EvidenceBlock structural omission when absent):
 *     delay_reason, carrier, route, rule_id.
 *
 * Optional vs required reflects the BACKEND'S guarantee, not a UI
 * preference. CLAUDE.md Guardrail 7: do not promote optional fields
 * back to required without coordinating with compliance.
 */
export interface DeliveryDelayAnalysisData {
  /** Originally promised delivery date — audit-bearing. */
  planned_date: string;
  /** Current projected ETA after the delay — audit-bearing. */
  projected_eta: string;
  /** Days late = projected_eta − planned_date — audit-bearing. */
  days_late: number;
  /** Deterministic delay category (e.g., "CARRIER_DELAY", "PRODUCTION_DELAY",
   *  "LOGISTICS", "WEATHER", "CUSTOMS") — audit-bearing. Rendered verbatim. */
  delay_category: string;
  /** Number of affected lines on the order — audit-bearing. */
  affected_lines: number;
  /** Revenue at risk from the delay (SLA penalties + downstream) —
   *  audit-bearing, grandfathered until 2026-07-21 (gateway gap). */
  at_risk?: number;
  /** SLA deadline (when contractually defined) — audit-bearing,
   *  grandfathered until 2026-07-21 (gateway gap). */
  sla_deadline?: string;
  /** Ranked alternate delivery options — conditional on
   *  resolved_action; render with EvidenceBlock + useConditionalField. */
  alternate_options?: AlternateDeliveryOption[];
  /** One-line human-readable delay reason — contextual. */
  delay_reason?: string;
  /** Carrier name — contextual. */
  carrier?: string;
  /** Route or lane identifier — contextual. */
  route?: string;
  /** Prototype rule band for visual grouping (e.g., "SD-DELAY-001") —
   *  contextual. Rendered verbatim — not branched on in UI logic. */
  rule_id?: string;
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
  /**
   * Per-intent narrowing of the reason-tag vocabulary
   * (asoe2/constraints/specs.py::INTENT_REASON_TAGS). Keys match
   * allowed_intents; values are the subset of allowed_override_reason_tags
   * that apply to each intent. The Override chooser narrows its option
   * list by detail.intent when a match exists; otherwise it falls back to
   * the global list. Today every intent maps to the full global set —
   * curated per-intent categories are a follow-up (Phase 5 deferred item).
   */
  allowed_override_reason_tags_by_intent: Record<string, string[]>;
  /**
   * Phase 28.5.x §D1 — the seven `CaseStatus` literal values
   * (asoe2/contracts/models.py). Consumed by the CaseListPane filter
   * chips so the case-status vocabulary is never hardcoded in .tsx.
   * Defaults to `[]` until the backend ships the field — UI falls
   * back to `STATUS_LABEL` keys in `src/lib/cases.ts` in that
   * transition window.
   */
  allowed_case_statuses?: string[];
  /**
   * Requirements §3 — the two `Origin` values (CUSTOMER | API)
   * surfaced via `/api/v1/health` so the UI never branches on
   * hardcoded literals (Guardrail #1). Replaces the pre-pivot
   * `allowed_case_sources` field.
   */
  allowed_case_origins?: string[];
  /**
   * ADR-042 §5/§8 — the version the `allowed_autonomy_levels` rows resolve
   * under (asoe2/contracts/autonomy.py::CURRENT_AUTONOMY_VOCAB_VERSION).
   * Records stamp their own version; this is the current display set.
   */
  autonomy_vocab_version?: string;
  /**
   * ADR-042 §5/§8 — the autonomy ladder the UI renders. The UI sorts by
   * `rank` (degree of automation, higher == more autonomous) and reads
   * `label` from here rather than a hardcoded map (Guardrail #1). Defaults
   * to `[]` until the backend ships the field — UI falls back to the
   * transition map in `src/lib/cases.ts` in that window.
   */
  allowed_autonomy_levels?: AutonomyLevelInfo[];
}

/**
 * ADR-042 §5/§8 — one autonomy tier (mirrors
 * `asoe2/api/schemas.py::AutonomyLevelInfo`). Display vocabulary only — not
 * the engine's gating semantics.
 */
export interface AutonomyLevelInfo {
  level: string;
  label: string;
  rank: number;
}

/* ── Classification history (requirements §8.6) ──────────────────── */

/**
 * Which actor stamped the classification row. The `HUMAN | MODEL |
 * RULE` enum is closed at the backend (V020 trigger), so it's safe
 * to constrain at the type level.
 */
export type ClassifierType = "HUMAN" | "MODEL" | "RULE";

/**
 * One row of the case's classification audit trail. Mirrors
 * `asoe2/contracts/models.py::ClassificationEvent` and the
 * `case_classification_history` table (V020).
 *
 * Partner-role responses are redacted server-side: `reason_text` and
 * `model_version` come back as `null`, and `classified_by` is
 * coarsened to one of `"internal:human"` / `"internal:model"` /
 * `"internal:rule"` (the row's identity is hidden but the actor
 * class is preserved). The UI renders the coarse tokens cleanly —
 * see `ClassificationHistoryPanel`.
 */
export interface ClassificationHistoryEntry {
  id: string;
  case_id: string;
  child_case_id?: string | null;
  supergroup_code: string;
  intent_code?: string | null;
  classified_at: string;
  classified_by: string;
  classifier_type: ClassifierType;
  model_version?: string | null;
  reason_text?: string | null;
  source_event_id?: string | null;
  taxonomy_version: string;
}

/**
 * GET /api/v1/cases/{case_id}/classification-history — append-order
 * audit response. `total` is the row count; callers paginate
 * client-side today (single-digit depth in the audit window).
 */
export interface ClassificationHistoryResponse {
  items: ClassificationHistoryEntry[];
  total: number;
}
