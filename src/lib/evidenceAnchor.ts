/**
 * Evidence-anchor runtime verification (ADR-043 §2.3) — the safety bar's spine.
 *
 * Pure, deterministic, and the same logic the viewer uses to decide whether to
 * draw a highlight: a highlight is only "located" when the anchor's verbatim
 * text resolves to exactly one occurrence in the rendered document text. Zero
 * matches → UNLOCATED (shown as loudly as a hit — never a silent absence).
 * Multiple matches → AMBIGUOUS (position uncertain — never a confident guess).
 * No document text available (e.g. an image, or PDF text extraction failed) →
 * UNLOCATED (position unconfirmed). The evidence stays authoritative; only the
 * on-screen position is best-effort.
 */

import type { EvidenceAnchor } from "@/types/exceptions";

export type AnchorStatus = "located" | "unlocated" | "ambiguous";

/** Mirror of the backend locate-key normalisation (collapse whitespace +
 *  lower-case). The anchor's `match_key.normalized_text` is already normalised
 *  backend-side; this normalises the document text the same way before search. */
export function normalizeMatchText(s: string): string {
  return s.split(/\s+/).filter(Boolean).join(" ").toLowerCase();
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

export function resolveAnchorStatus(docText: string | null, anchor: EvidenceAnchor): AnchorStatus {
  if (docText == null) return "unlocated";
  const n = countOccurrences(normalizeMatchText(docText), anchor.match_key.normalized_text);
  if (n === 0) return "unlocated";
  if (n === 1) return "located";
  return "ambiguous";
}

/**
 * Find the anchor whose `supports_ref` matches a selected evidence ref
 * (ADR-043 field↔source linking). Pure lookup — the ref is backend-
 * authoritative (it comes from `EvidenceAnchor.supports_ref` /
 * `ExtractedEntity.evidence_ref`), so the UI never derives or guesses a
 * pairing. Returns null when no anchor supports the ref (e.g. the producer
 * stamped a ref but no matching anchor was located for this attachment).
 */
export function anchorForRef(
  anchors: EvidenceAnchor[],
  ref: string | null | undefined,
): EvidenceAnchor | null {
  if (!ref) return null;
  return anchors.find((a) => a.supports_ref === ref) ?? null;
}
