/**
 * Unit tests for the canonical confidence model (src/lib/confidence.ts).
 *
 * Locks the scale-reconciliation contract (0–1 vs 0–100) and the visual
 * band stops so the cross-case ConfidenceDisplay behaves identically for
 * every producer.
 */
import { describe, it, expect } from "vitest";
import {
  toCanonicalConfidence,
  confidenceBand,
  confidencePct,
  BAND_HIGH_MIN,
  BAND_REVIEW_MIN,
} from "@/lib/confidence";

describe("toCanonicalConfidence", () => {
  it("passes through unit-scale values unchanged", () => {
    expect(toCanonicalConfidence(0.87, "unit")).toBeCloseTo(0.87);
    expect(toCanonicalConfidence(0, "unit")).toBe(0);
    expect(toCanonicalConfidence(1, "unit")).toBe(1);
  });

  it("divides percent-scale values by 100", () => {
    expect(toCanonicalConfidence(87, "percent")).toBeCloseTo(0.87);
    expect(toCanonicalConfidence(100, "percent")).toBe(1);
  });

  it("defaults to unit scale", () => {
    expect(toCanonicalConfidence(0.5)).toBe(0.5);
  });

  it("clamps out-of-range values into [0, 1]", () => {
    expect(toCanonicalConfidence(1.4, "unit")).toBe(1);
    expect(toCanonicalConfidence(-0.2, "unit")).toBe(0);
    expect(toCanonicalConfidence(140, "percent")).toBe(1);
    expect(toCanonicalConfidence(-5, "percent")).toBe(0);
  });

  it("treats NaN as the most cautious value (0)", () => {
    expect(toCanonicalConfidence(Number.NaN, "unit")).toBe(0);
    expect(toCanonicalConfidence(Number.NaN, "percent")).toBe(0);
  });
});

describe("confidenceBand", () => {
  it("maps the high band at and above the high stop", () => {
    expect(confidenceBand(BAND_HIGH_MIN)).toBe("high");
    expect(confidenceBand(0.95)).toBe("high");
    expect(confidenceBand(1)).toBe("high");
  });

  it("maps the review band between the two stops", () => {
    expect(confidenceBand(BAND_REVIEW_MIN)).toBe("review");
    expect(confidenceBand(0.79)).toBe("review");
  });

  it("default-falls-back to the low band below the review stop", () => {
    expect(confidenceBand(0.49)).toBe("low");
    expect(confidenceBand(0)).toBe("low");
  });
});

describe("confidencePct", () => {
  it("rounds canonical to integer percent", () => {
    expect(confidencePct(0.871)).toBe(87);
    expect(confidencePct(0.875)).toBe(88);
    expect(confidencePct(1)).toBe(100);
    expect(confidencePct(0)).toBe(0);
  });
});
