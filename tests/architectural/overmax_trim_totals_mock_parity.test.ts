/**
 * Mock-data lock — OverMax trim totals mirror the backend model_validator.
 *
 * asoe2 `api/schemas.py::OverMaxAnalysisData._compute_trim_totals` makes
 * `trimmed_total` / `delta_total` the server-authoritative sum of the trim
 * plan (so the UI never derives audit totals with a client-side reduce —
 * Guardrail #6). Per CLAUDE.md test strategy, a mock-data change carrying a
 * field a backend validator computes needs a lock that mirrors the invariant,
 * so the UI mock layer can't drift from the contract.
 */
import { describe, it, expect } from "vitest";
import { MOCK_ORDER_ANALYSES } from "@/lib/mock-data/order-analyses";

describe("OverMax mock trim totals mirror the backend validator", () => {
  const entries = Object.entries(MOCK_ORDER_ANALYSES).filter(
    ([, a]) => a.overmax_analysis,
  );

  it("covers at least one OverMax fixture", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const [id, analysis] of entries) {
    it(`${id}: trimmed_total / delta_total equal the trim_plan sums`, () => {
      const om = analysis.overmax_analysis!;
      const expectedTrimmed = om.trim_plan.reduce((s, l) => s + l.trimmed_to, 0);
      const expectedDelta = om.trim_plan.reduce((s, l) => s + l.delta, 0);
      expect(om.trimmed_total).toBe(expectedTrimmed);
      expect(om.delta_total).toBe(expectedDelta);
    });
  }
});
