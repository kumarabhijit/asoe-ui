/**
 * useConditionalField — predicate evaluation tests.
 *
 * The hook wraps the pure `predicateHolds` function via useMemo; the
 * predicate logic itself is what matters. These tests exercise the
 * two supported shapes and the fail-closed default for anything
 * unrecognised.
 */

import { describe, it, expect } from "vitest";
import { predicateHolds } from "@/hooks/useConditionalField";

describe("predicateHolds", () => {
  describe("resolved_action == <VALUE>", () => {
    it("returns true when the resolved action matches exactly", () => {
      expect(predicateHolds("resolved_action == ALT_DC", "ALT_DC")).toBe(true);
    });

    it("returns false when the resolved action differs", () => {
      expect(predicateHolds("resolved_action == ALT_DC", "SUBSTITUTE")).toBe(false);
    });

    it("returns false when resolved_action is null", () => {
      expect(predicateHolds("resolved_action == ALT_DC", null)).toBe(false);
    });

    it("tolerates extra whitespace", () => {
      expect(predicateHolds("resolved_action ==   ALT_DC  ", "ALT_DC")).toBe(true);
    });
  });

  describe("resolved_action in [<list>]", () => {
    it("returns true when action is in the list", () => {
      expect(
        predicateHolds(
          "resolved_action in [ALT_DC, SUBSTITUTE]",
          "SUBSTITUTE",
        ),
      ).toBe(true);
    });

    it("returns false when action is outside the list", () => {
      expect(
        predicateHolds(
          "resolved_action in [ALT_DC, SUBSTITUTE]",
          "RESCHEDULE",
        ),
      ).toBe(false);
    });

    it("tolerates quoted values (registry-authored text)", () => {
      expect(
        predicateHolds(
          "resolved_action in ['ALT_DC', 'SUBSTITUTE']",
          "ALT_DC",
        ),
      ).toBe(true);
    });

    it("returns false for null resolved action", () => {
      expect(predicateHolds("resolved_action in [ALT_DC]", null)).toBe(false);
    });
  });

  describe("fail-closed default", () => {
    it("returns false for unknown predicate shapes", () => {
      // Registry authored an unsupported predicate — we'd rather
      // hide the field than show partial/stale data.
      expect(
        predicateHolds("variance_pct > 0.05", "ALT_DC"),
      ).toBe(false);
    });

    it("returns false for empty predicate", () => {
      expect(predicateHolds("", "ALT_DC")).toBe(false);
    });
  });
});
