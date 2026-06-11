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

// Stub PDF.js so the page "paints" deterministically in jsdom. Two paths are
// independent and both must be exercised: text extraction (getTextContent —
// the safety bar's authoritative input) and the canvas paint (page.render —
// cosmetic, gated to the spatial overlays). `pdf.renderShouldReject` lets a
// test fail ONLY the paint, to prove extraction/location survives it.
// `pdf.textItems` is per-test overridable: the default carries text-matrix
// geometry (transform/width/height) like a real extractor, so the Phase-1.5
// text-layer-derived highlight path is exercisable; a geometry-less override
// proves graceful degradation.
const pdf = vi.hoisted(() => ({
  renderShouldReject: false,
  textItems: [
    {
      str: "PO-2026-0042 ship to Atlanta DC",
      transform: [12, 0, 0, 12, 64, 720],
      width: 220,
      height: 12,
    },
  ] as Array<{ str: string; transform?: number[]; width?: number; height?: number }>,
}));
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: () =>
        Promise.resolve({
          getViewport: () => ({ width: 612, height: 792 }),
          render: () => ({
            promise: pdf.renderShouldReject
              ? Promise.reject(new Error("paint failed"))
              : Promise.resolve(),
          }),
          getTextContent: () => Promise.resolve({ items: pdf.textItems }),
        }),
    }),
  }),
}));

const getBlob = vi.mocked(attachmentsApi.getBlob);

