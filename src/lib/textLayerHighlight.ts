/**
 * Text-layer-derived highlight geometry (ADR-043 Phase 1.5) — pure,
 * deterministic.
 *
 * Spatial anchors (ADR-045) carry backend-recorded bboxes; text-derived
 * anchors previously had NO in-document highlight at all — the safety bar
 * read "Located in document" while the PDF showed nothing, which operators
 * read as a broken highlight (notably the email-content anchors, e.g. the
 * From: header, which never have document geometry).
 *
 * This module derives a best-effort box for a text-derived anchor from the
 * SAME PDF.js text layer the safety-bar verifier reads: the anchor's
 * normalized text must resolve to exactly ONE occurrence in the full
 * document text (mirroring `resolveAnchorStatus` → located) AND exactly one
 * occurrence on the previewed page. Ambiguous / unlocated anchors get no
 * box — the safety bar stays the authoritative surface, and a missing box
 * is never a wrong one (ADR-043 §2.3).
 *
 * The EVIDENCE (text + ref) remains backend-authoritative; only the
 * on-screen position is derived, which the preview already declares as
 * best-effort. Items without usable geometry (older extractors, test
 * stubs) yield no box.
 */

import { normalizeMatchText, resolveAnchorStatus } from "@/lib/evidenceAnchor";
import type { EvidenceAnchor } from "@/types/exceptions";

/** The slice of a PDF.js `TextItem` this module consumes. `transform` is the
 *  text matrix [a, b, c, d, e, f] in PDF user space (origin bottom-left);
 *  `width`/`height` are the run's advance width and font size in the same
 *  space. Geometry fields are optional — items without them are skipped. */
export interface TextItemGeometry {
  str: string;
  transform?: number[];
  width?: number;
  height?: number;
}

export interface PageSize {
  width: number;
  height: number;
}

export interface TextLayerBox {
  supportsRef: string;
  label: string;
  /** CSS percentages (0..100) relative to the rendered page box —
   *  the same shape `spatialOverlays` produces. */
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}

interface IndexedItem {
  item: TextItemGeometry;
  /** [start, end) of this item's normalized text in the page string. */
  start: number;
  end: number;
}

function hasGeometry(it: TextItemGeometry): boolean {
  return (
    Array.isArray(it.transform) &&
    it.transform.length === 6 &&
    it.transform.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    typeof it.width === "number" &&
    typeof it.height === "number" &&
    it.width > 0 &&
    it.height > 0
  );
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

/** Build the normalized page string + per-item char ranges (items joined by a
 *  single space, mirroring the extractor's `join(" ")`). Empty items are
 *  carried with a zero-length range so indexes stay aligned. */
function indexItems(items: TextItemGeometry[]): { page: string; indexed: IndexedItem[] } {
  let page = "";
  const indexed: IndexedItem[] = [];
  for (const item of items) {
    const norm = normalizeMatchText(item.str);
    if (!norm) {
      indexed.push({ item, start: page.length, end: page.length });
      continue;
    }
    if (page.length > 0) page += " ";
    const start = page.length;
    page += norm;
    indexed.push({ item, start, end: page.length });
  }
  return { page, indexed };
}

/**
 * Best-effort highlight boxes for the text-derived anchors that uniquely
 * locate on the previewed page. Spatial anchors are excluded — their
 * backend-recorded bbox is authoritative and drawn by `spatialOverlays`.
 */
export function textLayerBoxes(
  items: TextItemGeometry[],
  pageSize: PageSize,
  fullDocText: string | null,
  anchors: EvidenceAnchor[],
): TextLayerBox[] {
  if (!items.length || pageSize.width <= 0 || pageSize.height <= 0) return [];
  const { page, indexed } = indexItems(items);
  if (!page) return [];

  const out: TextLayerBox[] = [];
  for (const anchor of anchors) {
    if (anchor.anchor_source === "spatial_extracted") continue;
    const needle = anchor.match_key?.normalized_text ?? "";
    if (!needle) continue;
    // Mirror the safety bar: only a globally-unique (located) anchor may
    // draw, and the single occurrence must be on this page.
    if (resolveAnchorStatus(fullDocText, anchor) !== "located") continue;
    if (countOccurrences(page, needle) !== 1) continue;

    const s = page.indexOf(needle);
    const e = s + needle.length;
    const covering = indexed.filter((ix) => ix.end > s && ix.start < e);
    if (covering.length === 0 || !covering.every((ix) => hasGeometry(ix.item))) {
      continue;
    }

    let x0 = Infinity;
    let x1 = -Infinity;
    let yBottom = Infinity;
    let yTop = -Infinity;
    for (const ix of covering) {
      const t = ix.item.transform as number[];
      const w = ix.item.width as number;
      const h = ix.item.height as number;
      const len = ix.end - ix.start;
      // Proportional slice of the run when the needle starts/ends inside it
      // (normalized-char approximation — best-effort, exact for whole-run
      // matches, which is the common case for line-oriented documents).
      const fracStart = len > 0 ? Math.max(0, (s - ix.start) / len) : 0;
      const fracEnd = len > 0 ? Math.min(1, (e - ix.start) / len) : 1;
      x0 = Math.min(x0, t[4] + w * fracStart);
      x1 = Math.max(x1, t[4] + w * fracEnd);
      // t[5] is the baseline; extend below for descenders and above for the
      // ascent so the wash covers the full glyph box.
      yBottom = Math.min(yBottom, t[5] - h * 0.25);
      yTop = Math.max(yTop, t[5] + h * 0.9);
    }
    if (!(x1 > x0) || !(yTop > yBottom)) continue;

    const clamp = (n: number) => Math.min(100, Math.max(0, n));
    out.push({
      supportsRef: anchor.supports_ref,
      label: anchor.label,
      leftPct: clamp((x0 / pageSize.width) * 100),
      // PDF user space is bottom-left origin; CSS is top-left.
      topPct: clamp(((pageSize.height - yTop) / pageSize.height) * 100),
      widthPct: clamp(((x1 - x0) / pageSize.width) * 100),
      heightPct: clamp(((yTop - yBottom) / pageSize.height) * 100),
    });
  }
  return out;
}
