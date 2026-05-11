/**
 * Shared test fixtures — equivalent to asoe2/tests/conftest.py
 *
 * Provides deterministic test data for all test categories.
 * All fixtures match the mock data in src/lib/api.ts.
 */

import type { ExceptionSummary, ExceptionDetail, HealthResponse, ShadowVerdict } from "@/types/exceptions";
import type { StatsResponse, TraceResponse } from "@/types/api";
import type { AuthUser } from "@/types/auth";
import {
  ALLOWED_OVERRIDE_REASON_TAGS,
  ALLOWED_OVERRIDE_REASON_TAGS_BY_INTENT,
} from "@/lib/__generated__/curated_reason_tags";

/* ── Auth fixtures (one per role) ──────────────────────────────────── */

export const ANALYST_USER: AuthUser = {
  id: "usr_analyst",
  sub: "usr_analyst",
  email: "analyst@acme.com",
  name: "Alice Analyst",
  roles: ["analyst"],
  org: "acme-corp",
  permissions: ["exceptions:read", "exceptions:approve", "dashboard:read"],
  assigned_accounts: [],
  visible_tabs: ["inbox", "exceptions", "dashboard"],
  env: "sandbox",
};

export const MANAGER_USER: AuthUser = {
  id: "usr_manager",
  sub: "usr_manager",
  email: "manager@acme.com",
  name: "Mike Manager",
  roles: ["manager"],
  org: "acme-corp",
  permissions: ["exceptions:read", "exceptions:approve", "exceptions:override", "rules:write", "dashboard:read"],
  assigned_accounts: [],
  visible_tabs: ["inbox", "exceptions", "dashboard", "settings"],
  env: "sandbox",
};

export const ADMIN_USER: AuthUser = {
  id: "usr_admin",
  sub: "usr_admin",
  email: "admin@acme.com",
  name: "Ada Admin",
  roles: ["admin"],
  org: "acme-corp",
  permissions: ["exceptions:read", "exceptions:approve", "exceptions:override", "rules:write", "users:manage", "policy:write", "audit:read", "dashboard:read"],
  assigned_accounts: [],
  visible_tabs: ["inbox", "exceptions", "dashboard", "settings"],
  env: "sandbox",
};

export const VIEWER_USER: AuthUser = {
  id: "usr_viewer",
  sub: "usr_viewer",
  email: "viewer@acme.com",
  name: "Victor Viewer",
  roles: ["viewer"],
  org: "acme-corp",
  permissions: ["exceptions:read", "dashboard:read"],
  assigned_accounts: [],
  visible_tabs: ["inbox", "exceptions", "dashboard"],
  env: "sandbox",
};

export const PARTNER_USER: AuthUser = {
  id: "usr_partner",
  sub: "usr_partner",
  email: "partner@retailer.com",
  name: "Pat Partner",
  roles: ["partner"],
  org: "acme-corp",
  permissions: ["exceptions:read"],
  assigned_accounts: ["acct-walmart"],
  visible_tabs: ["inbox", "exceptions"],
  env: "sandbox",
  retailer_id: "retailer-001",
};

/* ── Exception fixtures (one per verdict) ──────────────────────────── */

export const GREEN_EXCEPTION: ExceptionSummary = {
  id: "exc-green-001",
  tenant_id: "acme-corp",
  order_id: "SO-1001",
  event_type: "EDI_850_PRICE_MISMATCH",
  intent: "CONTRACTUAL_CORRECTION",
  lifecycle_state: "RESOLVED",
  shadow_verdict: "GREEN",
  selected_recipe: "PriceAdjustmentRecipe.py",
  final_status: "COMPLETE",
  created_at: "2026-04-11T08:12:00Z",
  updated_at: "2026-04-11T08:20:00Z",
};

export const YELLOW_EXCEPTION: ExceptionSummary = {
  id: "exc-yellow-001",
  tenant_id: "acme-corp",
  order_id: "SO-1042",
  event_type: "EDI_850_DUPLICATE_PO",
  intent: "DUPLICATE_PO",
  lifecycle_state: "PENDING_REVIEW",
  shadow_verdict: "YELLOW",
  selected_recipe: "DuplicatePORecipe.py",
  final_status: "MANUAL_REVIEW_REQUIRED",
  created_at: "2026-04-11T09:05:00Z",
  updated_at: "2026-04-11T09:13:00Z",
};

