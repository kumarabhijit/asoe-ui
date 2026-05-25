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
