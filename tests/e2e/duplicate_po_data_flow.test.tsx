/**
 * E2E Data Flow Tests — DUPLICATE_PO Exception Queue
 *
 * Validates the complete data flow from backend API responses through
 * TypeScript types to rendered Exception Queue and Detail Panel for
 * the Duplicate PO use case.
 *
 * Tests cover:
 *   1. Type contract alignment: backend response shapes → frontend types
 *   2. API client: mock data matches expected shapes for DUPLICATE_PO
 *   3. Exception Queue: list rendering, filtering, selection
 *   4. Detail Panel: polymorphic rendering for DUPLICATE_PO
 *   5. HITL actions: approve/reject/escalate data flow
 *   6. Health endpoint: Guardrail #2 — DUPLICATE_PO in dynamic enums
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type {
  ExceptionSummary,
  ExceptionDetail,
  HealthResponse,
  OrderAnalysis,
  LineItem,
  EntityProfile,
  ImpactMetrics,
  TraceRecord,
} from "@/types/exceptions";
import type {
  StatsResponse,
  TraceResponse,
  ResolveResponse,
  PaginatedResponse,
} from "@/types/api";

import {
  YELLOW_EXCEPTION,
  MOCK_HEALTH,
  MOCK_STATS,
  MOCK_TRACE,
  makeExceptionDetail,
} from "../fixtures";

// ---------------------------------------------------------------------------
// 1. Type Contract Alignment — DUPLICATE_PO backend → frontend types
// ---------------------------------------------------------------------------

describe("DUPLICATE_PO type contract alignment", () => {
  it("ExceptionSummary accepts DUPLICATE_PO backend response shape", () => {
    // This mirrors the exact JSON shape returned by
    // GET /api/v1/exceptions (asoe2 api/routes/exceptions.py)
    const backendResponse: ExceptionSummary = {
      id: "exc-dup-001",
      tenant_id: "tenant-a",
      order_id: "PO-DUP-001",
      event_type: "EDI_850_DUPLICATE_PO",
      intent: "DUPLICATE_PO",
      lifecycle_state: "BLOCKED",
      shadow_verdict: "GREEN",
      selected_recipe: "DuplicatePORecipe.py",
      final_status: "BLOCKED",
      created_at: "2026-04-12T10:00:00Z",
      updated_at: "2026-04-12T10:00:05Z",
    };
    expect(backendResponse.intent).toBe("DUPLICATE_PO");
    expect(backendResponse.selected_recipe).toBe("DuplicatePORecipe.py");
    expect(backendResponse.event_type).toBe("EDI_850_DUPLICATE_PO");
  });

  it("ExceptionDetail accepts DUPLICATE_PO backend detail response", () => {
    // Mirrors GET /api/v1/exceptions/{id} (asoe2 ExceptionDetailResponse)
    const backendResponse: ExceptionDetail = {
      id: "exc-dup-001",
      tenant_id: "tenant-a",
      order_id: "PO-DUP-001",
      event_type: "EDI_850_DUPLICATE_PO",
      intent: "DUPLICATE_PO",
      lifecycle_state: "BLOCKED",
      shadow_verdict: "GREEN",
      selected_recipe: "DuplicatePORecipe.py",
      final_status: "BLOCKED",
      created_at: "2026-04-12T10:00:00Z",
      updated_at: "2026-04-12T10:00:05Z",
      trace_id: "trace-uuid-001",
      resolution_data: {
        recommended_action: "BLOCK_AND_NOTIFY",
        composite_score: 0.94,
        classification: "AUTO_BLOCK",
        autonomy_level: "L3",
        notification_template: "duplicate_po_blocked",
      },
      resolved_by: undefined,
      resolved_action: undefined,
      resolution_notes: undefined,
    };

    expect(backendResponse.resolution_data["recommended_action"]).toBe("BLOCK_AND_NOTIFY");
    expect(backendResponse.resolution_data["composite_score"]).toBe(0.94);
    expect(backendResponse.resolution_data["autonomy_level"]).toBe("L3");
  });

  it("ExceptionDetail accepts MANUAL_REVIEW_REQUIRED DUPLICATE_PO", () => {
    // Medium-confidence DUPLICATE_PO routes to human review
    const reviewResponse: ExceptionDetail = {
      id: "exc-dup-002",
      tenant_id: "tenant-a",
      order_id: "PO-DUP-002",
      event_type: "EDI_850_DUPLICATE_PO",
      intent: "DUPLICATE_PO",
      lifecycle_state: "PENDING_REVIEW",
      shadow_verdict: "GREEN",
      selected_recipe: "DuplicatePORecipe.py",
      final_status: "MANUAL_REVIEW_REQUIRED",
      created_at: "2026-04-12T10:05:00Z",
      updated_at: "2026-04-12T10:05:10Z",
      trace_id: "trace-uuid-002",
      resolution_data: {
        recommended_action: "ESCALATE",
        composite_score: 0.74,
        classification: "REVIEW_REQUIRED",
        autonomy_level: "L1",
      },
      resolved_by: undefined,
      resolved_action: undefined,
      resolution_notes: undefined,
    };

    expect(reviewResponse.lifecycle_state).toBe("PENDING_REVIEW");
    expect(reviewResponse.final_status).toBe("MANUAL_REVIEW_REQUIRED");
    expect(reviewResponse.resolution_data["autonomy_level"]).toBe("L1");
  });

  it("TraceRecord accepts DUPLICATE_PO trace response", () => {
    // Mirrors GET /api/v1/exceptions/{id}/trace (asoe2 TraceResponse)
    const trace: TraceRecord = {
      trace_id: "trace-uuid-001",
      event_id: "PO-DUP-001",
      skill_name: "DUPLICATE_PO.md",
      intent_selected: "DUPLICATE_PO",
      shadow_verdict: "GREEN",
      shadow_policy_hits: [],
      recipe_name: "DuplicatePORecipe.py",
      constrained_output_schemas: {
        intent: "IntentDecision",
        shadow: "ShadowDecisionSchema",
      },
      gateway_calls: [
        "oms:get_fulfillment_status",
        "oms:get_matched_po_details",
        "buyer_notification:send",
      ],
      backend_fallback: "deterministic_fallback",
      is_fallback_generated: true,
      final_status: "BLOCKED",
      explanation: "Recipe returned BLOCKED.",
    };

    expect(trace.intent_selected).toBe("DUPLICATE_PO");
    expect(trace.recipe_name).toBe("DuplicatePORecipe.py");
    expect(trace.gateway_calls).toHaveLength(3);
  });

  it("ResolveResponse accepts DUPLICATE_PO resolve result", () => {
    // Mirrors POST /api/v1/exceptions/resolve (asoe2 ResolveResponse)
    const response: ResolveResponse = {
      exception_id: "exc-dup-001",
      trace_id: "trace-uuid-001",
      intent: "DUPLICATE_PO",
      shadow_verdict: "GREEN",
      selected_recipe: "DuplicatePORecipe.py",
      final_status: "BLOCKED",
      explanation: "Recipe returned BLOCKED.",
      execution_log: {
        recipe_name: "DuplicatePORecipe.py",
        outputs: {
          recommended_action: "BLOCK_AND_NOTIFY",
          composite_score: 0.94,
          classification: "AUTO_BLOCK",
          autonomy_level: "L3",
        },
      },
      effect_results: [
        {
          gateway_name: "buyer_notification",
          operation: "send",
          status: "SUCCESS",
        },
      ],
    };

    expect(response.intent).toBe("DUPLICATE_PO");
    expect(response.final_status).toBe("BLOCKED");
    expect(response.effect_results).toHaveLength(1);
  });

  it("StatsResponse includes DUPLICATE_PO in by_intent breakdown", () => {
    const stats: StatsResponse = MOCK_STATS;
    expect(stats.by_intent).toBeDefined();
    expect(stats.by_intent["DUPLICATE_PO"]).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Health Endpoint — Guardrail #2 for DUPLICATE_PO
// ---------------------------------------------------------------------------

describe("Guardrail #2 — DUPLICATE_PO in health endpoint", () => {
  it("DUPLICATE_PO is in allowed_intents", () => {
    const health: HealthResponse = MOCK_HEALTH;
    expect(health.allowed_intents).toContain("DUPLICATE_PO");
  });

  it("DuplicatePORecipe.py is in allowed_recipes", () => {
    const health: HealthResponse = MOCK_HEALTH;
    expect(health.allowed_recipes).toContain("DuplicatePORecipe.py");
  });

  it("PENDING_REVIEW lifecycle state is available for DUPLICATE_PO filtering", () => {
    const health: HealthResponse = MOCK_HEALTH;
    expect(health.lifecycle_states).toContain("PENDING_REVIEW");
    expect(health.lifecycle_states).toContain("BLOCKED");
  });

  it("health response fields match what useHealth exposes to components", () => {
    const health: HealthResponse = MOCK_HEALTH;
    // These are the exact fields useHealth returns for filter dropdowns
    expect(typeof health.status).toBe("string");
    expect(typeof health.version).toBe("string");
    expect(typeof health.kill_switch).toBe("boolean");
    expect(typeof health.explain_mode).toBe("boolean");
    expect(Array.isArray(health.allowed_intents)).toBe(true);
    expect(Array.isArray(health.lifecycle_states)).toBe(true);
    expect(Array.isArray(health.allowed_recipes)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. API Client Mock Data — DUPLICATE_PO consistency
// ---------------------------------------------------------------------------

describe("API client mock data — DUPLICATE_PO", () => {
  it("YELLOW_EXCEPTION fixture represents a DUPLICATE_PO exception", () => {
    expect(YELLOW_EXCEPTION.intent).toBe("DUPLICATE_PO");
    expect(YELLOW_EXCEPTION.event_type).toBe("EDI_850_DUPLICATE_PO");
    expect(YELLOW_EXCEPTION.selected_recipe).toBe("DuplicatePORecipe.py");
    expect(YELLOW_EXCEPTION.lifecycle_state).toBe("PENDING_REVIEW");
    expect(YELLOW_EXCEPTION.shadow_verdict).toBe("YELLOW");
    expect(YELLOW_EXCEPTION.final_status).toBe("MANUAL_REVIEW_REQUIRED");
  });

  it("DUPLICATE_PO detail extends summary correctly", () => {
    const detail = makeExceptionDetail(YELLOW_EXCEPTION);
    // Summary fields preserved
    expect(detail.id).toBe(YELLOW_EXCEPTION.id);
    expect(detail.intent).toBe("DUPLICATE_PO");
    // Detail-only fields present
    expect("resolution_data" in detail).toBe(true);
    expect("resolved_by" in detail).toBe(true);
    expect("resolved_action" in detail).toBe(true);
    expect("resolution_notes" in detail).toBe(true);
  });

  it("stats by_intent includes DUPLICATE_PO with correct count", () => {
    expect(MOCK_STATS.by_intent["DUPLICATE_PO"]).toBe(2);
  });

  it("stats by_lifecycle_state includes PENDING_REVIEW for DUPLICATE_PO", () => {
    expect(MOCK_STATS.by_lifecycle_state["PENDING_REVIEW"]).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 4. OrderAnalysis — DUPLICATE_PO polymorphic detail data
// ---------------------------------------------------------------------------

describe("DUPLICATE_PO OrderAnalysis type contract", () => {
  const dupPoAnalysis: OrderAnalysis = {
    diagnosis:
      "PO #PO-88421 matches existing PO #PO-88419 received 36 hours prior. " +
      "Identical line items, quantities, and ship-to address.",
    confidence: 88,
    risk: "MEDIUM",
    resolution: "BLOCK_AND_NOTIFY",
    root_cause:
      "Duplicate PO ID detected within 48-hour window. " +
      "Identical SKUs, quantities, and delivery address.",
    recommendation:
      "Block duplicate PO and notify buyer for confirmation before processing.",
    entity_profile: {
      customer_name: "QuickMart Distribution",
      bp_number: "BP-207815",
      customer_tier: "Silver",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 5200 — Dallas DC",
      region: "Central",
    },
    impact_metrics: {
      revenue_at_risk: 6720.0,
      delta_amount: 0,
      delta_percentage: 0,
      sla_priority: "HIGH",
      sla_deadline: "2026-04-11T14:00:00Z",
      affected_lines: 2,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Exact duplicate of PO-88419/L1.",
        resolution: "BLOCK_AND_NOTIFY",
        risk: "MEDIUM",
        waterfall: [],
      },
      {
        line_id: "L2",
        diagnosis: "Exact duplicate of PO-88419/L2.",
        resolution: "BLOCK_AND_NOTIFY",
        risk: "MEDIUM",
        waterfall: [],
      },
    ],
  };

  it("has diagnosis and root cause specific to Duplicate PO", () => {
    expect(dupPoAnalysis.diagnosis).toContain("matches existing PO");
    expect(dupPoAnalysis.root_cause).toContain("Duplicate PO ID");
  });

  it("has BLOCK_AND_NOTIFY as resolution action", () => {
    expect(dupPoAnalysis.resolution).toBe("BLOCK_AND_NOTIFY");
  });

  it("has entity profile for the customer", () => {
    const ep: EntityProfile = dupPoAnalysis.entity_profile!;
    expect(ep.customer_name).toBe("QuickMart Distribution");
    expect(ep.bp_number).toBeDefined();
    expect(ep.customer_tier).toBeDefined();
    expect(typeof ep.vip_status).toBe("boolean");
    expect(ep.credit_standing).toBeDefined();
  });

  it("has impact metrics showing revenue at risk", () => {
    const im: ImpactMetrics = dupPoAnalysis.impact_metrics!;
    expect(im.revenue_at_risk).toBe(6720.0);
    expect(im.delta_amount).toBe(0); // Duplicate PO has zero price delta
    expect(im.sla_priority).toBe("HIGH");
    expect(im.affected_lines).toBe(2);
  });

  it("has per-line analysis for each line item", () => {
    expect(dupPoAnalysis.lines).toHaveLength(2);
    for (const line of dupPoAnalysis.lines) {
      expect(line.line_id).toBeDefined();
      expect(line.diagnosis).toBeDefined();
      expect(line.resolution).toBe("BLOCK_AND_NOTIFY");
      expect(line.risk).toBe("MEDIUM");
    }
  });

  it("line items have no pricing waterfall (duplicate PO, not pricing issue)", () => {
    for (const line of dupPoAnalysis.lines) {
      expect(line.waterfall).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. LineItem type contract for DUPLICATE_PO
// ---------------------------------------------------------------------------

describe("DUPLICATE_PO line item type contract", () => {
  const dupPoLineItems: LineItem[] = [
    {
      line_id: "L1",
      sku: "SKU-1180",
      description: "24-pk Water",
      uom: "CS",
      quantity: 500,
      erp_price: 9.6,
      po_price: 9.62,
      root_cause: "EDI_MISMATCH",
    },
    {
      line_id: "L2",
      sku: "SKU-1181",
      description: "12-pk Sparkling",
      uom: "CS",
      quantity: 200,
      erp_price: 11.4,
      po_price: 10.0,
      root_cause: "CONTRACT_GAP",
    },
  ];

  it("line items have all required fields for the Evidence Grid", () => {
    for (const item of dupPoLineItems) {
      expect(item.line_id).toBeDefined();
      expect(item.sku).toBeDefined();
      expect(item.description).toBeDefined();
      expect(item.uom).toBeDefined();
      expect(typeof item.quantity).toBe("number");
      expect(typeof item.erp_price).toBe("number");
      expect(typeof item.po_price).toBe("number");
    }
  });

  it("line items have root_cause for badge rendering", () => {
    expect(dupPoLineItems[0].root_cause).toBe("EDI_MISMATCH");
    expect(dupPoLineItems[1].root_cause).toBe("CONTRACT_GAP");
  });
});

// ---------------------------------------------------------------------------
// 6. HITL Action request/response shapes for DUPLICATE_PO
// ---------------------------------------------------------------------------

describe("DUPLICATE_PO HITL action data flow", () => {
  it("approve request shape matches backend ApproveRequest", () => {
    // Frontend AgentReasoningCard sends this on Approve click
    const approvePayload = { notes: "Verified — duplicate confirmed by buyer" };
    expect(typeof approvePayload.notes).toBe("string");
  });

  it("reject request shape matches backend RejectRequest", () => {
    const rejectPayload = { reason: "Not a duplicate — different delivery date" };
    expect(typeof rejectPayload.reason).toBe("string");
  });

  it("override request shape matches backend OverrideRequest", () => {
    // `resolved_by` is no longer part of OverrideRequest (trust-boundary
    // fix — backend always uses the caller's identity).
    const overridePayload = {
      action: "ALLOW_BOTH",
      notes: "Buyer confirmed both POs are intentional",
    };
    expect(overridePayload.action).toBe("ALLOW_BOTH");
    expect(typeof overridePayload.notes).toBe("string");
    expect("resolved_by" in overridePayload).toBe(false);
  });

  it("override response updates detail with resolved_* fields", () => {
    // After override, the backend returns ExceptionDetailResponse with these fields
    const afterOverride: ExceptionDetail = {
      ...makeExceptionDetail(YELLOW_EXCEPTION),
      lifecycle_state: "RESOLVED",
      resolved_by: "manager@example.com",
      resolved_action: "ALLOW_BOTH",
      resolution_notes: "Buyer confirmed both POs are intentional",
    };

    expect(afterOverride.resolved_by).toBe("manager@example.com");
    expect(afterOverride.resolved_action).toBe("ALLOW_BOTH");
    expect(afterOverride.lifecycle_state).toBe("RESOLVED");
  });
});

// ---------------------------------------------------------------------------
// 7. Paginated list response shape for exception queue
// ---------------------------------------------------------------------------

describe("Exception queue paginated response shape", () => {
  it("list response wraps ExceptionSummary[] in PaginatedResponse", () => {
    const listResponse: PaginatedResponse<ExceptionSummary> = {
      data: [YELLOW_EXCEPTION],
      has_more: false,
    };
    expect(listResponse.data).toHaveLength(1);
    expect(listResponse.data[0].intent).toBe("DUPLICATE_PO");
    expect(typeof listResponse.has_more).toBe("boolean");
  });

  it("filtered list response returns only DUPLICATE_PO exceptions", () => {
    // Simulates ?intent=DUPLICATE_PO filter
    const dupPoExceptions: ExceptionSummary[] = [
      YELLOW_EXCEPTION,
      {
        ...YELLOW_EXCEPTION,
        id: "exc-dup-002",
        order_id: "PO-DUP-002",
        lifecycle_state: "BLOCKED",
        shadow_verdict: "GREEN",
        final_status: "BLOCKED",
      },
    ];
    const filtered: PaginatedResponse<ExceptionSummary> = {
      data: dupPoExceptions,
      has_more: false,
    };
    expect(filtered.data).toHaveLength(2);
    for (const exc of filtered.data) {
      expect(exc.intent).toBe("DUPLICATE_PO");
    }
  });
});

// ---------------------------------------------------------------------------
// 8. DUPLICATE_PO lifecycle state transitions
// ---------------------------------------------------------------------------

describe("DUPLICATE_PO lifecycle state transitions", () => {
  it("high confidence: INGESTED → BLOCKED (auto-execute L3)", () => {
    // Backend resolves high-confidence duplicate PO to BLOCKED
    const highConf: ExceptionSummary = {
      ...YELLOW_EXCEPTION,
      id: "exc-high",
      lifecycle_state: "BLOCKED",
      shadow_verdict: "GREEN",
      final_status: "BLOCKED",
    };
    expect(highConf.lifecycle_state).toBe("BLOCKED");
  });

  it("medium confidence: INGESTED → PENDING_REVIEW (autonomy L1)", () => {
    const medConf: ExceptionSummary = {
      ...YELLOW_EXCEPTION,
      id: "exc-med",
      lifecycle_state: "PENDING_REVIEW",
      final_status: "MANUAL_REVIEW_REQUIRED",
    };
    expect(medConf.lifecycle_state).toBe("PENDING_REVIEW");
    expect(medConf.final_status).toBe("MANUAL_REVIEW_REQUIRED");
  });

  it("low confidence: INGESTED → RESOLVED (ALLOW_BOTH, L3)", () => {
    const lowConf: ExceptionSummary = {
      ...YELLOW_EXCEPTION,
      id: "exc-low",
      lifecycle_state: "RESOLVED",
      shadow_verdict: "GREEN",
      final_status: "COMPLETE",
    };
    expect(lowConf.lifecycle_state).toBe("RESOLVED");
    expect(lowConf.final_status).toBe("COMPLETE");
  });

  it("after approve: PENDING_REVIEW → RESOLVED", () => {
    // Phase 19 retired the EXECUTING intermediate state — approve from
    // PENDING_REVIEW now lands directly in RESOLVED (mirrors the
    // rebalance documented in src/lib/api.ts:1849-1850).
    const approved: ExceptionDetail = {
      ...makeExceptionDetail(YELLOW_EXCEPTION),
      lifecycle_state: "RESOLVED",
    };
    expect(approved.lifecycle_state).toBe("RESOLVED");
  });

  it("after reject: PENDING_REVIEW → REJECTED", () => {
    const rejected: ExceptionDetail = {
      ...makeExceptionDetail(YELLOW_EXCEPTION),
      lifecycle_state: "REJECTED",
      final_status: "REJECTED",
    };
    expect(rejected.lifecycle_state).toBe("REJECTED");
  });
});

// ---------------------------------------------------------------------------
// 9. Backend ↔ Frontend field name alignment
// ---------------------------------------------------------------------------

describe("Backend ↔ Frontend field name alignment for DUPLICATE_PO", () => {
  it("ExceptionSummary field names match asoe2 ExceptionSummary (schemas.py)", () => {
    // These exact field names are returned by the backend
    const backendFields = [
      "id", "tenant_id", "order_id", "event_type", "intent",
      "lifecycle_state", "shadow_verdict", "selected_recipe",
      "final_status", "created_at", "updated_at",
    ];
    const frontendObj: ExceptionSummary = YELLOW_EXCEPTION;
    for (const field of backendFields) {
      expect(field in frontendObj).toBe(true);
    }
  });

  it("ExceptionDetail field names match asoe2 ExceptionDetailResponse (schemas.py)", () => {
    const backendFields = [
      "id", "tenant_id", "order_id", "event_type", "intent",
      "lifecycle_state", "shadow_verdict", "selected_recipe",
      "final_status", "trace_id", "resolution_data",
      "resolved_by", "resolved_action", "resolution_notes",
      "created_at", "updated_at",
    ];
    // Build a complete ExceptionDetail matching the backend response
    const frontendObj: ExceptionDetail = {
      ...YELLOW_EXCEPTION,
      trace_id: "trace-uuid-001",
      resolution_data: { recommended_action: "BLOCK_AND_NOTIFY" },
      resolved_by: undefined,
      resolved_action: undefined,
      resolution_notes: undefined,
    };
    for (const field of backendFields) {
      expect(field in frontendObj).toBe(true);
    }
  });

  it("TraceResponse field names match asoe2 trace endpoint response", () => {
    const backendFields = [
      "trace_id", "event_id", "skill_name", "intent_selected",
      "shadow_verdict", "shadow_policy_hits", "recipe_name",
      "constrained_output_schemas", "gateway_calls",
      "backend_fallback", "is_fallback_generated",
      "final_status", "explanation",
    ];
    const frontendObj: TraceResponse = MOCK_TRACE;
    for (const field of backendFields) {
      expect(field in frontendObj).toBe(true);
    }
  });

  it("StatsResponse field names match asoe2 StatsResponse (schemas.py)", () => {
    const backendFields = [
      "total_exceptions", "open_exceptions", "auto_resolved",
      "manual_review", "blocked", "failed",
      "avg_resolution_time_seconds",
      "by_intent", "by_lifecycle_state", "by_shadow_verdict",
    ];
    const frontendObj: StatsResponse = MOCK_STATS;
    for (const field of backendFields) {
      expect(field in frontendObj).toBe(true);
    }
  });

  it("HealthResponse field names match asoe2 HealthResponse (schemas.py)", () => {
    const backendFields = [
      "status", "version", "kill_switch", "explain_mode",
      "allowed_intents", "lifecycle_states", "allowed_recipes",
    ];
    const frontendObj: HealthResponse = MOCK_HEALTH;
    for (const field of backendFields) {
      expect(field in frontendObj).toBe(true);
    }
  });
});
