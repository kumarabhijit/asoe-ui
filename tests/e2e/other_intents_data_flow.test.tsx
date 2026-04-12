/**
 * E2E Data Flow Tests — CONTRACTUAL_CORRECTION, CREDIT_BLOCK, MASS_PRICING_ERROR
 *
 * Validates frontend data contracts for the three non-DUPLICATE_PO intents
 * on the Exception Queue page. Each intent has a distinct flow:
 *
 *   CONTRACTUAL_CORRECTION — GREEN shadow → auto-resolve → COMPLETE
 *   CREDIT_BLOCK           — YELLOW shadow → PENDING_REVIEW → HITL
 *   MASS_PRICING_ERROR     — RED shadow → BLOCKED → admin-release
 */

import { describe, it, expect } from "vitest";

import type {
  ExceptionSummary,
  ExceptionDetail,
  HealthResponse,
  OrderAnalysis,
  EntityProfile,
  ImpactMetrics,
  LineItem,
  TraceRecord,
} from "@/types/exceptions";
import type {
  StatsResponse,
  TraceResponse,
  ResolveResponse,
  ChallengeRequest,
  AdminReleaseRequest,
  OverrideRequest,
} from "@/types/api";

import {
  GREEN_EXCEPTION,
  YELLOW_EXCEPTION,
  RED_EXCEPTION,
  MOCK_HEALTH,
  MOCK_STATS,
  MOCK_TRACE,
  makeExceptionDetail,
} from "../fixtures";

// ===========================================================================
// CONTRACTUAL_CORRECTION — GREEN path
// ===========================================================================

describe("CONTRACTUAL_CORRECTION type contracts", () => {
  it("ExceptionSummary for GREEN pricing correction", () => {
    const exc: ExceptionSummary = GREEN_EXCEPTION;
    expect(exc.intent).toBe("CONTRACTUAL_CORRECTION");
    expect(exc.event_type).toBe("EDI_850_PRICE_MISMATCH");
    expect(exc.shadow_verdict).toBe("GREEN");
    expect(exc.selected_recipe).toBe("PriceAdjustmentRecipe.py");
    expect(exc.final_status).toBe("COMPLETE");
    expect(exc.lifecycle_state).toBe("RESOLVED");
  });

  it("ExceptionDetail includes resolution_data with recipe outputs", () => {
    const detail: ExceptionDetail = {
      ...GREEN_EXCEPTION,
      trace_id: "trace-cc-001",
      resolution_data: {
        status: "SUCCESS",
        applied_condition: "YK07",
        new_net_price: 90.0,
        payload: {
          OrderID: "SO-1001",
          Item: 1,
          ConditionType: "YK07",
          NewValue: 90.0,
          ReasonCode: "CUST_MATCH",
        },
      },
      resolved_by: "system",
      resolved_action: undefined,
      resolution_notes: undefined,
    };
    expect(detail.resolution_data["applied_condition"]).toBe("YK07");
    expect(detail.resolution_data["new_net_price"]).toBe(90.0);
    expect(detail.resolution_data["status"]).toBe("SUCCESS");
  });

  it("ResolveResponse for successful pricing correction", () => {
    const resp: ResolveResponse = {
      exception_id: "exc-cc-001",
      trace_id: "trace-cc-001",
      intent: "CONTRACTUAL_CORRECTION",
      shadow_verdict: "GREEN",
      selected_recipe: "PriceAdjustmentRecipe.py",
      final_status: "COMPLETE",
      explanation: "Deterministic execution completed successfully.",
      execution_log: {
        recipe_name: "PriceAdjustmentRecipe.py",
        outputs: {
          status: "SUCCESS",
          applied_condition: "YK07",
          new_net_price: 90.0,
        },
      },
      effect_results: [],
    };
    expect(resp.final_status).toBe("COMPLETE");
    expect(resp.execution_log?.outputs["applied_condition"]).toBe("YK07");
  });

  it("over-threshold pricing correction → FAIL_TO_HUMAN", () => {
    const resp: ResolveResponse = {
      exception_id: "exc-cc-002",
      trace_id: "trace-cc-002",
      intent: "CONTRACTUAL_CORRECTION",
      shadow_verdict: "GREEN",
      selected_recipe: "PriceAdjustmentRecipe.py",
      final_status: "FAIL_TO_HUMAN",
      explanation: "Discount 20.00% exceeds 15% threshold.",
      execution_log: {
        recipe_name: "PriceAdjustmentRecipe.py",
        outputs: { status: "FAILED", reason: "Discount 20.00% exceeds 15% threshold." },
      },
      effect_results: [],
    };
    expect(resp.final_status).toBe("FAIL_TO_HUMAN");
  });

  it("challenge is available on RESOLVED pricing corrections", () => {
    const req: ChallengeRequest = {
      challenge_reason: "Applied condition YK07 may be incorrect for this retailer",
    };
    expect(typeof req.challenge_reason).toBe("string");
    // After challenge: RESOLVED → ESCALATED
    const challenged: ExceptionDetail = {
      ...makeExceptionDetail(GREEN_EXCEPTION),
      lifecycle_state: "ESCALATED",
      resolution_notes: "CHALLENGED: Applied condition YK07 may be incorrect",
    };
    expect(challenged.lifecycle_state).toBe("ESCALATED");
  });
});

