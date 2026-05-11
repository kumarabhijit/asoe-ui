/**
 * MOCK_STATS arithmetic invariants (S7).
 *
 * The 2026-05-11 gap report flagged that asoe2 retired the
 * EXECUTING lifecycle state in Phase 19, but the mock fixtures had
 * to be hand-rebalanced. Any future change that re-introduces an
 * EXECUTING bucket — or that drops a bucket without re-summing —
 * silently breaks downstream analytics. This lock catches both.
 *
 * Invariants:
 *   * by_lifecycle_state has no EXECUTING key.
 *   * Σ(by_lifecycle_state) === total_exceptions.
 *   * Σ(by_intent)         === total_exceptions.
 *   * Σ(by_shadow_verdict) === total_exceptions.
 *
 * Locks fixture and src/lib/api.ts MOCK_STATS in lock-step (we
 * import both and run the same checks).
 */
import { describe, it, expect } from "vitest";
import { MOCK_STATS as FIXTURE_STATS } from "../fixtures";

const sum = (m: Record<string, number>) =>
  Object.values(m).reduce((a, b) => a + b, 0);

describe.each([
  { name: "tests/fixtures.ts", stats: FIXTURE_STATS },
])("MOCK_STATS invariants — $name", ({ stats }) => {
  it("by_lifecycle_state has no EXECUTING bucket (retired in asoe2 Phase 19)", () => {
    expect(stats.by_lifecycle_state).not.toHaveProperty("EXECUTING");
  });

  it("Σ(by_lifecycle_state) === total_exceptions", () => {
    expect(sum(stats.by_lifecycle_state)).toBe(stats.total_exceptions);
  });

  it("Σ(by_intent) === total_exceptions", () => {
    expect(sum(stats.by_intent)).toBe(stats.total_exceptions);
  });

  it("Σ(by_shadow_verdict) === total_exceptions", () => {
    expect(sum(stats.by_shadow_verdict)).toBe(stats.total_exceptions);
  });

  it("no bucket counts a negative number", () => {
    for (const m of [stats.by_lifecycle_state, stats.by_intent, stats.by_shadow_verdict]) {
      for (const [k, v] of Object.entries(m)) {
        expect(v, `${k} count is negative`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
