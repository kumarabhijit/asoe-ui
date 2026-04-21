/**
 * Type Contract Tests — verifies TypeScript types contain expected fields.
 *
 * These tests validate that our type definitions include the fields
 * the backend sends. If asoe2 adds a required field, adding the
 * corresponding mock data here will fail until the type is updated.
 */

import type {
  Intent,
  ShadowVerdict,
  TerminalStatus,
  LifecycleState,
  PipelineNode,
  ExceptionSummary,
  ExceptionDetail,
  HealthResponse,
} from "@/types/exceptions";
import type { ResolveResponse, StatsResponse, TraceResponse } from "@/types/api";
import type { WSEvent, PipelineProgressPayload } from "@/types/websocket";
import type { AuthUser, LoginResponse, Role } from "@/types/auth";
import {
  GREEN_EXCEPTION,
  YELLOW_EXCEPTION,
  RED_EXCEPTION,
  MOCK_HEALTH,
  MOCK_STATS,
  MOCK_TRACE,
  ANALYST_USER,
  makeExceptionDetail,
} from "../fixtures";

describe("Exception type contracts", () => {
  it("ExceptionSummary has all required fields", () => {
    const exc: ExceptionSummary = GREEN_EXCEPTION;
    expect(exc.id).toBeDefined();
    expect(exc.tenant_id).toBeDefined();
    expect(exc.order_id).toBeDefined();
    expect(exc.event_type).toBeDefined();
    expect(exc.lifecycle_state).toBeDefined();
    expect(exc.created_at).toBeDefined();
    expect(exc.updated_at).toBeDefined();
  });

  it("ExceptionDetail extends ExceptionSummary with resolution fields", () => {
    const detail: ExceptionDetail = makeExceptionDetail(GREEN_EXCEPTION);
    expect(detail.resolution_data).toBeDefined();
    // These fields exist (may be undefined for non-resolved)
    expect("resolved_by" in detail).toBe(true);
    expect("resolved_action" in detail).toBe(true);
    expect("resolution_notes" in detail).toBe(true);
  });

  it("HealthResponse has dynamic enum arrays", () => {
    const health: HealthResponse = MOCK_HEALTH;
    expect(Array.isArray(health.allowed_intents)).toBe(true);
    expect(Array.isArray(health.lifecycle_states)).toBe(true);
    expect(Array.isArray(health.allowed_recipes)).toBe(true);
    expect(health.allowed_intents.length).toBeGreaterThan(0);
    expect(health.lifecycle_states.length).toBe(12); // 12 lifecycle states
  });

  it("intent vocabulary contains every shipped intent", () => {
    // Length assertion replaced with toContain after the OM coverage
    // expansion (asoe2 added PRICE_HOLD_RELEASE + EDI_MISMATCH). Keeps
    // the fitness test green as the vocabulary grows without becoming
    // a brittle golden.
    expect(MOCK_HEALTH.allowed_intents).toContain("CONTRACTUAL_CORRECTION");
    expect(MOCK_HEALTH.allowed_intents).toContain("CREDIT_BLOCK");
    expect(MOCK_HEALTH.allowed_intents).toContain("MASS_PRICING_ERROR");
    expect(MOCK_HEALTH.allowed_intents).toContain("DUPLICATE_PO");
    expect(MOCK_HEALTH.allowed_intents).toContain("PRICE_HOLD_RELEASE");
    expect(MOCK_HEALTH.allowed_intents).toContain("EDI_MISMATCH");
  });

  it("recipe vocabulary contains every registered recipe", () => {
    // Same rationale as the intents assertion above — use toContain.
    expect(MOCK_HEALTH.allowed_recipes).toContain("PriceAdjustmentRecipe.py");
    expect(MOCK_HEALTH.allowed_recipes).toContain("CreditHoldReleaseRecipe.py");
    expect(MOCK_HEALTH.allowed_recipes).toContain("DuplicatePORecipe.py");
    expect(MOCK_HEALTH.allowed_recipes).toContain("PriceHoldReleaseRecipe.py");
    expect(MOCK_HEALTH.allowed_recipes).toContain("EdiMismatchRecipe.py");
  });

  it("StatsResponse has breakdown fields", () => {
    const stats: StatsResponse = MOCK_STATS;
    expect(stats.total_exceptions).toBeDefined();
    expect(stats.open_exceptions).toBeDefined();
    expect(stats.auto_resolved).toBeDefined();
    expect(stats.by_intent).toBeDefined();
    expect(stats.by_lifecycle_state).toBeDefined();
    expect(stats.by_shadow_verdict).toBeDefined();
  });

  it("TraceResponse has audit trail fields", () => {
    const trace: TraceResponse = MOCK_TRACE;
    expect(trace.trace_id).toBeDefined();
    expect(trace.event_id).toBeDefined();
    expect(Array.isArray(trace.shadow_policy_hits)).toBe(true);
    expect(Array.isArray(trace.gateway_calls)).toBe(true);
    expect(typeof trace.is_fallback_generated).toBe("boolean");
  });
});

describe("Auth type contracts", () => {
  it("AuthUser has RBAC fields", () => {
    const user: AuthUser = ANALYST_USER;
    expect(Array.isArray(user.roles)).toBe(true);
    expect(typeof user.org).toBe("string");
    expect(Array.isArray(user.permissions)).toBe(true);
  });

  it("Role type covers all 5 roles", () => {
    const roles: Role[] = ["analyst", "manager", "admin", "viewer", "partner"];
    expect(roles).toHaveLength(5);
  });
});

describe("WebSocket type contracts", () => {
  it("PipelineNode covers all 10 nodes", () => {
    const nodes: PipelineNode[] = [
      "ingest", "classify", "load_skill", "validate_circuit_breaker",
      "shadow_audit", "select_recipe", "validate_types",
      "resolve_dependencies", "execute_recipe", "apply_effects",
    ];
    expect(nodes).toHaveLength(10);
  });
});

describe("Fixture self-consistency", () => {
  it("GREEN exception has GREEN verdict", () => {
    expect(GREEN_EXCEPTION.shadow_verdict).toBe("GREEN");
    expect(GREEN_EXCEPTION.lifecycle_state).toBe("RESOLVED");
  });

  it("YELLOW exception has YELLOW verdict", () => {
    expect(YELLOW_EXCEPTION.shadow_verdict).toBe("YELLOW");
    expect(YELLOW_EXCEPTION.lifecycle_state).toBe("PENDING_REVIEW");
  });

  it("RED exception has RED verdict", () => {
    expect(RED_EXCEPTION.shadow_verdict).toBe("RED");
    expect(RED_EXCEPTION.lifecycle_state).toBe("BLOCKED");
  });
});