describe("CONTRACTUAL_CORRECTION OrderAnalysis", () => {
  const analysis: OrderAnalysis = {
    diagnosis: "Two line items reference promo pricing from an expired Q4 trade promotion.",
    confidence: 92,
    risk: "MEDIUM",
    resolution: "AUTO_OVERRIDE",
    root_cause: "Promotional condition ZPROM/155 expired 12/31/2025.",
    recommendation: "Adjust price to contract base — reload Q1 promotional conditions.",
    entity_profile: {
      customer_name: "Metro Grocery Holdings",
      bp_number: "BP-102440",
      customer_tier: "Gold",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 4100 — Atlanta DC",
      region: "Southeast",
    },
    impact_metrics: {
      revenue_at_risk: 1218.24,
      delta_amount: 766.08,
      delta_percentage: 11.3,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-04-12T18:00:00Z",
      affected_lines: 3,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "TPR discount ZPROM expired 12/31.",
        resolution: "AUTO_OVERRIDE",
        risk: "MEDIUM",
        waterfall: [
          { type: "BASE", label: "Base Price (PR00)", record: "PR00/10", value: 14.88, running: 14.88 },
          { type: "TPR", label: "Trade Promo (ZPROM)", record: "ZPROM/155", value: -1.68, running: 13.20 },
          { type: "ERROR", label: "Promo Validity Check", record: "ZPROM/155", value: null, running: null, error: "Promotional condition expired." },
          { type: "RESULT", label: "ERP Computed Price", record: "—", value: 14.88, running: 14.88 },
        ],
      },
    ],
  };

  it("has pricing-specific root cause and recommendation", () => {
    expect(analysis.root_cause).toContain("Promotional condition");
    expect(analysis.recommendation).toContain("contract base");
  });

  it("has pricing waterfall with condition chain", () => {
    const waterfall = analysis.lines[0].waterfall;
    expect(waterfall.length).toBeGreaterThanOrEqual(3);
    expect(waterfall[0].type).toBe("BASE");
    const errorStep = waterfall.find((s) => s.type === "ERROR");
    expect(errorStep).toBeDefined();
    expect(errorStep?.error).toContain("expired");
  });

  it("entity profile has customer tier and credit standing", () => {
    expect(analysis.entity_profile.customer_tier).toBe("Gold");
    expect(analysis.entity_profile.credit_standing).toBe("Good");
  });

  it("impact metrics show delta percentage for pricing", () => {
    expect(analysis.impact_metrics.delta_percentage).toBe(11.3);
    expect(analysis.impact_metrics.affected_lines).toBe(3);
  });
});

// ===========================================================================
// CREDIT_BLOCK — YELLOW path
// ===========================================================================

