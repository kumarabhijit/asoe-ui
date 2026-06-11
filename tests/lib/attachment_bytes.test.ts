/**
 * Regression test (ADR-043) — mock attachment bytes are TYPE-CORRECT so a
 * downloaded mock file opens. Pre-fix, getBlob returned text/plain for every
 * attachment, so a `.pdf` download was text-with-a-pdf-name and wouldn't open.
 */
import { describe, it, expect } from "vitest";
import { mockAttachmentBlob } from "@/lib/mock-data/attachment-bytes";

async function head(blob: Blob, n: number): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer()).slice(0, n);
  return String.fromCharCode(...bytes);
}

describe("mockAttachmentBlob", () => {
  it("emits a real PDF for a .pdf (magic %PDF + application/pdf type)", async () => {
    const blob = mockAttachmentBlob({
      caseId: "case-1", attachmentId: "att-1",
      mimeType: "application/pdf", fileName: "PO_8842.pdf",
    });
    expect(blob.type).toBe("application/pdf");
    expect(await head(blob, 5)).toBe("%PDF-");
    // a trailer/EOF marker is present (openable structure)
    const full = await blob.text();
    expect(full).toContain("%%EOF");
  });

  it("picks PDF by filename extension even without a mime type", async () => {
    const blob = mockAttachmentBlob({ caseId: "c", attachmentId: "a", fileName: "doc.pdf" });
    expect(await head(blob, 5)).toBe("%PDF-");
  });

  it("emits a real PNG for an image", async () => {
    const blob = mockAttachmentBlob({
      caseId: "c", attachmentId: "a", mimeType: "image/png", fileName: "x.png",
    });
    expect(blob.type).toBe("image/png");
    const sig = new Uint8Array(await blob.arrayBuffer()).slice(0, 4);
    expect(Array.from(sig)).toEqual([0x89, 0x50, 0x4e, 0x47]); // \x89PNG
  });

  it("embeds evidence text into the PDF so the preview can locate it", async () => {
    const blob = mockAttachmentBlob({
      caseId: "c", attachmentId: "a", mimeType: "application/pdf", fileName: "po.pdf",
      evidenceText: ["PO# EML-PO-2026-0042", "ship to Atlanta DC"],
    });
    const text = await blob.text();
    expect(text).toContain("PO# EML-PO-2026-0042");
    expect(text).toContain("ship to Atlanta DC");
  });

  it("emits CSV text for a .csv", async () => {
    const blob = mockAttachmentBlob({
      caseId: "c", attachmentId: "a", mimeType: "text/csv", fileName: "ship_to.csv",
    });
    expect(blob.type).toBe("text/csv");
    expect(await blob.text()).toContain("field,value");
  });
});

// ── General (non-evidence) text + uniqueness locks (2026-06-11) ────────────
//
// Bug-report follow-on: a mock PDF that contained ONLY evidence lines made
// every line look highlighted — no visual discrimination between evidence and
// ordinary content. The builders now wrap evidence in general boilerplate.
// The flip side is a safety property: filler must never duplicate an evidence
// span, or the safety bar flips LOCATED → AMBIGUOUS.

const SE_EVIDENCE = [
  "PO# EML-PO-2026-0042",
  "From: buyer@southeast-distrib.example",
  "ship to Atlanta DC",
  "need by May 24",
  "Cola 12pk x 600",
];

function countIn(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

describe("mockAttachmentBlob — general text vs evidence discrimination", () => {
  it("the simple PDF layout contains general non-evidence text", async () => {
    const blob = mockAttachmentBlob({
      caseId: "c", attachmentId: "a", mimeType: "application/pdf",
      fileName: "cancellation_request.pdf",
      evidenceText: SE_EVIDENCE,
    });
    const body = await blob.text();
    expect(body).toContain("for your review");
    expect(body).toContain("terms and conditions remain unchanged");
  });

  it("the PO_8842 layout contains general non-evidence text and labels the email-context band", async () => {
    const blob = mockAttachmentBlob({
      caseId: "c", attachmentId: "a", mimeType: "application/pdf",
      fileName: "PO_8842.pdf",
      evidenceText: SE_EVIDENCE,
    });
    const body = await blob.text();
    expect(body).toContain("Terms: Net 30");
    expect(body).toContain("Standard supply agreement");
    // The non-geometry (email-content) evidence band is labelled so the
    // operator can tell document content from email-derived context.
    expect(body).toContain("Email context:");
  });

  it("every evidence span appears EXACTLY once in both layouts (filler must not create AMBIGUOUS)", async () => {
    for (const fileName of ["PO_8842.pdf", "cancellation_request.pdf"]) {
      const blob = mockAttachmentBlob({
        caseId: "c", attachmentId: "a", mimeType: "application/pdf",
        fileName, evidenceText: SE_EVIDENCE,
      });
      const body = await blob.text();
      for (const span of SE_EVIDENCE) {
        expect(
          countIn(body, span),
          `'${span}' must appear exactly once in ${fileName}`,
        ).toBe(1);
      }
    }
  });
});
