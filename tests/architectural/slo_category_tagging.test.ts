/**
 * Every scenario in tests/scenarios/ must declare an `slo_category`.
 * Encoded as an architectural lock so the SRE amendment to the
 * 2026-05-11 rollout plan (tag every scenario for CI filtering and
 * Grafana `tests_scenario_failed_total{slo_category}` cardinality)
 * is enforceable at build time.
 *
 * Values:
 *   * p99_blocker  — runs on every PR.
 *   * p95_blocker  — runs on every PR.
 *   * background   — gated to nightly (RUN_FULL_MATRIX=1).
 */
import { describe, it, expect } from "vitest";
import { SCENARIOS } from "../scenarios";

const VALID = new Set(["p99_blocker", "p95_blocker", "background"]);

describe("tests/scenarios/ — slo_category tagging", () => {
  it("at least one scenario exists", () => {
    expect(SCENARIOS.length).toBeGreaterThan(0);
  });

  it.each(SCENARIOS)("$id declares a valid slo_category", (s) => {
    expect(VALID.has(s.slo_category)).toBe(true);
  });

  it("at least one scenario is tagged p99_blocker (PR-blocking floor)", () => {
    const p99 = SCENARIOS.filter((s) => s.slo_category === "p99_blocker");
    expect(p99.length).toBeGreaterThan(0);
  });

  it("scenario ids follow <INTENT>__<operator_situation> shape (Domain SME amendment)", () => {
    for (const s of SCENARIOS) {
      expect(
        s.id,
        `scenario "${s.id}" does not match <INTENT>__<operator_situation>`,
      ).toMatch(/^[A-Z][A-Z0-9_]+__[a-z][a-z0-9_]+$/);
    }
  });

  it("intent in id matches the intent field (no drift)", () => {
    for (const s of SCENARIOS) {
      const prefix = s.id.split("__")[0];
      expect(
        prefix,
        `scenario "${s.id}" intent prefix doesn't match s.intent (${s.intent})`,
      ).toBe(s.intent);
    }
  });
});
