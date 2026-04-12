/**
 * Shared test fixtures — equivalent to asoe2/tests/conftest.py
 *
 * Provides deterministic test data for all test categories.
 * All fixtures match the mock data in src/lib/api.ts.
 */

import type { ExceptionSummary, ExceptionDetail, HealthResponse, ShadowVerdict } from "@/types/exceptions";
import type { StatsResponse, TraceResponse } from "@/types/api";
import type { AuthUser } from "@/types/auth";

/* ── Auth fixtures (one per role) ──────────────────────────────────── */

export const ANALYST_USER: AuthUser = {
  id: "usr_analyst",
  sub: "usr_analyst",
  email: "analyst@acme.com",
  name: "Alice Analyst",
  roles: ["analyst"],
  org: "acme-corp",
  permissions: ["exceptions:read", "exceptions:approve", "dashboard:read"],
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
  allowed_intents: ["CONTRACTUAL_CORRECTION", "CREDIT_BLOCK", "MASS_PRICING_ERROR", "DUPLICATE_PO"],
  lifecycle_states: [
    "INGESTED", "CLASSIFYING", "AUDITING", "PENDING_REVIEW",
    "ESCALATED", "PENDING_ADMIN_REVIEW", "EXECUTING", "RESOLVED",
    "FAILED", "BLOCKED", "REJECTED", "CLOSED",
  ],
  allowed_recipes: ["PriceAdjustmentRecipe.py", "CreditHoldReleaseRecipe.py", "DuplicatePORecipe.py"],
};

/* ── Stats fixture ─────────────────────────────────────────────────── */

export const MOCK_STATS: StatsResponse = {
  total_exceptions: 8,
  open_exceptions: 4,
  auto_resolved: 3,
  manual_review: 2,
  blocked: 1,
  failed: 0,
  avg_resolution_time_seconds: 480,
  by_intent: {
    CONTRACTUAL_CORRECTION: 3,
    DUPLICATE_PO: 2,
    CREDIT_BLOCK: 2,
    MASS_PRICING_ERROR: 1,
  },
  by_lifecycle_state: {
    RESOLVED: 2,
    PENDING_REVIEW: 2,
    BLOCKED: 1,
    EXECUTING: 1,
    ESCALATED: 1,
    CLOSED: 1,
  },
  by_shadow_verdict: {
    GREEN: 4,
    YELLOW: 3,
    RED: 1,
  },
};
