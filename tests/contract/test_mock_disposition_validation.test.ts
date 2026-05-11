/**
 * Mock disposition handler — reason_tag validation parity (S8).
 *
 * Mirrors asoe2/tests/test_override_escalate.py invariants on the UI
 * mock side so that:
 *
 *   * a curated-intent record rejects lowercase legacy tags;
 *   * a curated-intent record accepts the curated UPPERCASE tag;
 *   * non-curated intents fall through to the legacy global pool
 *     for write — covers the "intent missing or unknown" branch
 *     of asoe2::is_valid_reason_tag_for_write;
 *   * the read-side helper grandfathers legacy lowercase tags so
 *     historical audit-log rows still render.
 *
 * No silent auto-uppercase (Compliance amendment).
 */
import { describe, it, expect } from "vitest";
import {
  exceptionsApi,
  isValidReasonTagForWrite,
  isValidReasonTagForRead,
} from "@/lib/api";

describe("isValidReasonTagForWrite — curated intent", () => {
  it("rejects lowercase legacy tag for curated intent", () => {
    expect(isValidReasonTagForWrite("DUPLICATE_PO", "other")).toBe(false);
    expect(isValidReasonTagForWrite("DUPLICATE_PO", "customer_concession")).toBe(false);
  });

  it("accepts the curated UPPERCASE OTHER sentinel", () => {
    expect(isValidReasonTagForWrite("DUPLICATE_PO", "OTHER")).toBe(true);
  });

  it("accepts a curated UPPERCASE per-intent tag", () => {
    expect(isValidReasonTagForWrite("DUPLICATE_PO", "INTENTIONAL_REORDER")).toBe(true);
    expect(isValidReasonTagForWrite("MANUAL_ORDER_INTAKE", "EXTRACTION_LOW_CONFIDENCE")).toBe(true);
  });

  it("rejects a curated tag that belongs to a different intent", () => {
    // INTENTIONAL_REORDER is DUPLICATE_PO; not valid for BACK_ORDER.
    expect(isValidReasonTagForWrite("BACK_ORDER", "INTENTIONAL_REORDER")).toBe(false);
  });
});

describe("isValidReasonTagForWrite — non-curated / unknown intent", () => {
  it("falls back to the legacy global pool when intent is missing", () => {
    expect(isValidReasonTagForWrite(undefined, "other")).toBe(true);
    expect(isValidReasonTagForWrite(null, "customer_concession")).toBe(true);
  });

  it("falls back to the global pool when intent is unknown", () => {
    expect(isValidReasonTagForWrite("MADE_UP_INTENT", "other")).toBe(true);
    expect(isValidReasonTagForWrite("MADE_UP_INTENT", "INTENTIONAL_REORDER")).toBe(false);
  });
});

describe("isValidReasonTagForRead — grandfathered audit-log rows", () => {
  it("accepts legacy lowercase tags from historical writes", () => {
    expect(isValidReasonTagForRead("other")).toBe(true);
    expect(isValidReasonTagForRead("customer_concession")).toBe(true);
    expect(isValidReasonTagForRead("agent_misclassification")).toBe(true);
  });

  it("accepts curated UPPERCASE tags from post-2026-05-10 writes", () => {
    expect(isValidReasonTagForRead("OTHER")).toBe(true);
    expect(isValidReasonTagForRead("INTENTIONAL_REORDER")).toBe(true);
  });

  it("rejects a fully unknown tag — never accept arbitrary strings", () => {
    expect(isValidReasonTagForRead("garbage_string_not_in_any_pool")).toBe(false);
  });
});

describe("mock disposition handler — rejects invalid reason_tag", () => {
  // exc-002 is DUPLICATE_PO in MOCK_EXCEPTIONS.
  it("422-equivalent error on lowercase reason_tag for curated intent", async () => {
    await expect(
      exceptionsApi.disposition("exc-002", {
        action: "ALLOW_BOTH",
        notes: "should fail",
        reason_tag: "other",
      }),
    ).rejects.toThrow(/INVALID_REASON_TAG/);
  });

  it("succeeds with the curated UPPERCASE OTHER sentinel", async () => {
    const r = await exceptionsApi.disposition("exc-002", {
      action: "ALLOW_BOTH",
      notes: "valid uppercase tag",
      reason_tag: "OTHER",
    });
    // Mock returns an updated detail; sanity-check the resolution
    // metadata is present.
    expect(r.resolved_action).toBe("ALLOW_BOTH");
    expect(r.resolution_notes).toBe("valid uppercase tag");
  });

  it("does NOT silently auto-uppercase — payload is rejected verbatim", async () => {
    // If the mock had auto-uppercased, this would succeed. The
    // Compliance amendment forbids that path.
    await expect(
      exceptionsApi.disposition("exc-002", {
        action: "ALLOW_BOTH",
        notes: "should fail (auto-uppercase forbidden)",
        reason_tag: "intentional_reorder",
      }),
    ).rejects.toThrow(/INVALID_REASON_TAG/);
  });
});
