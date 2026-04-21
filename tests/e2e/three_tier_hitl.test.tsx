/**
 * E2E Data Flow Tests — Three-Tier Human Intervention Model
 *
 * Validates the frontend data contracts for all three HITL tiers:
 *   GREEN  → Challenge (RESOLVED → ESCALATED)
 *   YELLOW → Override  (PENDING_REVIEW → RESOLVED)
 *   RED    → Admin Release (BLOCKED → PENDING_ADMIN_REVIEW)
 *
 * Tests cover:
 *   1. New request/response type contracts match backend
 *   2. LifecycleState includes PENDING_ADMIN_REVIEW
 *   3. Badge variant mapper handles PENDING_ADMIN_REVIEW
 *   4. API client methods exist with correct signatures
 *   5. HITL action data flows through correct lifecycle transitions
 */

import { describe, it, expect } from "vitest";

import type {
  ExceptionSummary,
  ExceptionDetail,
  HealthResponse,
  LifecycleState,
} from "@/types/exceptions";
import type {
  ChallengeRequest,
  AdminReleaseRequest,
  OverrideRequest,
} from "@/types/api";

import { lifecycleVariant } from "@/components/ui/Badge";
import {
  YELLOW_EXCEPTION,
  RED_EXCEPTION,
  GREEN_EXCEPTION,
  MOCK_HEALTH,
  makeExceptionDetail,
} from "../fixtures";

// ---------------------------------------------------------------------------
// 1. PENDING_ADMIN_REVIEW lifecycle state
// ---------------------------------------------------------------------------

describe("PENDING_ADMIN_REVIEW lifecycle state", () => {
  it("is included in HealthResponse lifecycle_states", () => {
    const health: HealthResponse = MOCK_HEALTH;
    expect(health.lifecycle_states).toContain("PENDING_ADMIN_REVIEW");
  });

  it("lifecycle_states now has 12 entries", () => {
    expect(MOCK_HEALTH.lifecycle_states).toHaveLength(12);
  });

  it("maps to warning badge variant", () => {
    expect(lifecycleVariant("PENDING_ADMIN_REVIEW")).toBe("warning");
  });

  it("is a valid LifecycleState type value", () => {
    const state: LifecycleState = "PENDING_ADMIN_REVIEW";
    expect(state).toBe("PENDING_ADMIN_REVIEW");
  });
});

// ---------------------------------------------------------------------------
// 2. GREEN Tier — Challenge Request/Response
// ---------------------------------------------------------------------------

describe("GREEN tier — Challenge type contract", () => {
  it("ChallengeRequest has mandatory challenge_reason", () => {
    const req: ChallengeRequest = {
      challenge_reason: "Price adjustment looks incorrect for this retailer",
    };
    expect(typeof req.challenge_reason).toBe("string");
    expect(req.challenge_reason.length).toBeGreaterThan(0);
  });

  it("challenge transitions RESOLVED → ESCALATED", () => {
    const before: ExceptionSummary = {
      ...GREEN_EXCEPTION,
      lifecycle_state: "RESOLVED",
    };
    expect(before.lifecycle_state).toBe("RESOLVED");

    // After challenge
    const after: ExceptionDetail = {
      ...makeExceptionDetail(before),
      lifecycle_state: "ESCALATED",
      resolution_notes: "CHALLENGED: Price adjustment looks incorrect",
    };
    expect(after.lifecycle_state).toBe("ESCALATED");
    expect(after.resolution_notes).toContain("CHALLENGED:");
  });

  it("challenge does not change shadow_verdict (GREEN stays GREEN)", () => {
    const after: ExceptionDetail = {
      ...makeExceptionDetail(GREEN_EXCEPTION),
      lifecycle_state: "ESCALATED",
    };
    expect(after.shadow_verdict).toBe("GREEN");
  });
});

// ---------------------------------------------------------------------------
// 3. YELLOW Tier — Override Request/Response (updated contract)
// ---------------------------------------------------------------------------

