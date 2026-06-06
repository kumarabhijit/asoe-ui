/**
 * anchorForRef (ADR-043 field↔source linking) — pure lookup of the anchor
 * whose backend-authoritative `supports_ref` matches a selected evidence ref.
 */
import { describe, it, expect } from "vitest";
import { anchorForRef } from "@/lib/evidenceAnchor";
import type { EvidenceAnchor } from "@/types/exceptions";

function anchor(ref: string): EvidenceAnchor {
  return {
    attachment_id: "att-1",
    anchor_source: "text_derived",
    text: ref,
    match_key: { normalized_text: ref, occurrence_index: 0 },
    supports_kind: "extracted_field",
    supports_ref: ref,
    label: ref,
    source_sha256: "a".repeat(64),
  };
}

const ANCHORS = [anchor("order_entry.customer_po"), anchor("order_entry.material")];

describe("anchorForRef", () => {
  it("returns the anchor matching the ref", () => {
    expect(anchorForRef(ANCHORS, "order_entry.material")?.supports_ref).toBe(
      "order_entry.material",
    );
  });

  it("returns null for an unknown ref (no UI-side guessing)", () => {
    expect(anchorForRef(ANCHORS, "order_entry.ship_to")).toBeNull();
  });

  it("returns null for a null / undefined ref", () => {
    expect(anchorForRef(ANCHORS, null)).toBeNull();
    expect(anchorForRef(ANCHORS, undefined)).toBeNull();
  });
});