export const RED_EXCEPTION: ExceptionSummary = {
  id: "exc-red-001",
  tenant_id: "acme-corp",
  order_id: "SO-2200",
  event_type: "CREDIT_LIMIT_BREACH",
  intent: "CREDIT_BLOCK",
  lifecycle_state: "BLOCKED",
  shadow_verdict: "RED",
  selected_recipe: undefined,
  final_status: "BLOCKED",
  created_at: "2026-04-11T10:30:00Z",
  updated_at: "2026-04-11T10:31:00Z",
};

export function makeExceptionDetail(summary: ExceptionSummary): ExceptionDetail {
  return {
    ...summary,
    resolution_data: summary.final_status === "COMPLETE" ? { credit_amount: 1250.0 } : {},
    resolved_by: summary.lifecycle_state === "RESOLVED" ? "system" : undefined,
    resolved_action: undefined,
    resolution_notes: undefined,
  };
}

/* ── Trace fixture ─────────────────────────────────────────────────── */

export const MOCK_TRACE: TraceResponse = {
  trace_id: "trace-001",
  event_id: "SO-1001",
  skill_name: "CONTRACTUAL_CORRECTION.md",
  intent_selected: "CONTRACTUAL_CORRECTION",
  shadow_verdict: "GREEN",
  shadow_policy_hits: [],
  recipe_name: "PriceAdjustmentRecipe.py",
  constrained_output_schemas: { intent: "IntentDecision", shadow: "ShadowDecisionSchema" },
  gateway_calls: ["erp:update_condition_record"],
  backend_fallback: "deterministic_fallback",
  is_fallback_generated: true,
  final_status: "COMPLETE",
  explanation: "Deterministic execution completed successfully.",
};

/* ── Health fixture ────────────────────────────────────────────────── */

export const MOCK_HEALTH: HealthResponse = {
  status: "ok",
  version: "0.3.2",
  kill_switch: false,
  explain_mode: false,
  allowed_intents: [
    "CONTRACTUAL_CORRECTION", "CREDIT_BLOCK", "MASS_PRICING_ERROR",
    "DUPLICATE_PO", "PRICE_HOLD_RELEASE", "EDI_MISMATCH",
    "BACK_ORDER", "OVER_MAX", "MIN_ORDER_QTY",
    "PALLET_CONFIG", "DELIVERY_DELAY", "MANUAL_ORDER_INTAKE",
  ],
  lifecycle_states: [
    // `EXECUTING` retired in asoe2 Phase 19 — backend no longer emits it.
    "INGESTED", "CLASSIFYING", "AUDITING", "PENDING_REVIEW",
    "ESCALATED", "PENDING_ADMIN_REVIEW", "PENDING_COSIGN", "RESOLVED",
    "FAILED", "BLOCKED", "REJECTED", "CLOSED",
  ],
  allowed_recipes: [
    "PriceAdjustmentRecipe.py", "CreditHoldReleaseRecipe.py",
    "DuplicatePORecipe.py", "PriceHoldReleaseRecipe.py",
    "EdiMismatchRecipe.py",
    "BackOrderResolutionRecipe.py", "OverMaxTrimRecipe.py",
    "MOQRoundUpRecipe.py", "PalletAlignmentRecipe.py",
    "DeliveryDelayResolutionRecipe.py",
    "EmailOrderEntryRecipe.py",
  ],
  allowed_resolution_actions: [
    "BLOCK_AND_NOTIFY", "MERGE", "SUPERSEDE", "ALLOW_BOTH",
    "ESCALATE", "REQUEST_BUYER_CONFIRMATION",
    "ONE_CLICK_APPROVE", "STANDARD_REVIEW", "LOW_CONFIDENCE_FLAG",
    "AUTO_CORRECT", "REQUEST_CLARIFICATION", "REJECT",
  ],
  // Sourced from asoe2/constraints/specs.py via the snapshot at
  // tests/contract/snapshots/curated_reason_tags.json. Keeps fixtures
  // and src/lib/api.ts MOCK_HEALTH on the same wire shape; parity
  // pinned by tests/contract/test_reason_tag_vocab_parity.test.ts.
  allowed_override_reason_tags: [...ALLOWED_OVERRIDE_REASON_TAGS],
  allowed_override_reason_tags_by_intent: Object.fromEntries(
    Object.entries(ALLOWED_OVERRIDE_REASON_TAGS_BY_INTENT).map(
      ([intent, tags]) => [intent, [...tags]],
    ),
  ),
};

