// Mock ExceptionSummary fixtures.
//
// Extracted from `src/lib/api.ts` in ADR-041 P5. Every entry is
// post-mutated below with `parent_case_id = \`case-for-${id}\`` so
// the case-centric pivot's "every record has a parent case"
// invariant holds in mock mode (mirrors asoe2's S15a
// `should_materialise() -> True`). The mutation lives in this
// file's module scope so any consumer importing MOCK_EXCEPTIONS
// always sees the wired-up form.
//
// See `tests/architectural/case_pivot_mock_wiring.test.ts` for the
// lock that asserts this invariant end-to-end.

import type { ExceptionSummary } from "@/types/exceptions";

export const MOCK_EXCEPTIONS: ExceptionSummary[] = [
  {
    id: "exc-001",
    tenant_id: "acme-corp",
    order_id: "SO-1001",
    event_type: "EDI_850_PRICE_MISMATCH",
    intent: "CONTRACTUAL_CORRECTION",
    lifecycle_state: "RESOLVED",
    shadow_verdict: "GREEN",
    selected_recipe: "PriceAdjustmentRecipe.py",
    final_status: "COMPLETE",
    created_at: "2026-04-24T08:12:00Z",
    updated_at: "2026-04-24T08:20:00Z",
    account_id: "acct-walmart", account_name: "Walmart",
  },
  {
    id: "exc-002",
    tenant_id: "acme-corp",
    order_id: "SO-1042",
    event_type: "EDI_850_DUPLICATE_PO",
    intent: "DUPLICATE_PO",
    lifecycle_state: "PENDING_REVIEW",
    shadow_verdict: "YELLOW",
    selected_recipe: "DuplicatePORecipe.py",
    final_status: "MANUAL_REVIEW_REQUIRED",
    created_at: "2026-04-25T09:05:00Z",
    updated_at: "2026-04-25T09:13:00Z",
    account_id: "acct-kroger", account_name: "Kroger",
  },
  {
    id: "exc-003",
    tenant_id: "acme-corp",
    order_id: "SO-2200",
    event_type: "CREDIT_LIMIT_BREACH",
    intent: "CREDIT_BLOCK",
    lifecycle_state: "BLOCKED",
    shadow_verdict: "RED",
    selected_recipe: undefined,
    final_status: "BLOCKED",
    created_at: "2026-04-19T10:30:00Z",
    updated_at: "2026-04-19T10:31:00Z",
    account_id: "acct-target", account_name: "Target",
  },
  {
    id: "exc-004",
    tenant_id: "acme-corp",
    order_id: "SO-3100",
    event_type: "EDI_850_PRICE_MISMATCH",
    intent: "MASS_PRICING_ERROR",
    // Was "EXECUTING" before asoe2 Phase 19 retired that state.
    // The disposition flow now resolves straight to RESOLVED on
    // successful apply_effects, so mock records land here.
    lifecycle_state: "RESOLVED",
    shadow_verdict: "GREEN",
    selected_recipe: "PriceAdjustmentRecipe.py",
    final_status: "COMPLETE",
    created_at: "2026-04-11T11:00:00Z",
    updated_at: "2026-04-11T11:02:00Z",
    account_id: "acct-costco", account_name: "Costco",
  },
  {
    id: "exc-005",
    tenant_id: "acme-corp",
    order_id: "SO-4455",
    event_type: "EDI_850_PRICE_MISMATCH",
    intent: "CONTRACTUAL_CORRECTION",
    lifecycle_state: "RESOLVED",
    shadow_verdict: "GREEN",
    selected_recipe: "PriceAdjustmentRecipe.py",
    final_status: "COMPLETE",
    created_at: "2026-04-21T14:22:00Z",
    updated_at: "2026-04-21T14:30:00Z",
    account_id: "acct-walmart", account_name: "Walmart",
  },
  {
    id: "exc-006",
    tenant_id: "acme-corp",
    order_id: "SO-5010",
    event_type: "EDI_850_DUPLICATE_PO",
    intent: "DUPLICATE_PO",
    lifecycle_state: "ESCALATED",
    shadow_verdict: "YELLOW",
    selected_recipe: "DuplicatePORecipe.py",
    final_status: "MANUAL_REVIEW_REQUIRED",
    created_at: "2026-04-06T16:45:00Z",
    updated_at: "2026-04-08T08:45:00Z",
    account_id: "acct-kroger", account_name: "Kroger",
  },
  {
    id: "exc-007",
    tenant_id: "acme-corp",
    order_id: "SO-6001",
    event_type: "CREDIT_LIMIT_BREACH",
    intent: "CREDIT_BLOCK",
    lifecycle_state: "PENDING_REVIEW",
    shadow_verdict: "YELLOW",
    selected_recipe: "CreditHoldReleaseRecipe.py",
    final_status: "MANUAL_REVIEW_REQUIRED",
    created_at: "2026-04-22T07:15:00Z",
    updated_at: "2026-04-22T07:22:00Z",
    account_id: "acct-target", account_name: "Target",
  },
  {
    id: "exc-008",
    tenant_id: "acme-corp",
    order_id: "SO-7200",
    event_type: "EDI_850_PRICE_MISMATCH",
    intent: "CONTRACTUAL_CORRECTION",
    lifecycle_state: "CLOSED",
    shadow_verdict: "GREEN",
    selected_recipe: "PriceAdjustmentRecipe.py",
    final_status: "COMPLETE",
    created_at: "2026-04-09T11:00:00Z",
    updated_at: "2026-04-09T12:30:00Z",
    account_id: "acct-costco", account_name: "Costco",
  },
  {
    id: "exc-009",
    tenant_id: "acme-corp",
    order_id: "SO-8100",
    event_type: "EDI_850_DUPLICATE_PO",
    intent: "DUPLICATE_PO",
    lifecycle_state: "RESOLVED",
    shadow_verdict: "GREEN",
    selected_recipe: "DuplicatePORecipe.py",
    final_status: "COMPLETE",
    created_at: "2026-04-14T06:20:00Z",
    updated_at: "2026-04-14T06:22:00Z",
    account_id: "acct-walmart", account_name: "Walmart",
  },
  {
    id: "exc-010", tenant_id: "acme-corp", order_id: "SO-9200", event_type: "BACK_ORDER_OOS", intent: "BACK_ORDER", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "BackOrderResolutionRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-10T10:15:00Z", updated_at: "2026-04-10T10:22:00Z", account_id: "acct-kroger", account_name: "Kroger",
  },
  {
    id: "exc-011", tenant_id: "acme-corp", order_id: "SO-9450", event_type: "BACK_ORDER_OOS", intent: "BACK_ORDER", lifecycle_state: "RESOLVED", shadow_verdict: "GREEN", selected_recipe: "BackOrderResolutionRecipe.py", final_status: "COMPLETE", created_at: "2026-04-17T08:00:00Z", updated_at: "2026-04-17T08:05:00Z", account_id: "acct-target", account_name: "Target",
  },
  {
    id: "exc-012", tenant_id: "acme-corp", order_id: "SO-10100", event_type: "OVER_MAX_QTY", intent: "OVER_MAX", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "OverMaxTrimRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-07T09:30:00Z", updated_at: "2026-04-07T09:38:00Z", account_id: "acct-costco", account_name: "Costco",
  },
  {
    id: "exc-013", tenant_id: "acme-corp", order_id: "SO-11200", event_type: "MIN_ORDER_QTY", intent: "MIN_ORDER_QTY", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "MOQRoundUpRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-15T07:45:00Z", updated_at: "2026-04-15T07:52:00Z", account_id: "acct-walmart", account_name: "Walmart",
  },
  {
    id: "exc-014", tenant_id: "acme-corp", order_id: "SO-12300", event_type: "PALLET_CONFIG_VIOLATION", intent: "PALLET_CONFIG", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "PalletAlignmentRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-12T11:20:00Z", updated_at: "2026-04-12T11:28:00Z", account_id: "acct-kroger", account_name: "Kroger",
  },
  // FAILED — pipeline crashed during recipe execution. Demonstrates the
  // execution-error surface distinct from compliance-blocked (RED verdict).
  {
    id: "exc-015", tenant_id: "acme-corp", order_id: "SO-13400", event_type: "ORDER_RECEIVED", intent: "CONTRACTUAL_CORRECTION", lifecycle_state: "FAILED", shadow_verdict: "GREEN", selected_recipe: "PriceAdjustmentRecipe.py", final_status: "FAIL_TO_HUMAN", created_at: "2026-04-13T14:05:00Z", updated_at: "2026-04-13T14:05:42Z", account_id: "acct-walmart", account_name: "Walmart",
  },
  // DELIVERY_DELAY — SD-DELAY-002 band (5+ days late). Dedicated section
  // renders from delivery_delay_analysis via data-presence pattern.
  {
    id: "exc-016", tenant_id: "acme-corp", order_id: "SO-14200", event_type: "DELIVERY_DELAY", intent: "DELIVERY_DELAY", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "DeliveryDelayResolutionRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-18T09:30:00Z", updated_at: "2026-04-18T09:35:00Z", account_id: "acct-target", account_name: "Target",
  },
  // PRICE_HOLD_RELEASE — auto-release branch (variance within tolerance).
  // Renders PriceHoldSection via OrderAnalysis.price_hold_analysis.
  {
    id: "exc-017", tenant_id: "acme-corp", order_id: "PO-PHR-001", event_type: "EDI_850_PRICE_HOLD", intent: "PRICE_HOLD_RELEASE", lifecycle_state: "RESOLVED", shadow_verdict: "GREEN", selected_recipe: "PriceHoldReleaseRecipe.py", final_status: "COMPLETE", created_at: "2026-04-06T08:00:00Z", updated_at: "2026-04-06T08:01:00Z", account_id: "acct-walmart", account_name: "Walmart",
  },
  // PRICE_HOLD_RELEASE — escalate band (> tolerance, ≤ hard-block).
  {
    id: "exc-018", tenant_id: "acme-corp", order_id: "PO-PHR-002", event_type: "EDI_850_PRICE_HOLD", intent: "PRICE_HOLD_RELEASE", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "PriceHoldReleaseRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-28T08:05:00Z", updated_at: "2026-04-28T08:06:00Z", account_id: "acct-kroger", account_name: "Kroger",
  },
  // EDI_MISMATCH — SKU sub_type, hard reject.
  {
    id: "exc-019", tenant_id: "acme-corp", order_id: "PO-EDM-SKU-001", event_type: "EDI_850_LINE_MISMATCH", intent: "EDI_MISMATCH", lifecycle_state: "BLOCKED", shadow_verdict: "RED", selected_recipe: "EdiMismatchRecipe.py", final_status: "BLOCKED", created_at: "2026-04-26T09:00:00Z", updated_at: "2026-04-26T09:01:00Z", account_id: "acct-target", account_name: "Target",
  },
  // EDI_MISMATCH — QTY sub_type, review required.
  {
    id: "exc-020", tenant_id: "acme-corp", order_id: "PO-EDM-QTY-001", event_type: "EDI_850_LINE_MISMATCH", intent: "EDI_MISMATCH", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "EdiMismatchRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-05T09:05:00Z", updated_at: "2026-04-05T09:06:00Z", account_id: "acct-costco", account_name: "Costco",
  },
  // PRICE_MISMATCH routing fork: EDI_850_LINE_MISMATCH event whose
  // metadata.mismatch_sub_type=PRICE_MISMATCH lands as
  // CONTRACTUAL_CORRECTION at backend classifier time. Renders the
  // existing PriceAnalysisSection (via price_analysis), NOT a new EDI
  // mismatch panel — proves the single-source-of-truth invariant for
  // pricing (CLAUDE.md §1).
  {
    id: "exc-021", tenant_id: "acme-corp", order_id: "PO-PM-ROUTING-001", event_type: "EDI_850_LINE_MISMATCH", intent: "CONTRACTUAL_CORRECTION", lifecycle_state: "RESOLVED", shadow_verdict: "GREEN", selected_recipe: "PriceAdjustmentRecipe.py", final_status: "COMPLETE", created_at: "2026-04-27T10:00:00Z", updated_at: "2026-04-27T10:01:00Z", account_id: "acct-walmart", account_name: "Walmart",
  },
  // ADR-027 Phase A.0 verdict-coverage demos (FAILED-state records
  // exercising every conditional gate's terminal verdict). These
  // are intentionally short halts — recipe never executes, shadow
  // may or may not run depending on where the gate halted. The UI
  // EventsTimeline + PipelineDAG render the halt point and reason
  // honestly rather than the linear stepper's misleading
  // "blocked at apply_effects" mapping.
  {
    id: "exc-022", tenant_id: "acme-corp", order_id: "SO-CB-001", event_type: "MASS_PRICING_RECALC", intent: "MASS_PRICING_ERROR", lifecycle_state: "FAILED", final_status: "FAIL_TO_HUMAN", created_at: "2026-04-29T07:00:00Z", updated_at: "2026-04-29T07:00:01Z", account_id: "acct-walmart", account_name: "Walmart",
  },
  {
    id: "exc-023", tenant_id: "acme-corp", order_id: "SO-NR-001", event_type: "MASS_PRICING_RECALC", intent: "MASS_PRICING_ERROR", lifecycle_state: "FAILED", final_status: "FAIL_TO_HUMAN", created_at: "2026-04-23T07:30:00Z", updated_at: "2026-04-23T07:30:00Z", account_id: "acct-kroger", account_name: "Kroger",
  },
  {
    id: "exc-024", tenant_id: "acme-corp", order_id: "SO-GW-001", event_type: "DUPLICATE_PO_RECEIVED", intent: "DUPLICATE_PO", lifecycle_state: "FAILED", selected_recipe: "DuplicatePORecipe.py", final_status: "FAIL_TO_HUMAN", created_at: "2026-04-20T08:00:00Z", updated_at: "2026-04-20T08:00:02Z", account_id: "acct-target", account_name: "Target",
  },
  {
    id: "exc-025", tenant_id: "acme-corp", order_id: "PO-PHR-BAD", event_type: "EDI_850_PRICE_HOLD", intent: "PRICE_HOLD_RELEASE", lifecycle_state: "FAILED", selected_recipe: "PriceHoldReleaseRecipe.py", final_status: "FAIL_TO_HUMAN", created_at: "2026-04-16T08:30:00Z", updated_at: "2026-04-16T08:30:00Z", account_id: "acct-costco", account_name: "Costco",
  },
  // MANUAL_ORDER_INTAKE (ADR-034 Phase C) — STANDARD_REVIEW band record. The
  // upstream email-intelligence-agent extracted a non-EDI PO from a regional
  // distributor; composite_confidence 0.88 lands in the standard-review band
  // (≥ 0.85, < 0.95). All four non-disable-able floor checks pass; one
  // ambiguous ship-to triggers REQUEST_CLARIFICATION. Renders the
  // EmailOrderEntrySection via OrderAnalysis.email_order_entry_analysis
  // (data-presence dispatch — no per-intent page logic).
  {
    id: "exc-026", tenant_id: "acme-corp", order_id: "EML-PO-2026-0042", event_type: "EMAIL_ORDER_ENTRY_REQUEST", intent: "MANUAL_ORDER_INTAKE", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "EmailOrderEntryRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-30T10:12:00Z", updated_at: "2026-04-30T10:13:30Z", account_id: "acct-southeast-distrib", account_name: "Southeast Beverage Distributors",
  },
];

// S15a — every record is attached to a case. Mirror asoe2's
// `materialise every record` invariant (api/case_resolver.py
// `should_materialise() -> True`) so the mock data layer behaves
// like the live backend: every exception carries a `parent_case_id`,
// and `casesApi.getRecords(parent_case_id).items` is non-empty.
// Pre-S15a only events used the `case-for-${id}` naming; aligning
// the records here closes the gap that left `/cases/[id]?record=…`
// rendering only the case header (the picker had no rows, so the
// inline ExceptionDetailPanel — and with it AgentReasoningCard,
// the HITL action ribbon, and DiagnosticsSection — never mounted).
MOCK_EXCEPTIONS.forEach((e) => {
  e.parent_case_id = `case-for-${e.id}`;
});
