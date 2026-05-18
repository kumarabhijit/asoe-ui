/**
 * Case-status projection lock (caseFromMockException).
 *
 * `caseFromMockException` projects an exception's `lifecycle_state`
 * onto the parent `OrderCase.status`. This lock pins the mapping —
 * and in particular that a REJECTED child counts as SETTLED
 * (-> RESOLVED), not as a child still awaiting a human.
 *
 * A NO_ACTION disposition (sub_type REJECT in asoe2) stamps
 * `resolved_by` and audits EXCEPTION_RESOLVED — it is a completed
 * human decision. The projection mirrors asoe2
 * `api/case_resolver.py::_case_status_from_lifecycle` 1:1 so the
 * mock-preview layer and the live backend agree.
 */
import { describe, it, expect } from "vitest";

import { caseFromMockException } from "@/lib/mock-data/cases";
import type { ExceptionSummary } from "@/types/exceptions";

import { GREEN_EXCEPTION } from "../fixtures";

function withLifecycle(lifecycle_state: string): ExceptionSummary {
  return { ...GREEN_EXCEPTION, lifecycle_state } as ExceptionSummary;
}

describe("caseFromMockException — case-status projection", () => {
  it.each([
    ["RESOLVED", "RESOLVED"],
    ["CLOSED", "RESOLVED"],
    ["REJECTED", "RESOLVED"],
    ["BLOCKED", "BLOCKED"],
    ["FAILED", "FAILED"],
    ["PENDING_REVIEW", "OPEN_AWAITING_HUMAN"],
    ["ESCALATED", "OPEN_AWAITING_HUMAN"],
    ["PENDING_COSIGN", "OPEN_AWAITING_HUMAN"],
  ])("lifecycle %s projects to case status %s", (lifecycle, expected) => {
    expect(caseFromMockException(withLifecycle(lifecycle)).status).toBe(
      expected,
    );
  });

  it("a REJECTED child closes the case, it does not hold it open", () => {
    // Regression: REJECTED previously fell through to the default
    // branch -> OPEN_AWAITING_HUMAN, leaving a rejected case stuck in
    // the operator queue with closed_at unstamped. A NO_ACTION
    // disposition is a completed human decision — the case closes.
    const c = caseFromMockException(withLifecycle("REJECTED"));
    expect(c.status).toBe("RESOLVED");
    expect(c.closed_at).not.toBeNull();
  });
});
