/**
 * formatCaseId / formatSupergroupCode tests — PO direction
 * 2026-05-28: strip internal mock + taxonomy prefixes at display
 * without changing the underlying identifiers (URL routing,
 * audit-log refs, WS invalidation all still use the full id).
 */
import { describe, expect, it } from "vitest";

import { formatCaseId, formatSupergroupCode } from "@/lib/cases";

describe("formatCaseId", () => {
  it("strips the `case-for-` prefix", () => {
    expect(formatCaseId("case-for-EML-CMP-2026-0062")).toBe(
      "EML-CMP-2026-0062",
    );
  });

  it("strips the `case-multi-` prefix", () => {
    expect(formatCaseId("case-multi-WMT-Q1RESET")).toBe("WMT-Q1RESET");
  });

  it("passes ids without known prefixes unchanged", () => {
    expect(formatCaseId("EML-CMP-2026-0062")).toBe("EML-CMP-2026-0062");
  });

  it("returns empty string for null / undefined / empty", () => {
    expect(formatCaseId(null)).toBe("");
    expect(formatCaseId(undefined)).toBe("");
    expect(formatCaseId("")).toBe("");
  });

  it("does not strip a non-matching `case-` prefix", () => {
    // Only `case-for-` and `case-multi-` are stripped — any other
    // `case-foo-` id passes through to avoid accidental data loss.
    expect(formatCaseId("case-id-something")).toBe("case-id-something");
  });
});

describe("formatSupergroupCode", () => {
  it("resolves the governed supergroup label", () => {
    expect(formatSupergroupCode("SG_NEW_ORDER")).toBe("New Order");
  });

  it("uses the governed label, not naive title-casing (ADR-045)", () => {
    // The governed label diverges from a naive SG_-strip + title-case:
    // "Pricing Block" not "Block Pricing". This is the cross-surface
    // consistency fix — the queue chip now matches the detail vocabulary.
    expect(formatSupergroupCode("SG_BLOCK_PRICING")).toBe("Pricing Block");
    expect(formatSupergroupCode("SG_ORDER_STATUS_INQUIRY")).toBe(
      "Order Status Inquiry",
    );
  });

  it("title-cases an unsynced code without an SG_ prefix as a fallback", () => {
    expect(formatSupergroupCode("NEW_ORDER")).toBe("New Order");
  });

  it("returns empty string for null / undefined / empty", () => {
    expect(formatSupergroupCode(null)).toBe("");
    expect(formatSupergroupCode(undefined)).toBe("");
    expect(formatSupergroupCode("")).toBe("");
  });
});
