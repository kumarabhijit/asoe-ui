/**
 * Mock-data coverage lock (ADR-043). Guards the three requirements the PO
 * called out: Source Email on every customer-inbox case, downloadable
 * attachments on at least 3 records, and evidence anchors that actually bind to
 * a stored attachment (so the preview safety bar is never blank by accident).
 */
import { describe, it, expect } from "vitest";

import { MOCK_ORDER_ANALYSES } from "@/lib/mock-data/order-analyses";
import { MOCK_EXCEPTIONS } from "@/lib/mock-data/exceptions";

const inboxIds = MOCK_EXCEPTIONS
  .filter((e) => String(e.event_type).startsWith("EMAIL_"))
  .map((e) => e.id);

describe("customer-inbox mock coverage", () => {
  it("there are several inbox (EMAIL_*) records", () => {
    expect(inboxIds.length).toBeGreaterThanOrEqual(8);
  });

  it("every inbox case has an email_source (Source Email everywhere)", () => {
    const missing = inboxIds.filter((id) => !MOCK_ORDER_ANALYSES[id]?.email_source);
    expect(missing, `inbox cases missing email_source: ${missing.join(", ")}`).toEqual([]);
  });

  it("every inbox case has extracted entities (evidence is never blank)", () => {
    const blank = inboxIds.filter(
      (id) => (MOCK_ORDER_ANALYSES[id]?.entities_analysis?.extracted ?? []).length === 0,
    );
    expect(blank, `inbox cases with blank entities: ${blank.join(", ")}`).toEqual([]);
  });

  it("at least 3 inbox cases have a stored, downloadable attachment", () => {
    const withAttachments = inboxIds.filter((id) =>
      (MOCK_ORDER_ANALYSES[id]?.email_source?.attachment_manifest ?? []).some(
        (a) => Boolean(a.attachment_id),
      ),
    );
    expect(withAttachments.length).toBeGreaterThanOrEqual(3);
  });

  it("every evidence anchor binds to a manifest attachment and carries a sha256", () => {
    for (const id of inboxIds) {
      const src = MOCK_ORDER_ANALYSES[id]?.email_source;
      if (!src) continue;
      const manifestIds = new Set((src.attachment_manifest ?? []).map((a) => a.attachment_id));
      for (const anchor of src.evidence_anchors ?? []) {
        expect(manifestIds.has(anchor.attachment_id), `${id}: anchor not bound to a manifest attachment`).toBe(true);
        expect(anchor.source_sha256).toHaveLength(64);
        // Phase-1 text anchors carry no geometry; Phase-2 spatial anchors
        // (ADR-045 — e.g. PO_8842, mirrored from the backend recorded
        // extraction) carry a verified page + a normalised bbox.
        expect(["text_derived", "spatial_extracted"]).toContain(anchor.anchor_source);
        if (anchor.anchor_source === "spatial_extracted") {
          expect(typeof anchor.page).toBe("number");
          expect(anchor.bbox).toHaveLength(4);
          for (const n of anchor.bbox ?? []) {
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThanOrEqual(1);
          }
        } else {
          expect(anchor.page ?? null).toBeNull();
          expect(anchor.bbox ?? null).toBeNull();
        }
      }
    }
  });
});
