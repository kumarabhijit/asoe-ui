/**
 * Architectural lock — `attention_state` mock mapping ↔ backend.
 *
 * Council 2026-06-07. The /cases queue groups by the backend-owned
 * `attention_state` disposition. In mock mode `src/lib/api.ts` is the
 * backend stand-in and replicates the SAME deterministic
 * `CaseStatus -> attention_state` mapping the backend uses in
 * `asoe2/api/case_summary.py::_ATTENTION_BY_STATUS`.
 *
 * This is the UI half of the cross-repo lock (the backend half is
 * `asoe2/tests/test_case_summary_attention.py`). If either side drifts,
 * the queue's needs-human grouping diverges between mock-preview and
 * production — exactly the mock-data drift the test-strategy mock-lock
 * rule was written to prevent. Keep the EXPECTED table below
 * byte-for-byte with the backend mapping.
 */
import { describe, expect, it } from "vitest";

import { MOCK_ATTENTION_BY_STATUS } from "@/lib/api";
import { attentionGroup } from "@/lib/cases";

// Mirror of asoe2/api/case_summary.py::_ATTENTION_BY_STATUS — the
// single canonical lifecycle -> disposition policy.
const BACKEND_MAPPING: Record<string, string> = {
  OPEN_AWAITING_HUMAN: "NEEDS_HUMAN",
  FAILED: "NEEDS_HUMAN",
  BLOCKED: "NEEDS_HUMAN",
  OPEN_AGENT_PROCESSING: "IN_FLIGHT",
  OPEN_AWAITING_BUYER: "IN_FLIGHT",
  OPEN_AWAITING_ERP: "IN_FLIGHT",
  RESOLVED: "DONE",
};

describe("attention_state mock mapping ↔ backend", () => {
  it("mock mapping matches the backend mapping exactly", () => {
    expect(MOCK_ATTENTION_BY_STATUS).toEqual(BACKEND_MAPPING);
  });

  it("covers every case lifecycle state", () => {
    // The 7-state CaseStatus union (contracts/models.py::CaseStatus).
    const ALL_STATES = [
      "OPEN_AGENT_PROCESSING",
      "OPEN_AWAITING_HUMAN",
      "OPEN_AWAITING_BUYER",
      "OPEN_AWAITING_ERP",
      "RESOLVED",
      "FAILED",
      "BLOCKED",
    ];
    for (const s of ALL_STATES) {
      expect(MOCK_ATTENTION_BY_STATUS[s]).toBeDefined();
    }
  });
});

describe("attentionGroup() queue grouping", () => {
  it("orders needs-human first, then in-flight, then done", () => {
    const needs = attentionGroup("NEEDS_HUMAN").rank;
    const inflight = attentionGroup("IN_FLIGHT").rank;
    const done = attentionGroup("DONE").rank;
    expect(needs).toBeLessThan(inflight);
    expect(inflight).toBeLessThan(done);
  });

  it("falls back safely for an unknown disposition (no crash)", () => {
    const fallback = attentionGroup("SOME_FUTURE_DISPOSITION");
    expect(fallback.key).toBe("OTHER");
    // Sorts after every known group.
    expect(fallback.rank).toBeGreaterThan(attentionGroup("DONE").rank);
  });

  it("falls back for null/undefined", () => {
    expect(attentionGroup(null).key).toBe("OTHER");
    expect(attentionGroup(undefined).key).toBe("OTHER");
  });
});