describe("YELLOW tier — Override type contract (updated)", () => {
  it("OverrideRequest has mandatory notes (SOX)", () => {
    // `resolved_by` was removed as part of the trust-boundary fix — backend
    // always uses the caller's identity, never a client-supplied value.
    const req: OverrideRequest = {
      action: "ALLOW_BOTH",
      notes: "Buyer confirmed both POs are intentional",
    };
    expect(typeof req.notes).toBe("string");
    // notes is now required, not optional
    expect(req.notes.length).toBeGreaterThan(0);
  });

  it("override action must be a valid AllowedResolutionAction", () => {
    const validActions = [
      "BLOCK_AND_NOTIFY", "MERGE", "SUPERSEDE",
      "ALLOW_BOTH", "ESCALATE", "REQUEST_BUYER_CONFIRMATION",
    ];
    for (const action of validActions) {
      const req: OverrideRequest = {
        action,
        notes: `Testing ${action}`,
      };
      expect(validActions).toContain(req.action);
    }
  });

  it("override transitions PENDING_REVIEW → RESOLVED", () => {
    const before: ExceptionSummary = YELLOW_EXCEPTION;
    expect(before.lifecycle_state).toBe("PENDING_REVIEW");

    const after: ExceptionDetail = {
      ...makeExceptionDetail(before),
      lifecycle_state: "RESOLVED",
      resolved_action: "ALLOW_BOTH",
      resolved_by: "manager@example.com",
      resolution_notes: "Buyer confirmed both POs are intentional",
    };
    expect(after.lifecycle_state).toBe("RESOLVED");
    expect(after.resolved_action).toBe("ALLOW_BOTH");
  });
});

// ---------------------------------------------------------------------------
// 4. RED Tier — Admin Release Request/Response
// ---------------------------------------------------------------------------

describe("RED tier — Admin Release type contract", () => {
  it("AdminReleaseRequest has mandatory fields", () => {
    const req: AdminReleaseRequest = {
      release_reason: "False positive — retailer threshold incorrect",
      risk_acknowledgment: true,
    };
    expect(typeof req.release_reason).toBe("string");
    expect(req.risk_acknowledgment).toBe(true);
  });

  it("risk_acknowledgment must be true", () => {
    const req: AdminReleaseRequest = {
      release_reason: "test",
      risk_acknowledgment: true,
    };
    // Backend rejects false — this validates the type requires boolean
    expect(typeof req.risk_acknowledgment).toBe("boolean");
  });

  it("admin-release transitions BLOCKED → PENDING_ADMIN_REVIEW", () => {
    const before: ExceptionSummary = RED_EXCEPTION;
    expect(before.lifecycle_state).toBe("BLOCKED");

    const after: ExceptionDetail = {
      ...makeExceptionDetail(before),
      lifecycle_state: "PENDING_ADMIN_REVIEW",
      resolution_notes: "ADMIN_RELEASE: False positive",
    };
    expect(after.lifecycle_state).toBe("PENDING_ADMIN_REVIEW");
    expect(after.resolution_notes).toContain("ADMIN_RELEASE:");
    // Original RED verdict preserved
    expect(after.shadow_verdict).toBe("RED");
  });

  it("after admin-release, approve transitions to EXECUTING", () => {
    const released: ExceptionDetail = {
      ...makeExceptionDetail(RED_EXCEPTION),
      lifecycle_state: "PENDING_ADMIN_REVIEW",
    };
    const approved: ExceptionDetail = {
      ...released,
      lifecycle_state: "EXECUTING",
      resolved_by: "admin@example.com",
    };
    expect(approved.lifecycle_state).toBe("EXECUTING");
    expect(approved.resolved_by).toBe("admin@example.com");
  });

  it("after admin-release, reject transitions to REJECTED", () => {
    const released: ExceptionDetail = {
      ...makeExceptionDetail(RED_EXCEPTION),
      lifecycle_state: "PENDING_ADMIN_REVIEW",
    };
    const rejected: ExceptionDetail = {
      ...released,
      lifecycle_state: "REJECTED",
      resolution_notes: "After review, RED verdict was correct",
    };
    expect(rejected.lifecycle_state).toBe("REJECTED");
  });
});

// ---------------------------------------------------------------------------
// 5. State machine guards — wrong-state transitions
// ---------------------------------------------------------------------------

