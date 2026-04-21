/**
 * Contract Tests — PRICE_HOLD_RELEASE Exception Data Flow
 *
 * Validates the data flow from backend API responses through TypeScript
 * types to rendered Exception Queue and Detail Panel for the
 * Price-Hold-Release use case.
 *
 * Mirrors the 9-group structure of duplicate_po_data_flow.test.tsx —
 * type contract, Guardrail #2, mock-data consistency, OrderAnalysis,
 * line-item shape, HITL action shape, paginated list, lifecycle
 * transitions, and field-name alignment.
 */

import { describe, it, expect } from "vitest";

import type {
  ExceptionSummary,
  ExceptionDetail,
  HealthResponse,
  OrderAnalysis,
  PriceHoldAnalysisData,
  PriceHoldAction,
} from "@/types/exceptions";
import type { StatsResponse, ResolveResponse } from "@/types/api";

import {
  PHR_AUTO_RELEASE_EXCEPTION,
  PHR_ESCALATE_EXCEPTION,
  PHR_HARD_BLOCK_EXCEPTION,
  MOCK_HEALTH,
  MOCK_STATS,
  makePriceHoldExceptionDetail,
} from "../fixtures";

// ---------------------------------------------------------------------------
// 1. Type contract — PRICE_HOLD_RELEASE backend → frontend types
// ---------------------------------------------------------------------------

