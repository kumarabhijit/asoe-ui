/**
 * Spatial bbox overlay geometry (ADR-045 P2.10) — pure, deterministic.
 *
 * Turns backend-authoritative VERIFIED spatial anchors (anchor_source ===
 * "spatial_extracted", with page + bbox) into percent-based overlay rectangles
 * positioned over the PDF.js canvas. The overlay is a best-effort convenience;
 * the text-derived safety bar remains the authoritative surface (ADR-043 §2.3),
 * so a missing/degraded anchor simply has no box — never a wrong one.
 *
 * bbox is [x0, y0, x1, y1] normalised to the page (0..1, top-left origin), so
 * the rect is expressed as CSS percentages of the rendered canvas box.
 */

import type { EvidenceAnchor } from "@/types/exceptions";

export interface SpatialOverlay {
  supportsRef: string;
  label: string;
  /** CSS percentages (0..100) relative to the rendered page box. */
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

function isValidBbox(bbox: number[] | null | undefined): bbox is number[] {
  return (
    Array.isArray(bbox) &&
    bbox.length === 4 &&
    bbox.every((n) => typeof n === "number" && n >= 0 && n <= 1) &&
    bbox[2] > bbox[0] &&
    bbox[3] > bbox[1]
  );
}

/** Overlay rects for the VERIFIED spatial anchors on `page` (1-based). Anchors
 *  that are text-derived, on another page, or carry an invalid bbox are skipped
 *  — they fall back to the safety bar, never a misplaced box. */
export function spatialOverlays(
  anchors: EvidenceAnchor[],
  page: number,
): SpatialOverlay[] {
  const out: SpatialOverlay[] = [];
  for (const a of anchors) {
    if (a.anchor_source !== "spatial_extracted") continue;
    if (a.page !== page) continue;
    if (!isValidBbox(a.bbox)) continue;
    const [x0, y0, x1, y1] = a.bbox;
    out.push({
      supportsRef: a.supports_ref,
      label: a.label,
      leftPct: x0 * 100,
      topPct: y0 * 100,
      widthPct: (x1 - x0) * 100,
      heightPct: (y1 - y0) * 100,
    });
  }
  return out;
}
