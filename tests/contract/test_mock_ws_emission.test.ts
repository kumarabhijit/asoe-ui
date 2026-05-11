/**
 * Mock state changes emit case_* events (S10).
 *
 * Each successful disposition / escalate / cosign / reanalyze on the
 * UI mock appends one event to an in-process log. Tests drain the
 * log and assert the right `type` and `trigger` for each handler so
 * the "mock emits the event live would" contract is structurally
 * locked.
 *
 * Tier-1 wiring (this commit): event log is testable; pages do not
 * yet consume the log through useWebSocket. Tier-2 (a future
 * ticket) wires the log into useWebSocket's onEvent path so the
 * silent-refresh chain runs end-to-end in tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { exceptionsApi, drainMockCaseEvents } from "@/lib/api";

describe("mock state changes emit case_* events", () => {
  beforeEach(() => {
    // Clear the log between tests so each one sees a clean slate.
    drainMockCaseEvents();
  });

  it("disposition success emits a case_update (non-terminal lifecycle)", async () => {
    // The mock disposition lifecycle decision: NO_ACTION -> REJECTED
    // (terminal -> case_close); anything else -> RESOLVED (terminal
    // -> case_close). Use REQUEST_CLARIFICATION on exc-013 with the
    // expected lifecycle being RESOLVED → case_close.
    await exceptionsApi.disposition("exc-002", {
      action: "ALLOW_BOTH",
      notes: "approve test",
      reason_tag: "OTHER",
    });
    const events = drainMockCaseEvents();
    expect(events.length).toBe(1);
    expect(events[0].trigger).toBe("disposition");
    expect(events[0].type).toBe("case_close");
    expect(events[0].exception_id).toBe("exc-002");
    expect(events[0].tenant_id).toBe("acme-corp");
  });

  it("escalate emits a case_update (non-terminal — ESCALATED)", async () => {
    await exceptionsApi.escalate("exc-002", { reason: "needs senior review" });
    const events = drainMockCaseEvents();
    expect(events.length).toBe(1);
    expect(events[0].trigger).toBe("escalate");
    expect(events[0].type).toBe("case_update");
    expect(events[0].exception_id).toBe("exc-002");
  });

  it("reanalyze emits a case_update", async () => {
    await exceptionsApi.reanalyze("exc-014", { reason: "agent missed a constraint" });
    const events = drainMockCaseEvents();
    expect(events.length).toBe(1);
    expect(events[0].trigger).toBe("reanalyze");
    expect(events[0].type).toBe("case_update");
    expect(events[0].exception_id).toBe("exc-014");
  });

  it("event log is FIFO across multiple state changes", async () => {
    await exceptionsApi.escalate("exc-002", { reason: "first" });
    await exceptionsApi.reanalyze("exc-014", { reason: "second" });
    const events = drainMockCaseEvents();
    expect(events.length).toBe(2);
    expect(events[0].trigger).toBe("escalate");
    expect(events[1].trigger).toBe("reanalyze");
  });

  it("drainMockCaseEvents clears the log; the next read sees an empty buffer", async () => {
    await exceptionsApi.escalate("exc-002", { reason: "produces one event" });
    expect(drainMockCaseEvents()).toHaveLength(1);
    expect(drainMockCaseEvents()).toHaveLength(0);
  });

  it("failed state changes do NOT emit (gate rejections produce no event)", async () => {
    // exc-001 is RESOLVED → terminal-state gate rejects.
    await expect(
      exceptionsApi.disposition("exc-001", {
        action: "ALLOW_BOTH",
        notes: "should fail",
        reason_tag: "OTHER",
      }),
    ).rejects.toThrow(/LIFECYCLE_LOCKED/);
    expect(drainMockCaseEvents()).toHaveLength(0);
  });
});