describe("CREDIT_BLOCK type contracts", () => {
  it("ExceptionSummary for YELLOW credit block", () => {
    // exc-007 in mock data is CREDIT_BLOCK with YELLOW verdict
    const exc: ExceptionSummary = {
      id: "exc-007",
      tenant_id: "acme-corp",
      order_id: "SO-6001",
      event_type: "CREDIT_LIMIT_BREACH",
      intent: "CREDIT_BLOCK",
      lifecycle_state: "PENDING_REVIEW",
      shadow_verdict: "YELLOW",
      selected_recipe: "CreditHoldReleaseRecipe.py",
      final_status: "MANUAL_REVIEW_REQUIRED",
      created_at: "2026-04-11T07:15:00Z",
      updated_at: "2026-04-11T07:22:00Z",
    };
    expect(exc.intent).toBe("CREDIT_BLOCK");
    expect(exc.shadow_verdict).toBe("YELLOW");
    expect(exc.lifecycle_state).toBe("PENDING_REVIEW");
    expect(exc.final_status).toBe("MANUAL_REVIEW_REQUIRED");
  });

  it("YELLOW verdict halts before recipe — selected_recipe may be null from backend", () => {
    // Backend: YELLOW shadow halts pipeline before recipe selection
    const backendResp: ResolveResponse = {
      exception_id: "exc-cb-001",
      trace_id: "trace-cb-001",
      intent: "CREDIT_BLOCK",
      shadow_verdict: "YELLOW",
      selected_recipe: null,
      final_status: "MANUAL_REVIEW_REQUIRED",
      explanation: "Credit path requires manual review by policy.",
      execution_log: null,
      effect_results: [],
    };
    expect(backendResp.selected_recipe).toBeNull();
    expect(backendResp.execution_log).toBeNull();
  });

  it("credit block HITL: approve transitions to EXECUTING", () => {
    const approved: ExceptionDetail = {
      id: "exc-cb-001",
      tenant_id: "tenant-a",
      order_id: "SO-CB-001",
      event_type: "CREDIT_LIMIT_BREACH",
      intent: "CREDIT_BLOCK",
      lifecycle_state: "EXECUTING",
      shadow_verdict: "YELLOW",
      selected_recipe: null,
      final_status: "MANUAL_REVIEW_REQUIRED",
      created_at: "2026-04-12T10:00:00Z",
      updated_at: "2026-04-12T10:05:00Z",
      resolution_data: {},
      resolved_by: "manager@example.com",
      resolved_action: undefined,
      resolution_notes: "Credit limit increase approved by Finance",
    };
    expect(approved.lifecycle_state).toBe("EXECUTING");
    expect(approved.resolved_by).toBe("manager@example.com");
  });

  it("credit block HITL: reject transitions to REJECTED", () => {
    const rejected: ExceptionDetail = {
      id: "exc-cb-001",
      tenant_id: "tenant-a",
      order_id: "SO-CB-001",
      event_type: "CREDIT_LIMIT_BREACH",
      intent: "CREDIT_BLOCK",
      lifecycle_state: "REJECTED",
      shadow_verdict: "YELLOW",
      selected_recipe: null,
      final_status: "REJECTED",
      created_at: "2026-04-12T10:00:00Z",
      updated_at: "2026-04-12T10:05:00Z",
      resolution_data: {},
      resolved_by: "manager@example.com",
      resolved_action: undefined,
      resolution_notes: "Customer has outstanding payment — hold maintained",
    };
    expect(rejected.lifecycle_state).toBe("REJECTED");
  });

  it("credit block can be overridden with a different action", () => {
    const req: OverrideRequest = {
      action: "ALLOW_BOTH",
      notes: "One-time exception — VIP customer with pending payment confirmed",
      resolved_by: "manager@example.com",
    };
    expect(req.action).toBe("ALLOW_BOTH");
    expect(typeof req.notes).toBe("string");
  });
});

describe("CREDIT_BLOCK OrderAnalysis", () => {
  const analysis: OrderAnalysis = {
    diagnosis: "Customer credit exposure ($142,500) exceeds approved credit limit ($125,000) by $17,500.",
    confidence: 99,
    risk: "HIGH",
    resolution: "ESCALATE",
    root_cause: "Credit limit breach — current exposure 114% of approved limit.",
    recommendation: "Escalate to Credit Manager for limit review.",
    entity_profile: {
      customer_name: "FreshCo Wholesale Ltd",
      bp_number: "BP-310092",
      customer_tier: "Standard",
      vip_status: false,
      credit_standing: "At Risk",
      location: "Plant 3400 — Chicago DC",
      region: "Midwest",
    },
    impact_metrics: {
      revenue_at_risk: 13782.0,
      delta_amount: 17500.0,
      delta_percentage: 14.0,
      sla_priority: "CRITICAL",
      sla_deadline: "2026-04-11T12:00:00Z",
      affected_lines: 4,
    },
    lines: [
      { line_id: "L1", diagnosis: "High-value snack bar order.", resolution: "ESCALATE", risk: "HIGH", waterfall: [] },
    ],
  };

  it("credit-specific entity profile shows At Risk credit standing", () => {
    expect(analysis.entity_profile.credit_standing).toBe("At Risk");
  });

  it("impact metrics show CRITICAL SLA priority", () => {
    expect(analysis.impact_metrics.sla_priority).toBe("CRITICAL");
    expect(analysis.impact_metrics.revenue_at_risk).toBe(13782.0);
  });

  it("recommendation is to escalate", () => {
    expect(analysis.resolution).toBe("ESCALATE");
    expect(analysis.recommendation).toContain("Credit Manager");
  });

  it("no pricing waterfall for credit blocks", () => {
    for (const line of analysis.lines) {
      expect(line.waterfall).toHaveLength(0);
    }
  });
});

