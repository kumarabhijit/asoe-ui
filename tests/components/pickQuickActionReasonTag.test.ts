/**
 * Unit tests for `pickQuickActionReasonTag` — the casing-safe resolver
 * for the quick-Approve / quick-Reject reason tag. Encodes the
 * Architect + Compliance + Frontend amendments to the 2026-05-11
 * rollout plan:
 *
 *   * Health offline (null) → returns `null`. Caller MUST disable the
 *     action; no literal "OTHER" fallback is allowed (the literal
 *     would land a tag in the audit log that the user never selected).
 *   * No silent auto-uppercase. The function picks whichever sentinel
 *     the backend actually serves; it never transforms the casing.
 *   * Per-intent vocab is consulted first (curated intents); the
 *     global lowercase legacy pool is only used when the intent has
 *     no curated vocab.
 */
import { describe, it, expect } from "vitest";
import { pickQuickActionReasonTag } from "@/lib/cases";
import type { HealthResponse } from "@/types/exceptions";

function mkHealth(overrides: Partial<HealthResponse>): HealthResponse {
  return {
    status: "ok",
    version: "test",
    kill_switch: false,
    explain_mode: false,
    allowed_intents: [],
    lifecycle_states: [],
    allowed_recipes: [],
    allowed_resolution_actions: [],
    allowed_override_reason_tags: [],
    allowed_override_reason_tags_by_intent: {},
    ...overrides,
  };
}

describe("pickQuickActionReasonTag", () => {
  it("returns null when health is null (offline)", () => {
    expect(pickQuickActionReasonTag("DUPLICATE_PO", null)).toBeNull();
  });

  it("returns null when health is undefined", () => {
    expect(pickQuickActionReasonTag("DUPLICATE_PO", undefined)).toBeNull();
  });

  it("picks UPPERCASE OTHER from a curated per-intent vocab", () => {
    const h = mkHealth({
      allowed_override_reason_tags_by_intent: {
        DUPLICATE_PO: ["INTENTIONAL_REORDER", "AMENDED_PO", "OTHER"],
      },
    });
    expect(pickQuickActionReasonTag("DUPLICATE_PO", h)).toBe("OTHER");
  });

  it("falls back to lowercase 'other' when the pool is the legacy global set", () => {
    const h = mkHealth({
      allowed_override_reason_tags: [
        "customer_concession", "data_error", "other",
      ],
      // No per-intent entry for this intent — falls back to global.
      allowed_override_reason_tags_by_intent: {},
    });
    expect(pickQuickActionReasonTag("UNKNOWN_INTENT", h)).toBe("other");
  });

  it("never silently uppercases a lowercase pool", () => {
    // Compliance amendment: if the backend served only lowercase
    // sentinels, do not synthesise "OTHER" on the wire.
    const h = mkHealth({
      allowed_override_reason_tags_by_intent: {
        LEGACY_INTENT: ["customer_concession", "other"],
      },
    });
    const out = pickQuickActionReasonTag("LEGACY_INTENT", h);
    expect(out).toBe("other");
    // Sanity: definitely not the uppercase variant.
    expect(out).not.toBe("OTHER");
  });

  it("returns null when the pool is empty (backend dropped both sentinels)", () => {
    const h = mkHealth({
      allowed_override_reason_tags_by_intent: { WEIRD_INTENT: [] },
      allowed_override_reason_tags: [],
    });
    expect(pickQuickActionReasonTag("WEIRD_INTENT", h)).toBeNull();
  });

  it("falls back to first pool entry when neither OTHER sentinel is present", () => {
    // Diagnostic-only path; in practice the curated vocab always
    // carries "OTHER". The first-entry fallback exists so the UI does
    // not crash, but it surfaces in code review.
    const h = mkHealth({
      allowed_override_reason_tags_by_intent: {
        ODDBALL: ["FIRST_ENTRY", "SECOND_ENTRY"],
      },
    });
    expect(pickQuickActionReasonTag("ODDBALL", h)).toBe("FIRST_ENTRY");
  });
});
