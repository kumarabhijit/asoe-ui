/**
 * PO_8842 spatial evidence geometry — a verbatim MIRROR of the backend's
 * recorded document-extraction fixture
 * `asoe2/tests/fixtures/gateway/document_extraction/PO_8842.recorded.json`
 * (model `recorded-doctr-v0`, ADR-045).
 *
 * These are the SAME bounding boxes the real `DocumentExtractionGateway`
 * SELECTS from the OCR candidate set and the runtime verifier
 * (`verify_anchor_geometry`) confirms — so the mock preview shows the SAME
 * spatial highlights an operator sees against the live backend. This is the
 * codebase's standing "mock mirrors backend" contract (the same way
 * `tests/browser/attachment-evidence.spec.ts` mirrors `SE_EMAIL`/`SE_ENTITIES`);
 * it is NOT invented geometry — Phase-2 spatial anchors are backend-authoritative
 * (ADR-045 §2), and the mock only replays the recorded extraction.
 *
 * `bbox` is `[x0, y0, x1, y1]` normalised to the page with a top-left origin
 * (0..1) — exactly the shape `spatialOverlays` (src/lib/spatialOverlay.ts)
 * consumes to position the canvas overlay rectangles.
 *
 * Parity is locked by tests/lib/po8842_spatial_mirror.test.ts; if the backend
 * fixture changes, that lock fails until this mirror is updated in lock-step.
 */

export interface Po8842SpatialField {
  /** Evidence ref the anchor binds to (mirrors the recorded fixture). */
  supports_ref: string;
  /** Verbatim span the OCR candidate carried — must appear in the rendered
   *  document text for the runtime verifier (and the safety bar) to LOCATE it. */
  text: string;
  label: string;
  /** 1-based page index. */
  page: number;
  /** [x0, y0, x1, y1], normalised 0..1, top-left origin. */
  bbox: [number, number, number, number];
  confidence: number;
}

/** The attachment these boxes were extracted from. */
export const PO_8842_ATTACHMENT_NAME = "PO_8842.pdf";

/** Content address of the frozen rendition the geometry was computed on
 *  (ADR-044 §2.5) — mirrors the recorded fixture's `sha256`. */
export const PO_8842_SOURCE_SHA256 =
  "f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1";

/** Frozen-rendition basis the geometry binds to (ADR-044 §2.5). The recorded
 *  replay is deterministic, so a stable synthetic hash stands in for the live
 *  renderer's page-render digest. */
export const PO_8842_RENDITION_HASH = "rendition-PO_8842-recorded-doctr-v0";

/** Verbatim mirror of `PO_8842.recorded.json` → `fields[]` joined to their
 *  selected candidate `bbox`/`page`. Order matches the recorded fixture. */
export const PO_8842_SPATIAL_FIELDS: readonly Po8842SpatialField[] = [
  {
    supports_ref: "order_entry.customer_po",
    text: "PO# EML-PO-2026-0042",
    label: "PO number",
    page: 1,
    bbox: [0.08, 0.12, 0.52, 0.16],
    confidence: 0.98,
  },
  {
    supports_ref: "order_entry.ship_to",
    text: "ship to Atlanta DC",
    label: "Ship-to",
    page: 1,
    bbox: [0.08, 0.2, 0.46, 0.24],
    confidence: 0.91,
  },
  {
    supports_ref: "order_entry.requested_date",
    text: "need by May 24",
    label: "Requested date",
    page: 1,
    bbox: [0.08, 0.28, 0.4, 0.32],
    confidence: 0.88,
  },
  {
    supports_ref: "order_entry.material",
    text: "Cola 12pk x 600",
    label: "Material",
    page: 1,
    bbox: [0.08, 0.36, 0.5, 0.4],
    confidence: 0.85,
  },
];

/** The geometry for an evidence ref, if the recorded extraction located it. */
export function po8842FieldByRef(ref: string): Po8842SpatialField | undefined {
  return PO_8842_SPATIAL_FIELDS.find((f) => f.supports_ref === ref);
}

/** True when an attachment name is the PO_8842 document the geometry describes. */
export function isPo8842(name: string | undefined | null): boolean {
  return !!name && /PO_8842\.pdf$/i.test(name);
}