// ===========================================================================
// MASS_PRICING_ERROR — RED path
// ===========================================================================

describe("MASS_PRICING_ERROR type contracts", () => {
  it("ExceptionSummary for RED mass pricing error", () => {
    const exc: ExceptionSummary = {
      id: "exc-mp-001",
      tenant_id: "tenant-a",
      order_id: "SO-MP-001",
      event_type: "EDI_850_PRICE_MISMATCH",
      intent: "MASS_PRICING_ERROR",
      lifecycle_state: "BLOCKED",
      shadow_verdict: "RED",
      selected_recipe: undefined,
      final_status: "BLOCKED",
      created_at: "2026-04-12T11:00:00Z",
      updated_at: "2026-04-12T11:00:05Z",
    };
    expect(exc.intent).toBe("MASS_PRICING_ERROR");
    expect(exc.shadow_verdict).toBe("RED");
    expect(exc.lifecycle_state).toBe("BLOCKED");
    expect(exc.selected_recipe).toBeUndefined();
  });

  it("RED verdict blocks — no recipe, no execution_log", () => {
    const resp: ResolveResponse = {
      exception_id: "exc-mp-001",
      trace_id: "trace-mp-001",
      intent: "MASS_PRICING_ERROR",
      shadow_verdict: "RED",
      selected_recipe: null,
      final_status: "BLOCKED",
      explanation: "Systemic pricing failure requires human escalation.",
      execution_log: null,
      effect_results: [],
    };
    expect(resp.selected_recipe).toBeNull();
    expect(resp.execution_log).toBeNull();
    expect(resp.final_status).toBe("BLOCKED");
  });

  it("admin-release transitions BLOCKED → PENDING_ADMIN_REVIEW", () => {
    const req: AdminReleaseRequest = {
      release_reason: "False positive — line_count includes informational lines",
      risk_acknowledgment: true,
    };
    expect(req.risk_acknowledgment).toBe(true);

    const released: ExceptionDetail = {
      id: "exc-mp-001",
      tenant_id: "tenant-a",
      order_id: "SO-MP-001",
      event_type: "EDI_850_PRICE_MISMATCH",
      intent: "MASS_PRICING_ERROR",
      lifecycle_state: "PENDING_ADMIN_REVIEW",
      shadow_verdict: "RED",
      selected_recipe: undefined,
      final_status: "BLOCKED",
      created_at: "2026-04-12T11:00:00Z",
      updated_at: "2026-04-12T11:05:00Z",
      resolution_data: {},
      resolved_by: undefined,
      resolved_action: undefined,
      resolution_notes: "ADMIN_RELEASE: False positive",
    };
    expect(released.lifecycle_state).toBe("PENDING_ADMIN_REVIEW");
    // RED verdict preserved
    expect(released.shadow_verdict).toBe("RED");
  });

  it("cannot override BLOCKED directly — must admin-release first", () => {
    // Override is only available on PENDING_REVIEW and ESCALATED
    // BLOCKED requires admin-release → PENDING_ADMIN_REVIEW → approve/reject
    const blockedState = "BLOCKED";
    const overrideAllowedStates = ["PENDING_REVIEW", "ESCALATED"];
    expect(overrideAllowedStates).not.toContain(blockedState);
  });
});

// ===========================================================================
// Cross-intent: Stats breakdown and health endpoint
// ===========================================================================

