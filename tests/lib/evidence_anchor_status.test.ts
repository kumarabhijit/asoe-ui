/**
 * CP-D unit — the safety-bar verifier (ADR-043 §2.3). LOCATED only on exactly
 * one match; UNLOCATED on zero or when no document text is available (shown as
 * loudly as a hit); AMBIGUOUS on repeated tokens.
 */
import { describe, it, expect } from "vitest";
import { normalizeMatchText, resolveAnchorStatus } from "@/lib/evidenceAnchor";
import type { EvidenceAnchor } from "@/types/exceptions";

function anchor(normalized: string): EvidenceAnchor {
  return {
    attachment_id: "att-1",
    anchor_source: "text_derived",
    text: normalized,
    match_key: { normalized_text: normalized, occurrence_index: 0 },
    supports_kind: "extracted_field",
    supports_ref: "order_entry.po_number",
    label: "PO number",
    source_sha256: "a".repeat(64),
  };
}

describe("resolveAnchorStatus", () => {
  it("UNLOCATED when there is no document text (position unconfirmed)", () => {
    expect(resolveAnchorStatus(null, anchor("po-2026-0042"))).toBe("unlocated");
  });

  it("LOCATED on exactly one occurrence", () => {
    expect(resolveAnchorStatus("Order PO-2026-0042 ship to DC", anchor("po-2026-0042"))).toBe("located");
  });

  it("UNLOCATED on zero occurrences (shown, never silent)", () => {
    expect(resolveAnchorStatus("nothing relevant here", anchor("po-2026-0042"))).toBe("unlocated");
  });

  it("AMBIGUOUS on repeated tokens", () => {
    expect(
      resolveAnchorStatus("PO-2026-0042 ... again PO-2026-0042", anchor("po-2026-0042")),
    ).toBe("ambiguous");
  });
});

describe("normalizeMatchText", () => {
  it("collapses whitespace and lower-cases", () => {
    expect(normalizeMatchText("  PO\t 12345 \n")).toBe("po 12345");
  });
});
