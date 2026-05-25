/**
 * CP-D unit — detectPreviewFormat (ADR-043 §2.1). Mirrors the backend
 * `tests/test_preview_format_detection.py`: bytes-only selection, default-deny,
 * SVG/HTML denied.
 */
import { describe, it, expect } from "vitest";
import { detectPreviewFormat } from "@/lib/previewFormat";

const enc = (s: string) => new TextEncoder().encode(s);

describe("detectPreviewFormat", () => {
  it("detects allowlisted formats by magic bytes", () => {
    expect(detectPreviewFormat(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe("pdf");
    expect(
      detectPreviewFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])),
    ).toBe("image");
    expect(detectPreviewFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBe("image");
    expect(detectPreviewFormat(enc("order_id,qty\nA-1,5\n"))).toBe("text");
  });

  it("denies SVG and HTML (XSS vectors)", () => {
    expect(detectPreviewFormat(enc("<svg xmlns='...'><script>alert(1)</script></svg>"))).toBeNull();
    expect(detectPreviewFormat(enc("<!doctype html><script>alert(1)</script>"))).toBeNull();
  });

  it("denies binary / unknown content by default", () => {
    expect(detectPreviewFormat(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]))).toBeNull();
    expect(detectPreviewFormat(new Uint8Array([0x9f, 0x8a, 0x00, 0x01]))).toBeNull();
  });
});
