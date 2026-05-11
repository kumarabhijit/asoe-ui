/**
 * CSA one-task flow — PO ratified, currently deferred.
 *
 * Captures the gap that issue #133 + ADR-034 §6.1 leave on `/cases/[id]`:
 * the case-detail surface is read-only today, so the CSA's "one task
 * end-to-end" workflow (PO ratification) is fragmented into two or
 * three clicks. See docs/test-strategy/csa-one-task-tracking.md for
 * the un-skip acceptance criteria.
 *
 * This is a skip-test by design (rollout plan row S2, PO amendment).
 * It exists so the gap is searchable in CI output and the un-skip is
 * a one-line change once CaseDetailPanel mounts the action ribbon.
 *
 * Searchable handle: csa-one-task — `grep -rn csa-one-task` returns
 * this file and the tracking doc.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const CASE_DETAIL_PANEL = path.resolve(
  __dirname,
  "../../src/app/cases/CaseDetailPanel.tsx",
);

describe("CSA one-task flow (deferred, PO-tracked)", () => {
  // csa-one-task: when this skip is removed, CaseDetailPanel must
  // mount the action ribbon and the body below becomes a green
  // assertion. The acceptance criteria live in
  // docs/test-strategy/csa-one-task-tracking.md.
  it.skip("CaseDetailPanel exposes Approve / Reject / Override / Escalate / Reanalyze", () => {
    const src = readFileSync(CASE_DETAIL_PANEL, "utf-8");
    // The action ribbon today lives in HeaderRibbon.tsx and is
    // composed by ExceptionDetailPanel. Mounting it on the case
    // surface is the un-skip step.
    expect(src).toMatch(/HeaderRibbon\b/);
    expect(src).toMatch(/useExceptionActions\b/);
    // Five action handlers must be wired (cosign is a banner, not
    // a ribbon button, so it's checked separately).
    for (const handler of [
      "handleApprove",
      "handleReject",
      "handleOverride",
      "handleEscalate",
      "handleReanalyze",
    ]) {
      expect(src, `${handler} not wired into CaseDetailPanel`).toMatch(
        new RegExp(`\\b${handler}\\b`),
      );
    }
  });

  // Companion lock that runs today: confirms the gap is real. If
  // someone wires the ribbon ahead of un-skipping the test above,
  // THIS assertion will start failing — which is the cue to flip
  // the .skip in the same PR.
  it("regression guard — gap still present (CaseDetailPanel has no action handlers yet)", () => {
    const src = readFileSync(CASE_DETAIL_PANEL, "utf-8");
    expect(
      src.match(/\bhandleApprove\b|\bhandleReject\b|\bhandleOverride\b|\bhandleEscalate\b|\bhandleReanalyze\b/),
      "CaseDetailPanel started wiring action handlers — flip the it.skip above and update " +
      "docs/test-strategy/csa-one-task-tracking.md",
    ).toBeNull();
  });
});
