/**
 * textLayerBoxes (ADR-043 Phase 1.5) — best-effort highlight geometry for
 * text-derived anchors, derived from the PDF.js text layer.
 *
 * Regression context (bug report 2026-06-11): text-derived anchors — notably
 * the email-content evidence (From: header) — were verified by the safety bar
 * but drew NO in-document highlight; only spatial anchors had boxes. These
 * tests pin the derivation rules: unique located match → box; ambiguous /
 * unlocated / geometry-less → no box, never a wrong one.
 */
import { describe, it, expect } from "vitest";

import { textLayerBoxes, type TextItemGeometry } from "@/lib/textLayerHighlight";
import type { EvidenceAnchor } from "@/types/exceptions";

const PAGE = { width: 612, height: 792 };

function anchor(over: Partial<EvidenceAnchor> = {}): EvidenceAnchor {
  return {
    attachment_id: "att-1",
    anchor_source: "text_derived",
    text: "From: buyer@southeast-distrib.example",
    match_key: {
      normalized_text: "from: buyer@southeast-distrib.example",
      occurrence_index: 0,
    },
    supports_kind: "extracted_field",
    supports_ref: "order_entry.customer",
    label: "Customer",
    source_sha256: "a".repeat(64),
    ...over,
  } as EvidenceAnchor;
}

/** A 12pt run at baseline (x, y). */
function item(str: string, x: number, y: number, width: number): TextItemGeometry {
  return { str, transform: [12, 0, 0, 12, x, y], width, height: 12 };
}

describe("textLayerBoxes", () => {
  it("derives a box for a text-derived anchor that uniquely locates on the page", () => {
    const items = [
      item("PURCHASE ORDER", 64, 736, 140),
      item("From: buyer@southeast-distrib.example", 64, 380, 260),
    ];
    const doc = "PURCHASE ORDER From: buyer@southeast-distrib.example";
    const boxes = textLayerBoxes(items, PAGE, doc, [anchor()]);
    expect(boxes).toHaveLength(1);
    const b = boxes[0];
    expect(b.supportsRef).toBe("order_entry.customer");
    // x: 64/612 ≈ 10.46%; width: 260/612 ≈ 42.48%.
    expect(b.leftPct).toBeCloseTo((64 / 612) * 100, 1);
    expect(b.widthPct).toBeCloseTo((260 / 612) * 100, 1);
    // The box must cover the glyph band around the baseline (y=380).
    const topY = 792 - (792 * b.topPct) / 100;
    const bottomY = topY - (792 * b.heightPct) / 100;
    expect(topY).toBeGreaterThan(380);
    expect(bottomY).toBeLessThan(380);
  });

  it("spans multiple adjacent runs when the needle crosses item boundaries", () => {
    const items = [
      item("ship to", 64, 500, 50),
      item("Atlanta DC", 118, 500, 70),
    ];
    const doc = "ship to Atlanta DC";
    const a = anchor({
      text: "ship to Atlanta DC",
      match_key: { normalized_text: "ship to atlanta dc", occurrence_index: 0 },
      supports_ref: "order_entry.ship_to",
      label: "Ship-to",
    });
    const boxes = textLayerBoxes(items, PAGE, doc, [a]);
    expect(boxes).toHaveLength(1);
    // Union spans from the first run's left edge to the second's right edge.
    expect(boxes[0].leftPct).toBeCloseTo((64 / 612) * 100, 1);
    expect(boxes[0].widthPct).toBeCloseTo(((118 + 70 - 64) / 612) * 100, 1);
  });

  it("draws nothing for an anchor that is UNLOCATED in the document", () => {
    const items = [item("unrelated content", 64, 700, 120)];
    const boxes = textLayerBoxes(items, PAGE, "unrelated content", [anchor()]);
    expect(boxes).toEqual([]);
  });

  it("draws nothing for an AMBIGUOUS anchor (multiple matches)", () => {
    const needleText = "From: buyer@southeast-distrib.example";
    const items = [
      item(needleText, 64, 700, 260),
      item(needleText, 64, 600, 260),
    ];
    const doc = `${needleText} ${needleText}`;
    const boxes = textLayerBoxes(items, PAGE, doc, [anchor()]);
    expect(boxes).toEqual([]);
  });

  it("draws nothing when located in the doc but NOT on the previewed page", () => {
    // Page 1 lacks the text; the doc-level text (page 2) contains it once.
    const items = [item("page one content", 64, 700, 120)];
    const doc = "page one content From: buyer@southeast-distrib.example";
    const boxes = textLayerBoxes(items, PAGE, doc, [anchor()]);
    expect(boxes).toEqual([]);
  });

  it("skips spatial anchors — their backend-recorded bbox is authoritative", () => {
    const items = [item("From: buyer@southeast-distrib.example", 64, 380, 260)];
    const doc = "From: buyer@southeast-distrib.example";
    const spatial = anchor({
      anchor_source: "spatial_extracted",
      page: 1,
      bbox: [0.1, 0.2, 0.5, 0.3],
      confidence: 0.97,
      rendition_hash: "rh-1",
    });
    expect(textLayerBoxes(items, PAGE, doc, [spatial])).toEqual([]);
  });

  it("degrades to no box when items carry no geometry (older extractors)", () => {
    const items: TextItemGeometry[] = [
      { str: "From: buyer@southeast-distrib.example" },
    ];
    const doc = "From: buyer@southeast-distrib.example";
    expect(textLayerBoxes(items, PAGE, doc, [anchor()])).toEqual([]);
  });

  it("slices proportionally when the needle is inside a longer run", () => {
    const items = [
      item("Header From: buyer@southeast-distrib.example trailing", 100, 400, 500),
    ];
    const doc = "Header From: buyer@southeast-distrib.example trailing";
    const boxes = textLayerBoxes(items, PAGE, doc, [anchor()]);
    expect(boxes).toHaveLength(1);
    // The slice must start after the run's left edge and end before its right
    // edge (proportional interior match), never cover the whole run.
    expect(boxes[0].leftPct).toBeGreaterThan((100 / 612) * 100);
    expect(boxes[0].leftPct + boxes[0].widthPct).toBeLessThan(((100 + 500) / 612) * 100);
  });
});
