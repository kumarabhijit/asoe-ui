/**
 * ADR-045 P2.10 — spatialOverlays() geometry. Pure function: VERIFIED spatial
 * anchors on the rendered page become percent rects; everything else (text
 * anchors, other pages, invalid boxes) is skipped so the safety bar stays the
 * authoritative fallback.
 */
import { describe, it, expect } from "vitest";

import { spatialOverlays } from "@/lib/spatialOverlay";
import type { EvidenceAnchor } from "@/types/exceptions";

function anchor(overrides: Partial<EvidenceAnchor>): EvidenceAnchor {
  return {
    attachment_id: "att-1",
    anchor_source: "spatial_extracted",
    text: "PO# EML-PO-2026-0042",
    match_key: { normalized_text: "po# eml-po-2026-0042", occurrence_index: 0 },
    supports_kind: "extracted_field",
    supports_ref: "order_entry.customer_po",
    label: "PO number",
    source_sha256: "a".repeat(64),
    page: 1,
    bbox: [0.1, 0.2, 0.5, 0.3],
    confidence: 0.97,
    rendition_hash: "rh-1",
    ...overrides,
  };
}

describe("spatialOverlays", () => {
  it("maps a verified spatial anchor on the page to a percent rect", () => {
    const out = spatialOverlays([anchor({})], 1);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      supportsRef: "order_entry.customer_po",
      label: "PO number",
      leftPct: 10,
      topPct: 20,
      widthPct: 40,
      heightPct: expect.closeTo(10, 5),
    });
  });

  it("skips text-derived anchors (no geometry to draw)", () => {
    const text = anchor({ anchor_source: "text_derived", page: null, bbox: null, confidence: null, rendition_hash: null });
    expect(spatialOverlays([text], 1)).toEqual([]);
  });

  it("skips anchors on a different page", () => {
    expect(spatialOverlays([anchor({ page: 2 })], 1)).toEqual([]);
  });

  it("skips invalid / degenerate boxes", () => {
    expect(spatialOverlays([anchor({ bbox: [0.5, 0.5, 0.4, 0.6] })], 1)).toEqual([]); // x1<x0
    expect(spatialOverlays([anchor({ bbox: [0.1, 0.1, 1.2, 0.3] })], 1)).toEqual([]); // out of range
    expect(spatialOverlays([anchor({ bbox: null })], 1)).toEqual([]);
  });
});