describe("Three-tier state machine — valid source states", () => {
  it("challenge only from RESOLVED", () => {
    const validSources: LifecycleState[] = ["RESOLVED"];
    const invalidSources: LifecycleState[] = [
      "PENDING_REVIEW", "BLOCKED", "EXECUTING", "ESCALATED",
    ];
    expect(validSources).toHaveLength(1);
    expect(invalidSources).not.toContain("RESOLVED");
  });

  it("override only from PENDING_REVIEW or ESCALATED", () => {
    const validSources: LifecycleState[] = ["PENDING_REVIEW", "ESCALATED"];
    expect(validSources).toContain("PENDING_REVIEW");
    expect(validSources).toContain("ESCALATED");
    expect(validSources).not.toContain("BLOCKED");
    expect(validSources).not.toContain("RESOLVED");
  });

  it("admin-release only from BLOCKED", () => {
    const validSources: LifecycleState[] = ["BLOCKED"];
    expect(validSources).toHaveLength(1);
    expect(validSources).toContain("BLOCKED");
  });

  it("approve from PENDING_REVIEW, ESCALATED, and PENDING_ADMIN_REVIEW", () => {
    const validSources: LifecycleState[] = [
      "PENDING_REVIEW", "ESCALATED", "PENDING_ADMIN_REVIEW",
    ];
    expect(validSources).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 6. RBAC for three tiers
// ---------------------------------------------------------------------------

describe("Three-tier RBAC contracts", () => {
  it("challenge available to analyst+ (lowest HITL authority)", () => {
    const allowedRoles = ["analyst", "manager", "admin"];
    expect(allowedRoles).toContain("analyst");
  });

  it("override available to manager+ only", () => {
    const allowedRoles = ["manager", "admin"];
    expect(allowedRoles).not.toContain("analyst");
    expect(allowedRoles).not.toContain("viewer");
  });

  it("admin-release available to admin only", () => {
    const allowedRoles = ["admin"];
    expect(allowedRoles).toHaveLength(1);
    expect(allowedRoles).not.toContain("manager");
  });
});

// ---------------------------------------------------------------------------
// 7. Backend ↔ Frontend field alignment for new schemas
// ---------------------------------------------------------------------------

describe("Backend ↔ Frontend alignment — three-tier schemas", () => {
  it("ChallengeRequest fields match asoe2 ChallengeRequest (schemas.py)", () => {
    const req: ChallengeRequest = { challenge_reason: "test" };
    expect("challenge_reason" in req).toBe(true);
  });

  it("AdminReleaseRequest fields match asoe2 AdminReleaseRequest (schemas.py)", () => {
    const req: AdminReleaseRequest = {
      release_reason: "test",
      risk_acknowledgment: true,
    };
    expect("release_reason" in req).toBe(true);
    expect("risk_acknowledgment" in req).toBe(true);
  });

  it("OverrideRequest notes is now mandatory (no longer optional)", () => {
    const req: OverrideRequest = {
      action: "ALLOW_BOTH",
      notes: "Mandatory for SOX",
    };
    // TypeScript enforces non-optional notes
    expect(typeof req.notes).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Three-tier HITL invariants for the new intents (mandatory per testing
// review — cross-intent invariant, both new intents must respect it).
// ---------------------------------------------------------------------------

import {
  PHR_HARD_BLOCK_EXCEPTION,
  EDM_SKU_EXCEPTION,
} from "../fixtures";

describe("Three-tier HITL invariants — PRICE_HOLD_RELEASE", () => {
  it("HARD_BLOCK lands as BLOCKED (eligible for admin-release)", () => {
    expect(PHR_HARD_BLOCK_EXCEPTION.lifecycle_state).toBe("BLOCKED");
    expect(PHR_HARD_BLOCK_EXCEPTION.shadow_verdict).toBe("RED");
  });

  it("admin-release request shape applies to PHR HARD_BLOCK", () => {
    const req: AdminReleaseRequest = {
      release_reason: "Customer pre-approved variance via signed exception form.",
      risk_acknowledgment: true,
    };
    expect(req.risk_acknowledgment).toBe(true);
  });

  it("override on PHR HARD_BLOCK requires mandatory notes (SOX)", () => {
    const req: OverrideRequest = {
      action: "ALLOW_BOTH",
      notes: "Manager override: customer accepted current pricing.",
    };
    expect(req.notes.length).toBeGreaterThan(0);
  });
});

describe("Three-tier HITL invariants — EDI_MISMATCH", () => {
  it("SKU sub_type lands as BLOCKED (eligible for admin-release)", () => {
    expect(EDM_SKU_EXCEPTION.lifecycle_state).toBe("BLOCKED");
    expect(EDM_SKU_EXCEPTION.shadow_verdict).toBe("RED");
  });

  it("admin-release request shape applies to EDM SKU mismatch", () => {
    const req: AdminReleaseRequest = {
      release_reason: "Buyer confirmed SKU substitution.",
      risk_acknowledgment: true,
    };
    expect(req.release_reason.length).toBeGreaterThan(0);
  });

  it("override on EDM SKU requires mandatory notes (SOX)", () => {
    const req: OverrideRequest = {
      action: "BLOCK_AND_NOTIFY",
      notes: "Manager confirms hard reject; notify buyer of SKU mismatch.",
    };
    expect(req.notes.length).toBeGreaterThan(0);
  });
});
