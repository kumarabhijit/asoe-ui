/**
 * CP-D component test — AttachmentPreview (ADR-043). Drives the safety bar
 * (LOCATED / UNLOCATED / AMBIGUOUS), the non-dismissable banner, the
 * download control, and the default-deny of active content (SVG). The API
 * client is mocked so no bytes are fetched; PDF.js is never reached (text/SVG
 * paths only) so no canvas/worker is needed.
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AttachmentPreview } from "@/components/ui/AttachmentPreview";
import { EvidenceSelectionProvider } from "@/hooks/useEvidenceSelection";
import type { EmailAttachmentManifestEntry, EvidenceAnchor } from "@/types/exceptions";

vi.mock("@/lib/api", () => ({
  attachmentsApi: { getBlob: vi.fn() },
}));
import { attachmentsApi } from "@/lib/api";

const getBlob = vi.mocked(attachmentsApi.getBlob);

function attachment(): EmailAttachmentManifestEntry {
  return {
    name: "purchase_order.pdf",
    mime_type: "application/pdf",
    bytes: 42,
    sha256: "a".repeat(64),
    attachment_id: "att-1",
  };
}

function poAnchor(normalized = "po-2026-0042"): EvidenceAnchor {
  return {
    attachment_id: "att-1",
    anchor_source: "text_derived",
    text: "PO-2026-0042",
    match_key: { normalized_text: normalized, occurrence_index: 0 },
    supports_kind: "extracted_field",
    supports_ref: "order_entry.po_number",
    label: "PO number",
    source_sha256: "a".repeat(64),
  };
}

const textBlob = (s: string) => new Blob([s], { type: "text/plain" });

beforeEach(() => {
  getBlob.mockReset();
});

describe("AttachmentPreview", () => {
  it("always shows the non-dismissable disclaimer banner and a download control", async () => {
    getBlob.mockResolvedValue(textBlob("Order PO-2026-0042"));
    render(<AttachmentPreview caseId="case-1" attachment={attachment()} anchors={[poAnchor()]} />);
    expect(screen.getByTestId("highlight-disclaimer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
    // No dismiss control on the banner.
    const banner = screen.getByTestId("highlight-disclaimer");
    expect(banner.querySelector("button")).toBeNull();
  });

  it("marks an anchor LOCATED when its text resolves once in the document", async () => {
    getBlob.mockResolvedValue(textBlob("Order PO-2026-0042 ship to Atlanta DC"));
    const { container } = render(
      <AttachmentPreview caseId="case-1" attachment={attachment()} anchors={[poAnchor()]} />,
    );
    await waitFor(() => {
      const li = container.querySelector('[data-testid="evidence-safety-bar"] li');
      expect(li?.getAttribute("data-status")).toBe("located");
    });
  });

  it("marks an anchor UNLOCATED (not silent) when its text is absent", async () => {
    getBlob.mockResolvedValue(textBlob("a document with no purchase order number"));
    const { container } = render(
      <AttachmentPreview caseId="case-1" attachment={attachment()} anchors={[poAnchor()]} />,
    );
    await screen.findByText(/no purchase order number/);
    const li = container.querySelector('[data-testid="evidence-safety-bar"] li');
    expect(li?.getAttribute("data-status")).toBe("unlocated");
    expect(screen.getByText(/verify manually/i)).toBeInTheDocument();
  });

  it("marks an anchor AMBIGUOUS when the value appears multiple times", async () => {
    getBlob.mockResolvedValue(textBlob("PO-2026-0042 ... line 2 PO-2026-0042"));
    const { container } = render(
      <AttachmentPreview caseId="case-1" attachment={attachment()} anchors={[poAnchor()]} />,
    );
    await waitFor(() => {
      const li = container.querySelector('[data-testid="evidence-safety-bar"] li');
      expect(li?.getAttribute("data-status")).toBe("ambiguous");
    });
  });

  it("draws a spatial bbox overlay on the PDF canvas for a verified spatial anchor", async () => {
    // A %PDF blob selects the pdf renderer; PDF.js fails gracefully in jsdom
    // (no worker) but the canvas layer + overlays still render from the
    // backend-authoritative anchor geometry (ADR-045 P2.10).
    getBlob.mockResolvedValue(new Blob(["%PDF-1.4\nmock"], { type: "application/pdf" }));
    const spatial: EvidenceAnchor = {
      ...poAnchor(),
      anchor_source: "spatial_extracted",
      page: 1,
      bbox: [0.1, 0.2, 0.5, 0.3],
      confidence: 0.97,
      rendition_hash: "rh-1",
    };
    render(<AttachmentPreview caseId="case-1" attachment={attachment()} anchors={[spatial]} />);
    const overlay = await screen.findByTestId("spatial-overlay");
    expect(overlay).toHaveAttribute("data-supports-ref", "order_entry.po_number");
    expect(overlay.style.left).toBe("10%");
    expect(overlay.style.width).toBe("40%");
    // The safety bar stays the authoritative surface alongside the overlay.
    expect(screen.getByTestId("evidence-safety-bar")).toBeInTheDocument();
  });

  it("draws no overlay for a text-derived anchor (safety bar only)", async () => {
    getBlob.mockResolvedValue(new Blob(["%PDF-1.4\nmock"], { type: "application/pdf" }));
    render(<AttachmentPreview caseId="case-1" attachment={attachment()} anchors={[poAnchor()]} />);
    await screen.findByTestId("pdf-canvas-layer");
    expect(screen.queryByTestId("spatial-overlay")).toBeNull();
  });

  it("field↔source: selecting a safety-bar row toggles aria-pressed and emphasises the matching overlay", async () => {
    // %PDF blob → pdf renderer; a verified spatial anchor draws an overlay
    // keyed by supports_ref. Selecting the row foregrounds that overlay.
    getBlob.mockResolvedValue(new Blob(["%PDF-1.4\nmock"], { type: "application/pdf" }));
    const spatial: EvidenceAnchor = {
      ...poAnchor(),
      anchor_source: "spatial_extracted",
      page: 1,
      bbox: [0.1, 0.2, 0.5, 0.3],
      confidence: 0.97,
      rendition_hash: "rh-1",
    };
    render(
      <EvidenceSelectionProvider>
        <AttachmentPreview caseId="case-1" attachment={attachment()} anchors={[spatial]} />
      </EvidenceSelectionProvider>,
    );
    const row = await screen.findByRole("button", { name: /PO number/i });
    expect(row).toHaveAttribute("aria-pressed", "false");
    const overlay = await screen.findByTestId("spatial-overlay");
    expect(overlay.getAttribute("data-selected")).toBeNull();

    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(overlay.getAttribute("data-selected")).toBe("true");

    // Toggling off clears the selection (and the overlay emphasis).
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-pressed", "false");
    expect(overlay.getAttribute("data-selected")).toBeNull();
  });

  it("default-denies SVG (does not render the markup) and offers download", async () => {
    getBlob.mockResolvedValue(
      new Blob(["<svg xmlns='x'><script>window.__pwned=1</script></svg>"], { type: "image/svg+xml" }),
    );
    const { container } = render(
      <AttachmentPreview caseId="case-1" attachment={attachment()} anchors={[]} />,
    );
    await screen.findByText(/can.?t be previewed/i);
    // The SVG payload is never injected as markup / executed.
    expect(container.querySelector("script")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
  });
});