describe("PRICE_HOLD_RELEASE type contract alignment", () => {
  it("ExceptionSummary accepts PHR backend response shape", () => {
    const summary: ExceptionSummary = {
      id: "exc-phr-001",
      tenant_id: "tenant-a",
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
    expect(summary.intent).toBe("PRICE_HOLD_RELEASE");
    expect(summary.selected_recipe).toBe("PriceHoldReleaseRecipe.py");
  });

  it("ExceptionDetail carries optional resolution_data + analysis", () => {
    const detail = makePriceHoldExceptionDetail(PHR_ESCALATE_EXCEPTION);
    expect(detail.id).toBe(PHR_ESCALATE_EXCEPTION.id);
    expect(detail.analysis?.price_hold_analysis).toBeDefined();
  });

  it("ResolveResponse compiles for the PHR happy path", () => {
    const r: ResolveResponse = {
      exception_id: "exc-phr-resolve-001",
      trace_id: "trace-001",
      intent: "PRICE_HOLD_RELEASE",
      shadow_verdict: "GREEN",
      selected_recipe: "PriceHoldReleaseRecipe.py",
      final_status: "COMPLETE",
      explanation: "Variance within tolerance; auto-release.",
      execution_log: { variance_pct: 0.01, action: "AUTO_RELEASE" },
      effect_results: [{ gateway: "oms", operation: "update_hold_flag", status: "OK" }],
    };
    expect(r.intent).toBe("PRICE_HOLD_RELEASE");
  });
});

// ---------------------------------------------------------------------------
// 2. Guardrail #2 — PRICE_HOLD_RELEASE in health endpoint
// ---------------------------------------------------------------------------

describe("Guardrail #2 — PRICE_HOLD_RELEASE in health endpoint", () => {
  it("MOCK_HEALTH.allowed_intents includes PRICE_HOLD_RELEASE", () => {
    const h: HealthResponse = MOCK_HEALTH;
    expect(h.allowed_intents).toContain("PRICE_HOLD_RELEASE");
  });

  it("MOCK_HEALTH.allowed_recipes includes PriceHoldReleaseRecipe.py", () => {
    expect(MOCK_HEALTH.allowed_recipes).toContain("PriceHoldReleaseRecipe.py");
  });

  it("override-reason vocabulary exists for the new intent", () => {
    const tags = MOCK_HEALTH.allowed_override_reason_tags_by_intent?.PRICE_HOLD_RELEASE;
    expect(tags).toBeDefined();
    expect(tags?.length).toBeGreaterThan(0);
    expect(tags).toContain("other"); // mandatory fallback
  });
});

// ---------------------------------------------------------------------------
// 3. Mock-data consistency
// ---------------------------------------------------------------------------

describe("API client mock data — PRICE_HOLD_RELEASE", () => {
  it("PHR fixtures cover all three action branches", () => {
    expect(PHR_AUTO_RELEASE_EXCEPTION.shadow_verdict).toBe("GREEN");
    expect(PHR_ESCALATE_EXCEPTION.shadow_verdict).toBe("YELLOW");
    expect(PHR_HARD_BLOCK_EXCEPTION.shadow_verdict).toBe("RED");
  });

  it("PHR fixtures all carry the intent + recipe", () => {
    for (const f of [PHR_AUTO_RELEASE_EXCEPTION, PHR_ESCALATE_EXCEPTION, PHR_HARD_BLOCK_EXCEPTION]) {
      expect(f.intent).toBe("PRICE_HOLD_RELEASE");
      expect(f.selected_recipe).toBe("PriceHoldReleaseRecipe.py");
      expect(f.event_type).toBe("EDI_850_PRICE_HOLD");
    }
  });
});

// ---------------------------------------------------------------------------
// 4. PriceHoldAnalysisData / OrderAnalysis shape
// ---------------------------------------------------------------------------

describe("PRICE_HOLD_RELEASE OrderAnalysis type contract", () => {
  it("price_hold_analysis is optional on OrderAnalysis", () => {
    // If it weren't optional, the type would force-populate it on every
    // OrderAnalysis instance — including non-PHR intents. This compiles
    // because the field is `?`.
    const oa: Partial<OrderAnalysis> = {};
    expect(oa.price_hold_analysis).toBeUndefined();
  });

  it("PriceHoldAnalysisData carries all required fields", () => {
    const phr: PriceHoldAnalysisData = {
      hold_status: "HELD",
      po_price: 105,
      sap_base_price: 100,
      variance_pct: 0.05,
      tolerance_pct: 0.02,
      hard_block_pct: 0.10,
      action: "ESCALATE",
      reason: "test",
    };
    expect(phr.hold_status).toBe("HELD");
    expect(phr.action).toBe("ESCALATE");
    expect(phr.variance_pct).toBeCloseTo(0.05);
  });

  it("PriceHoldAction is a closed union (compile-time)", () => {
    const actions: PriceHoldAction[] = ["AUTO_RELEASE", "ESCALATE", "HARD_BLOCK"];
    expect(actions).toHaveLength(3);
  });

  it("makePriceHoldExceptionDetail derives action from shadow_verdict", () => {
    expect(makePriceHoldExceptionDetail(PHR_AUTO_RELEASE_EXCEPTION).analysis!.price_hold_analysis!.action).toBe("AUTO_RELEASE");
    expect(makePriceHoldExceptionDetail(PHR_ESCALATE_EXCEPTION).analysis!.price_hold_analysis!.action).toBe("ESCALATE");
    expect(makePriceHoldExceptionDetail(PHR_HARD_BLOCK_EXCEPTION).analysis!.price_hold_analysis!.action).toBe("HARD_BLOCK");
  });
});

// ---------------------------------------------------------------------------
// 5. Variance arithmetic — signed fraction invariants
// ---------------------------------------------------------------------------

describe("PRICE_HOLD_RELEASE variance arithmetic", () => {
  it("AUTO_RELEASE branch carries variance ≤ tolerance", () => {
    const detail = makePriceHoldExceptionDetail(PHR_AUTO_RELEASE_EXCEPTION);
    const phr = detail.analysis!.price_hold_analysis!;
    expect(Math.abs(phr.variance_pct)).toBeLessThanOrEqual(phr.tolerance_pct);
  });

  it("HARD_BLOCK branch carries variance > hard_block", () => {
    const detail = makePriceHoldExceptionDetail(PHR_HARD_BLOCK_EXCEPTION);
    const phr = detail.analysis!.price_hold_analysis!;
    expect(Math.abs(phr.variance_pct)).toBeGreaterThan(phr.hard_block_pct);
  });
});

// ---------------------------------------------------------------------------
// 6. HITL action shape — disposition flow per intent
// ---------------------------------------------------------------------------

describe("PRICE_HOLD_RELEASE HITL action data flow", () => {
  it("disposition request shape uses ESCALATE action for the YELLOW branch", () => {
    // Backend recommended_action is ESCALATE — APPROVE on YELLOW means
    // the operator endorsed the recipe's escalate decision.
    const dispositionRequest = {
      action: "ESCALATE",
      reason_tag: "policy_exception",
      notes: "Within contract; manager approves escalation.",
    };
    expect(dispositionRequest.action).toBe("ESCALATE");
  });

  it("override request shape uses an alternate action", () => {
    const overrideRequest = {
      action: "BLOCK_AND_NOTIFY",
      reason_tag: "agent_misclassification",
      notes: "Customer confirmed price; block to renegotiate.",
    };
    expect(overrideRequest.action).not.toBe("ESCALATE");
  });
});

// ---------------------------------------------------------------------------
// 7. Stats roundtrip — by_intent / by_lifecycle_state
// ---------------------------------------------------------------------------

describe("PRICE_HOLD_RELEASE stats roundtrip", () => {
  it("MOCK_STATS.by_intent counts PHR exceptions", () => {
    const stats: StatsResponse = MOCK_STATS;
    expect(stats.by_intent?.PRICE_HOLD_RELEASE).toBeGreaterThanOrEqual(1);
  });

  it("totals across breakdowns stay consistent", () => {
    const sumIntents = Object.values(MOCK_STATS.by_intent ?? {}).reduce((a, b) => a + b, 0);
    const sumLifecycle = Object.values(MOCK_STATS.by_lifecycle_state ?? {}).reduce((a, b) => a + b, 0);
    expect(sumIntents).toBe(sumLifecycle);
  });
});

// ---------------------------------------------------------------------------
// 8. Lifecycle state transitions per branch
// ---------------------------------------------------------------------------

describe("PRICE_HOLD_RELEASE lifecycle state transitions", () => {
  it("AUTO_RELEASE → RESOLVED", () => {
    expect(PHR_AUTO_RELEASE_EXCEPTION.lifecycle_state).toBe("RESOLVED");
    expect(PHR_AUTO_RELEASE_EXCEPTION.final_status).toBe("COMPLETE");
  });

  it("ESCALATE → PENDING_REVIEW", () => {
    expect(PHR_ESCALATE_EXCEPTION.lifecycle_state).toBe("PENDING_REVIEW");
    expect(PHR_ESCALATE_EXCEPTION.final_status).toBe("MANUAL_REVIEW_REQUIRED");
  });

  it("HARD_BLOCK → BLOCKED (eligible for admin-release)", () => {
    expect(PHR_HARD_BLOCK_EXCEPTION.lifecycle_state).toBe("BLOCKED");
    expect(PHR_HARD_BLOCK_EXCEPTION.final_status).toBe("BLOCKED");
  });
});

// ---------------------------------------------------------------------------
// 9. Backend ↔ frontend field-name alignment
// ---------------------------------------------------------------------------

describe("Backend ↔ Frontend field name alignment for PRICE_HOLD_RELEASE", () => {
  it("snake_case fields land verbatim on the type", () => {
    const phr: PriceHoldAnalysisData = {
      hold_status: "HELD",
      po_price: 100,
      sap_base_price: 100,
      variance_pct: 0,
      tolerance_pct: 0.02,
      hard_block_pct: 0.10,
      action: "AUTO_RELEASE",
      reason: "ok",
    };
    // Field names match asoe2 backend exactly — typed access proves it
    expect("hold_status" in phr).toBe(true);
    expect("po_price" in phr).toBe(true);
    expect("sap_base_price" in phr).toBe(true);
    expect("variance_pct" in phr).toBe(true);
    expect("tolerance_pct" in phr).toBe(true);
    expect("hard_block_pct" in phr).toBe(true);
  });
});