/* ── Stats fixture ─────────────────────────────────────────────────── */

export const MOCK_STATS: StatsResponse = {
  // Bumped from 8 → 12 to include 2 PHR + 2 EDM exceptions. Totals
  // across by_intent, by_lifecycle_state, and by_shadow_verdict are
  // kept consistent.
  total_exceptions: 12,
  open_exceptions: 6,
  auto_resolved: 4,
  manual_review: 4,
  blocked: 2,
  failed: 0,
  avg_resolution_time_seconds: 480,
  by_intent: {
    CONTRACTUAL_CORRECTION: 3,
    DUPLICATE_PO: 2,
    CREDIT_BLOCK: 2,
    MASS_PRICING_ERROR: 1,
    PRICE_HOLD_RELEASE: 2,
    EDI_MISMATCH: 2,
  },
  by_lifecycle_state: {
    // Counts rebalanced after asoe2 retired EXECUTING (Phase 19) —
    // the previously-EXECUTING exception now lands RESOLVED, mirroring
    // the same rebalance done in src/lib/api.ts MOCK_STATS. Sum stays
    // at 12 so the roundtrip invariant
    // (price_hold_release_data_flow.test.tsx::"totals across breakdowns
    // stay consistent") holds.
    RESOLVED: 4,
    PENDING_REVIEW: 4,
    BLOCKED: 2,
    ESCALATED: 1,
    CLOSED: 1,
  },
  by_shadow_verdict: {
    GREEN: 5,
    YELLOW: 5,
    RED: 2,
  },
};

/* ── PRICE_HOLD_RELEASE fixtures (3 — one per recipe action branch) ── */

import type { OrderAnalysis, PriceHoldAnalysisData, EdiMismatchAnalysisData } from "@/types/exceptions";

export const PHR_AUTO_RELEASE_EXCEPTION: ExceptionSummary = {
  id: "exc-phr-auto-001",
  tenant_id: "acme-corp",
  order_id: "PO-PHR-001",
  event_type: "EDI_850_PRICE_HOLD",
  intent: "PRICE_HOLD_RELEASE",
  lifecycle_state: "RESOLVED",
  shadow_verdict: "GREEN",
  selected_recipe: "PriceHoldReleaseRecipe.py",
  final_status: "COMPLETE",
  created_at: "2026-04-15T08:00:00Z",
  updated_at: "2026-04-15T08:01:00Z",
};

export const PHR_ESCALATE_EXCEPTION: ExceptionSummary = {
  id: "exc-phr-esc-001",
  tenant_id: "acme-corp",
  order_id: "PO-PHR-002",
  event_type: "EDI_850_PRICE_HOLD",
  intent: "PRICE_HOLD_RELEASE",
  lifecycle_state: "PENDING_REVIEW",
  shadow_verdict: "YELLOW",
  selected_recipe: "PriceHoldReleaseRecipe.py",
  final_status: "MANUAL_REVIEW_REQUIRED",
  created_at: "2026-04-15T08:05:00Z",
  updated_at: "2026-04-15T08:06:00Z",
};

export const PHR_HARD_BLOCK_EXCEPTION: ExceptionSummary = {
  id: "exc-phr-hard-001",
  tenant_id: "acme-corp",
  order_id: "PO-PHR-003",
  event_type: "EDI_850_PRICE_HOLD",
  intent: "PRICE_HOLD_RELEASE",
  lifecycle_state: "BLOCKED",
  shadow_verdict: "RED",
  selected_recipe: "PriceHoldReleaseRecipe.py",
  final_status: "BLOCKED",
  created_at: "2026-04-15T08:10:00Z",
  updated_at: "2026-04-15T08:11:00Z",
};