type GetContext = typeof HTMLCanvasElement.prototype.getContext;
const setCanvasContext = (value: unknown) => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => value) as unknown as GetContext;
};

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
  pdf.renderShouldReject = false;
  pdf.textItems = [
    {
      str: "PO-2026-0042 ship to Atlanta DC",
      transform: [12, 0, 0, 12, 64, 720],
      width: 220,
      height: 12,
    },
  ];
  // jsdom has no real 2D context; give the canvas a truthy one so the deferred
  // PDF paint succeeds and the page-rendered gate opens for the overlay tests.
  setCanvasContext({});
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

  it("paints the spatial overlay with a translucent highlighter wash, never an opaque fill (text under it must stay visible)", async () => {
    // Regression: the overlay sits above the PDF canvas. An opaque fill (e.g.
    // var(--color-brand-subtle), which is the solid #F3F1FE in light mode)
    // paints OVER the evidence text and hides it — the operator saw solid bars
    // instead of the PO number / Ship-to / Requested date / Material spans. The
    // fill must be the translucent highlighter token so the text shows through.
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
    expect(overlay.style.background).toContain("var(--color-highlight-evidence)");
    expect(overlay.style.background).not.toContain("brand-subtle");
    // Highlighter semantics: the overlay must MULTIPLY with the canvas rather
    // than paint over it, so text stays legible at any scale/DPI. On a
    // downscaled mobile canvas the box gets short and the fixed-width border
    // would otherwise close over the text — multiply keeps dark glyphs visible.
    expect(overlay.style.mixBlendMode).toBe("multiply");
    // The blend is scoped to the canvas layer (no bleed into page content).
    const layer = screen.getByTestId("pdf-canvas-layer");
    expect(layer.style.isolation).toBe("isolate");
  });

  it("keeps evidence LOCATED when the canvas paint fails (extraction is decoupled)", async () => {
    // Regression (live browser-e2e failure on PR #237): the page paint and the
    // text-layer extraction share one PDF.js pass. Painting first meant a
    // page.render() throw (worker/renderer issue in the real browser) aborted
    // before extraction, so docText was null and EVERY anchor read "unlocated"
    // — the safety bar lost its authoritative status. Extraction must run
    // first and independently. Here the paint rejects but location must hold.
    pdf.renderShouldReject = true;
    getBlob.mockResolvedValue(new Blob(["%PDF-1.4\nmock"], { type: "application/pdf" }));
    const spatial: EvidenceAnchor = {
      ...poAnchor(),
      anchor_source: "spatial_extracted",
      page: 1,
      bbox: [0.1, 0.2, 0.5, 0.3],
      confidence: 0.97,
      rendition_hash: "rh-1",
    };
    const { container } = render(
      <AttachmentPreview caseId="case-1" attachment={attachment()} anchors={[spatial]} />,
    );
    // Text extraction succeeded → the PO anchor resolves LOCATED in the doc text.
    await waitFor(() => {
      const li = container.querySelector('[data-testid="evidence-safety-bar"] li');
      expect(li?.getAttribute("data-status")).toBe("located");
    });
    // …but the paint failed, so no box is drawn over the (unpainted) canvas.
    expect(screen.queryByTestId("spatial-overlay")).toBeNull();
  });

  it("suppresses spatial overlays when the PDF page fails to paint (no boxes over a blank canvas)", async () => {
    // Regression (Source-Email PDF render bug): the page is painted in a
    // post-mount effect; when the canvas can't get a 2D context (PDF.js
    // unavailable) the page stays blank, so the overlays MUST NOT draw — else
    // they float over a blank canvas as garbled bars (the reported symptom).
    // The text-derived safety bar stays the authoritative surface.
    setCanvasContext(null);
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
    await screen.findByTestId("pdf-canvas-layer");
    expect(screen.getByTestId("evidence-safety-bar")).toBeInTheDocument();
    expect(screen.queryByTestId("spatial-overlay")).toBeNull();
  });

  // ── Phase 1.5 — text-layer-derived highlights for text-derived anchors ──
  // Regression (bug report 2026-06-11): a LOCATED text-derived anchor (e.g.
  // the email-content From: evidence) showed a verified safety-bar row but NO
  // in-document highlight; only spatial anchors drew boxes. The fix derives a
  // best-effort box from the PDF.js text layer when the anchor uniquely
  // locates on the previewed page. These tests fail on the parent commit.

  it("draws a text-layer-derived overlay for a LOCATED text-derived anchor", async () => {
    getBlob.mockResolvedValue(new Blob(["%PDF-1.4\nmock"], { type: "application/pdf" }));
    render(<AttachmentPreview caseId="case-1" attachment={attachment()} anchors={[poAnchor()]} />);
    await screen.findByTestId("pdf-canvas-layer");
    const overlay = await screen.findByTestId("text-layer-overlay");
    expect(overlay.getAttribute("data-supports-ref")).toBe("order_entry.po_number");
    // Never double-badged as a spatial (backend-recorded) box.
    expect(screen.queryByTestId("spatial-overlay")).toBeNull();
  });

  it("draws no overlay for an UNLOCATED text-derived anchor (safety bar only)", async () => {
    getBlob.mockResolvedValue(new Blob(["%PDF-1.4\nmock"], { type: "application/pdf" }));
    render(
      <AttachmentPreview
        caseId="case-1"
        attachment={attachment()}
        anchors={[poAnchor("missing-from-document")]}
      />,
    );
    await screen.findByTestId("pdf-canvas-layer");
    expect(screen.queryByTestId("text-layer-overlay")).toBeNull();
    expect(screen.queryByTestId("spatial-overlay")).toBeNull();
  });

  it("degrades to safety-bar-only when the text layer has no geometry", async () => {
    pdf.textItems = [{ str: "PO-2026-0042 ship to Atlanta DC" }];
    getBlob.mockResolvedValue(new Blob(["%PDF-1.4\nmock"], { type: "application/pdf" }));
    render(<AttachmentPreview caseId="case-1" attachment={attachment()} anchors={[poAnchor()]} />);
    await screen.findByTestId("pdf-canvas-layer");
    // Still LOCATED (the safety bar reads the text layer)…
    await waitFor(() =>
      expect(screen.getByTestId("evidence-safety-bar").querySelector("li")?.getAttribute("data-status")).toBe("located"),
    );
    // …but no derived box without geometry — never a wrong one.
    expect(screen.queryByTestId("text-layer-overlay")).toBeNull();
  });

  it("field↔source: selecting a safety-bar row emphasises the text-layer overlay", async () => {
    getBlob.mockResolvedValue(new Blob(["%PDF-1.4\nmock"], { type: "application/pdf" }));
    render(
      <EvidenceSelectionProvider>
        <AttachmentPreview caseId="case-1" attachment={attachment()} anchors={[poAnchor()]} />
      </EvidenceSelectionProvider>,
    );
    const row = await screen.findByRole("button", { name: /PO number/i });
    const overlay = await screen.findByTestId("text-layer-overlay");
    expect(overlay.getAttribute("data-selected")).toBeNull();
    fireEvent.click(row);
    expect(overlay.getAttribute("data-selected")).toBe("true");
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
