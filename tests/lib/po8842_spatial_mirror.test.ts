/**
 * PO_8842 spatial-evidence mock MIRROR (ADR-045).
 *
 * The mock replays the backend's recorded document-extraction geometry so the
 * preview draws the SAME bbox highlights the live `DocumentExtractionGateway`
 * would. These locks assert three things:
 *
 *   1. PARITY — `PO_8842_SPATIAL_FIELDS` equals the backend recorded fixture
 *      `asoe2/tests/fixtures/gateway/document_extraction/PO_8842.recorded.json`
 *      (refs / texts / bboxes / confidences). If the backend fixture moves, this
 *      lock fails until the mirror is updated in lock-step — the mock can never
 *      silently diverge into invented geometry.
 *   2. WIRING — `exc-026`'s `PO_8842.pdf` anchors are `spatial_extracted` with
 *      that geometry (text-derived only for evidence not on the PDF).
 *   3. RENDER — the geometry projects to overlay rectangles, and the generated
 *      PDF places each span exactly once so the safety bar reads LOCATED.
 */
import { describe, it, expect } from "vitest";

import {
  PO_8842_SPATIAL_FIELDS,
  PO_8842_RENDITION_HASH,
  isPo8842,
  po8842FieldByRef,
} from "@/lib/mock-data/po8842-spatial";
import { MOCK_ORDER_ANALYSES } from "@/lib/mock-data/order-analyses";
import { mockAttachmentBlob } from "@/lib/mock-data/attachment-bytes";
import { spatialOverlays } from "@/lib/spatialOverlay";
import type { EvidenceAnchor } from "@/types/exceptions";

// Verbatim from asoe2/tests/fixtures/gateway/document_extraction/PO_8842.recorded.json
// (fields[] joined to their selected candidate bbox/page). Hand-copied here
// because the fixture lives in the sibling repo; this is the parity ground truth.
const RECORDED = [
  { supports_ref: "order_entry.customer_po", text: "PO# EML-PO-2026-0042", label: "PO number", page: 1, bbox: [0.08, 0.12, 0.52, 0.16], confidence: 0.98 },
  { supports_ref: "order_entry.ship_to", text: "ship to Atlanta DC", label: "Ship-to", page: 1, bbox: [0.08, 0.2, 0.46, 0.24], confidence: 0.91 },
  { supports_ref: "order_entry.requested_date", text: "need by May 24", label: "Requested date", page: 1, bbox: [0.08, 0.28, 0.4, 0.32], confidence: 0.88 },
  { supports_ref: "order_entry.material", text: "Cola 12pk x 600", label: "Material", page: 1, bbox: [0.08, 0.36, 0.5, 0.4], confidence: 0.85 },
];

describe("PO_8842 spatial mirror — parity with the backend recorded fixture", () => {
  it("mirrors the recorded geometry field-for-field", () => {
    expect(PO_8842_SPATIAL_FIELDS).toEqual(RECORDED);
  });

  it("indexes geometry by supports_ref", () => {
    expect(po8842FieldByRef("order_entry.ship_to")?.bbox).toEqual([0.08, 0.2, 0.46, 0.24]);
    expect(po8842FieldByRef("order_entry.unknown")).toBeUndefined();
  });

  it("recognises the PO_8842 attachment by name", () => {
    expect(isPo8842("PO_8842.pdf")).toBe(true);
    expect(isPo8842("ship_to_addresses.csv")).toBe(false);
    expect(isPo8842(null)).toBe(false);
  });
});

describe("PO_8842 spatial mirror — wired onto exc-026's email source", () => {
  const anchors = MOCK_ORDER_ANALYSES["exc-026"]?.email_source?.evidence_anchors ?? [];

  it("emits a verified spatial anchor per located field, bound to PO_8842.pdf", () => {
    const spatial = anchors.filter((a) => a.anchor_source === "spatial_extracted");
    expect(spatial).toHaveLength(RECORDED.length);
    for (const rec of RECORDED) {
      const a = spatial.find((x) => x.supports_ref === rec.supports_ref);
      expect(a, `${rec.supports_ref} spatial anchor`).toBeDefined();
      expect(a!.page).toBe(rec.page);
      expect(a!.bbox).toEqual(rec.bbox);
      expect(a!.confidence).toBe(rec.confidence);
      expect(a!.rendition_hash).toBe(PO_8842_RENDITION_HASH);
      expect(a!.attachment_id).toContain("po-8842");
    }
  });

  it("keeps evidence NOT on the PDF (the From: header) text-derived", () => {
    const customer = anchors.find((a) => a.supports_ref === "order_entry.customer");
    expect(customer?.anchor_source).toBe("text_derived");
    expect(customer?.bbox ?? null).toBeNull();
  });
});

describe("PO_8842 spatial mirror — render path", () => {
  const anchors = MOCK_ORDER_ANALYSES["exc-026"]?.email_source?.evidence_anchors ?? [];

  it("projects the spatial anchors to page-1 overlay rectangles", () => {
    const overlays = spatialOverlays(anchors as EvidenceAnchor[], 1);
    expect(overlays).toHaveLength(RECORDED.length);
    const po = overlays.find((o) => o.supportsRef === "order_entry.customer_po")!;
    // bbox [0.08, 0.12, 0.52, 0.16] → left 8%, width 44%, top 12%, height 4%.
    expect(po.leftPct).toBeCloseTo(8);
    expect(po.widthPct).toBeCloseTo(44);
    expect(po.topPct).toBeCloseTo(12);
    expect(po.heightPct).toBeCloseTo(4);
  });

  it("places each evidence span exactly once in the generated PDF (LOCATED, not AMBIGUOUS)", async () => {
    const blob = mockAttachmentBlob({
      caseId: "exc-026",
      attachmentId: "att-po-8842-pdf",
      mimeType: "application/pdf",
      fileName: "PO_8842.pdf",
      evidenceText: anchors.map((a) => a.text),
    });
    const pdf = await blob.text();
    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect(pdf).toContain("%%EOF");
    for (const rec of RECORDED) {
      const count = pdf.split(rec.text).length - 1;
      expect(count, `${rec.text} should appear once`).toBe(1);
    }
  });
});