/* ── EDI_MISMATCH fixtures (4 — one per accepted sub_type) ─────────── */

export const EDM_SKU_EXCEPTION: ExceptionSummary = {
  id: "exc-edm-sku-001",
  tenant_id: "acme-corp",
  order_id: "PO-EDM-SKU-001",
  event_type: "EDI_850_LINE_MISMATCH",
  intent: "EDI_MISMATCH",
  lifecycle_state: "BLOCKED",
  shadow_verdict: "RED",
  selected_recipe: "EdiMismatchRecipe.py",
  final_status: "BLOCKED",
  created_at: "2026-04-15T09:00:00Z",
  updated_at: "2026-04-15T09:01:00Z",
};

export const EDM_QTY_EXCEPTION: ExceptionSummary = {
  id: "exc-edm-qty-001",
  tenant_id: "acme-corp",
  order_id: "PO-EDM-QTY-001",
  event_type: "EDI_850_LINE_MISMATCH",
  intent: "EDI_MISMATCH",
  lifecycle_state: "PENDING_REVIEW",
  shadow_verdict: "YELLOW",
  selected_recipe: "EdiMismatchRecipe.py",
  final_status: "MANUAL_REVIEW_REQUIRED",
  created_at: "2026-04-15T09:05:00Z",
  updated_at: "2026-04-15T09:06:00Z",
};

export const EDM_UOM_EXCEPTION: ExceptionSummary = {
  id: "exc-edm-uom-001",
  tenant_id: "acme-corp",
  order_id: "PO-EDM-UOM-001",
  event_type: "EDI_850_LINE_MISMATCH",
  intent: "EDI_MISMATCH",
  lifecycle_state: "PENDING_REVIEW",
  shadow_verdict: "YELLOW",
  selected_recipe: "EdiMismatchRecipe.py",
  final_status: "MANUAL_REVIEW_REQUIRED",
  created_at: "2026-04-15T09:10:00Z",
  updated_at: "2026-04-15T09:11:00Z",
};

export const EDM_SHIP_TO_EXCEPTION: ExceptionSummary = {
  id: "exc-edm-ship-001",
  tenant_id: "acme-corp",
  order_id: "PO-EDM-SHIP-001",
  event_type: "EDI_850_LINE_MISMATCH",
  intent: "EDI_MISMATCH",
  lifecycle_state: "ESCALATED",
  shadow_verdict: "YELLOW",
  selected_recipe: "EdiMismatchRecipe.py",
  final_status: "MANUAL_REVIEW_REQUIRED",
  created_at: "2026-04-15T09:15:00Z",
  updated_at: "2026-04-15T09:16:00Z",
};

/* ── PRICE_MISMATCH routing-fork fixture ───────────────────────────────
 * EDI_850_LINE_MISMATCH event whose metadata.mismatch_sub_type is
 * PRICE_MISMATCH lands as CONTRACTUAL_CORRECTION at backend classifier
 * time (preserving PriceAdjustmentRecipe as the single source of truth
 * for pricing). Use this fixture to prove the UI never double-renders
 * an EDI mismatch panel for these events.
 */
export const PRICE_MISMATCH_CONTRACTUAL_EXCEPTION: ExceptionSummary = {
  id: "exc-pm-routing-001",
  tenant_id: "acme-corp",
  order_id: "PO-PM-ROUTING-001",
  event_type: "EDI_850_LINE_MISMATCH",
  intent: "CONTRACTUAL_CORRECTION",
  lifecycle_state: "RESOLVED",
  shadow_verdict: "GREEN",
  selected_recipe: "PriceAdjustmentRecipe.py",
  final_status: "COMPLETE",
  created_at: "2026-04-15T10:00:00Z",
  updated_at: "2026-04-15T10:01:00Z",
};

/* ── Helper factories that populate the new analysis fields ─────────── */