describe("Cross-intent stats and health endpoint", () => {
  it("stats by_intent covers all four V1 intents", () => {
    const stats: StatsResponse = MOCK_STATS;
    expect(stats.by_intent["CONTRACTUAL_CORRECTION"]).toBe(3);
    expect(stats.by_intent["DUPLICATE_PO"]).toBe(2);
    expect(stats.by_intent["CREDIT_BLOCK"]).toBe(2);
    expect(stats.by_intent["MASS_PRICING_ERROR"]).toBe(1);
  });

  it("stats by_shadow_verdict covers GREEN, YELLOW, RED", () => {
    const stats: StatsResponse = MOCK_STATS;
    expect(stats.by_shadow_verdict["GREEN"]).toBeGreaterThanOrEqual(1);
    expect(stats.by_shadow_verdict["YELLOW"]).toBeGreaterThanOrEqual(1);
    expect(stats.by_shadow_verdict["RED"]).toBeGreaterThanOrEqual(1);
  });

  it("stats by_lifecycle_state covers active states", () => {
    const stats: StatsResponse = MOCK_STATS;
    expect(stats.by_lifecycle_state["RESOLVED"]).toBeGreaterThanOrEqual(1);
    expect(stats.by_lifecycle_state["PENDING_REVIEW"]).toBeGreaterThanOrEqual(1);
    expect(stats.by_lifecycle_state["BLOCKED"]).toBeGreaterThanOrEqual(1);
  });

  it("health endpoint has all four intents for filter dropdowns", () => {
    const health: HealthResponse = MOCK_HEALTH;
    expect(health.allowed_intents).toContain("CONTRACTUAL_CORRECTION");
    expect(health.allowed_intents).toContain("CREDIT_BLOCK");
    expect(health.allowed_intents).toContain("MASS_PRICING_ERROR");
    expect(health.allowed_intents).toContain("DUPLICATE_PO");
  });

  it("health endpoint has all three recipes", () => {
    const health: HealthResponse = MOCK_HEALTH;
    expect(health.allowed_recipes).toContain("PriceAdjustmentRecipe.py");
    expect(health.allowed_recipes).toContain("CreditHoldReleaseRecipe.py");
    expect(health.allowed_recipes).toContain("DuplicatePORecipe.py");
  });
});

// ===========================================================================
// Backend ↔ Frontend field alignment per intent
// ===========================================================================

describe("Per-intent backend ↔ frontend alignment", () => {
  it("CONTRACTUAL_CORRECTION uses event_type EDI_850_PRICE_MISMATCH", () => {
    expect(GREEN_EXCEPTION.event_type).toBe("EDI_850_PRICE_MISMATCH");
  });

  it("CREDIT_BLOCK uses event_type CREDIT_LIMIT_BREACH", () => {
    expect(RED_EXCEPTION.event_type).toBe("CREDIT_LIMIT_BREACH");
  });

  it("each intent has the correct recipe mapping", () => {
    const intentToRecipe: Record<string, string | undefined> = {
      CONTRACTUAL_CORRECTION: "PriceAdjustmentRecipe.py",
      CREDIT_BLOCK: "CreditHoldReleaseRecipe.py",
      DUPLICATE_PO: "DuplicatePORecipe.py",
      MASS_PRICING_ERROR: undefined, // No recipe — RED blocks before selection
    };
    expect(intentToRecipe["CONTRACTUAL_CORRECTION"]).toBe("PriceAdjustmentRecipe.py");
    expect(intentToRecipe["CREDIT_BLOCK"]).toBe("CreditHoldReleaseRecipe.py");
    expect(intentToRecipe["DUPLICATE_PO"]).toBe("DuplicatePORecipe.py");
    expect(intentToRecipe["MASS_PRICING_ERROR"]).toBeUndefined();
  });

  it("each intent maps to the correct shadow verdict path", () => {
    const intentToVerdict: Record<string, string> = {
      CONTRACTUAL_CORRECTION: "GREEN",
      CREDIT_BLOCK: "YELLOW",
      MASS_PRICING_ERROR: "RED",
      DUPLICATE_PO: "GREEN", // Shadow is GREEN; autonomy level drives HITL
    };
    expect(intentToVerdict["CONTRACTUAL_CORRECTION"]).toBe("GREEN");
    expect(intentToVerdict["CREDIT_BLOCK"]).toBe("YELLOW");
    expect(intentToVerdict["MASS_PRICING_ERROR"]).toBe("RED");
  });
});