const _DEFAULT_PHR_ANALYSIS: PriceHoldAnalysisData = {
  hold_status: "HELD",
  po_price: 105,
  sap_base_price: 100,
  variance_pct: 0.05,
  tolerance_pct: 0.02,
  hard_block_pct: 0.10,
  action: "ESCALATE",
  reason: "Variance 0.0500 above tolerance 0.0200 but within hard-block 0.1000; manual review required.",
};

/**
 * Build an OrderAnalysis for a PRICE_HOLD_RELEASE summary, populating
 * `price_hold_analysis` with a shape consistent with the
 * `summary.shadow_verdict` (GREEN→AUTO_RELEASE, YELLOW→ESCALATE,
 * RED→HARD_BLOCK). Analysis is fetched separately from ExceptionDetail
 * in the live UI (analysisApi), so the helper returns just the
 * analysis payload — pair it with `makeExceptionDetail(summary)` when
 * a test needs both surfaces.
 */
export function makePriceHoldAnalysis(
  summary: ExceptionSummary,
  overrides: Partial<PriceHoldAnalysisData> = {},
): { detail: ExceptionDetail; analysis: OrderAnalysis } {
  const action: PriceHoldAnalysisData["action"] =
    summary.shadow_verdict === "GREEN" ? "AUTO_RELEASE" :
    summary.shadow_verdict === "RED" ? "HARD_BLOCK" : "ESCALATE";
  const variance =
    action === "AUTO_RELEASE" ? 0.01 :
    action === "HARD_BLOCK" ? 0.15 : 0.05;
  const phr: PriceHoldAnalysisData = {
    ..._DEFAULT_PHR_ANALYSIS,
    variance_pct: variance,
    po_price: 100 * (1 + variance),
    action,
    reason: `Variance ${variance.toFixed(4)} → ${action}.`,
    ...overrides,
  };
  return {
    detail: makeExceptionDetail(summary),
    analysis: { price_hold_analysis: phr } as Partial<OrderAnalysis> as OrderAnalysis,
  };
}

const _CLASSIFICATION_BY_SUB_TYPE: Record<string, EdiMismatchAnalysisData["classification"]> = {
  SKU_MISMATCH: "HARD_REJECT",
  QTY_MISMATCH: "REVIEW",
  UOM_MISMATCH: "REVIEW",
  SHIP_TO_MISMATCH: "ESCALATE",
};

const _ACTION_BY_CLASSIFICATION: Record<EdiMismatchAnalysisData["classification"], string> = {
  HARD_REJECT: "BLOCK_AND_NOTIFY",
  REVIEW: "REQUEST_BUYER_CONFIRMATION",
  ESCALATE: "ESCALATE",
};

/**
 * Build an OrderAnalysis for an EDI_MISMATCH summary, populating
 * `edi_mismatch_analysis` keyed on the sub_type. Defaults cover the
 * four accepted sub_types; pass `expected_value` / `received_value`
 * overrides to exercise the `unknown` shape matrix (string / number /
 * object).
 */
export function makeEdiMismatchAnalysis(
  summary: ExceptionSummary,
  opts: {
    sub_type: string;
    expected_value?: unknown;
    received_value?: unknown;
  },
): { detail: ExceptionDetail; analysis: OrderAnalysis } {
  const classification = _CLASSIFICATION_BY_SUB_TYPE[opts.sub_type] ?? "REVIEW";
  const recommended_action = _ACTION_BY_CLASSIFICATION[classification];
  const autonomy: EdiMismatchAnalysisData["autonomy_level"] =
    opts.sub_type === "SKU_MISMATCH" ? "L3" :
    opts.sub_type === "SHIP_TO_MISMATCH" ? "L1" : "L2";
  const edm: EdiMismatchAnalysisData = {
    sub_type: opts.sub_type,
    classification,
    recommended_action,
    autonomy_level: autonomy,
    expected_value: opts.expected_value ?? "expected-x",
    received_value: opts.received_value ?? "received-y",
    notification_template:
      classification === "ESCALATE" ? null :
      classification === "HARD_REJECT" ? "edi_line_mismatch_blocked" :
      "edi_line_mismatch_inquiry",
  };
  return {
    detail: makeExceptionDetail(summary),
    analysis: { edi_mismatch_analysis: edm } as Partial<OrderAnalysis> as OrderAnalysis,
  };
}
