/**
 * AttachmentPreview — sandboxed attachment preview + in-document evidence
 * highlighting (ADR-043 Phase 1).
 *
 * Renders a stored attachment (PDF via PDF.js canvas + text layer, image via
 * <img>, text/csv escaped) and surfaces the backend-authoritative EvidenceAnchors
 * as a SAFETY BAR. The safety bar is the authoritative surface: each anchor is
 * verified at render time against the document text and shown as LOCATED /
 * UNLOCATED / AMBIGUOUS — an UNLOCATED anchor is shown as loudly as a hit, never
 * a silent absence (ADR-043 §2.3). On-screen position is best-effort; the
 * evidence (anchor text + label) is authoritative.
 *
 * Format is chosen by validated magic bytes (never the declared mime_type), and
 * unsupported / active content (SVG, HTML) is default-denied to download-only.
 * Bytes are read via `attachmentsApi` (the single API client) — this component
 * never touches `fetch` itself.
 *
 * NOTE: precise pixel overlays on the PDF canvas are ADR-045 (spatial) territory
 * for backend-recorded geometry; text-derived anchors additionally get a
 * best-effort box derived from the PDF.js text layer (Phase 1.5) when their
 * text uniquely locates on the previewed page — the email-content anchors
 * (e.g. the From: header) have no document geometry and previously showed no
 * in-document highlight at all. PDF.js rendering is browser-only: the page
 * is painted in a dedicated effect once the canvas has mounted, and the spatial
 * overlays draw ONLY when that paint succeeded — if PDF.js can't render, the
 * canvas (and its boxes) are suppressed and the safety bar remains authoritative.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  HelpCircle,
  Loader2,
  ShieldAlert,
} from "lucide-react";

import { attachmentsApi } from "@/lib/api";
import { AttachmentDownloadButton } from "@/components/ui/AttachmentDownloadButton";
import { detectPreviewFormat, type PreviewFormat } from "@/lib/previewFormat";
import { resolveAnchorStatus, type AnchorStatus } from "@/lib/evidenceAnchor";
import { spatialOverlays } from "@/lib/spatialOverlay";
import {
  textLayerBoxes,
  type PageSize,
  type TextItemGeometry,
} from "@/lib/textLayerHighlight";
import { useEvidenceSelection } from "@/hooks/useEvidenceSelection";
import { cn } from "@/lib/utils";
import type { EmailAttachmentManifestEntry, EvidenceAnchor } from "@/types/exceptions";

// PDF.js Phase-1 renders page 1 only; spatial overlays are drawn for that page.
const PREVIEW_PAGE = 1;

interface AttachmentPreviewProps {
  /** Threaded explicitly from ExceptionDetailPanel (provenance must be visible
   *  on a SOX surface — not React context). */
  caseId: string;
  attachment: EmailAttachmentManifestEntry;
  anchors: EvidenceAnchor[];
  /** Decision-quality telemetry (ADR-043 §2.7) — fired once when the operator
   *  is shown an evidence-highlight safety bar, so scrutiny can be compared
   *  with vs without highlighting. Best-effort; never blocks render. */
  onHighlightShown?: () => void;
}

type LoadState = "loading" | "ready" | "error";

const STATUS_META: Record<
  AnchorStatus,
  { label: string; Icon: typeof CheckCircle2 }
> = {
  located: { label: "Located in document", Icon: CheckCircle2 },
  unlocated: { label: "Not located — verify manually", Icon: ShieldAlert },
  ambiguous: { label: "Multiple matches — position approximate", Icon: AlertTriangle },
};

async function renderPdfAndExtractText(
  bytes: Uint8Array,
  canvas: HTMLCanvasElement | null,
): Promise<{
  text: string | null;
  rendered: boolean;
  /** Page-1 text items WITH geometry + the page size — the input for the
   *  text-layer-derived highlight boxes (Phase 1.5). Null when extraction
   *  failed; boxes are then skipped and the safety bar stands alone. */
  pageGeometry: { items: TextItemGeometry[]; size: PageSize } | null;
}> {
  let text: string | null = null;
  let rendered = false;
  let pageGeometry: { items: TextItemGeometry[]; size: PageSize } | null = null;
  try {
    const pdfjs = await import("pdfjs-dist");
    // Bundled worker, no CDN (ADR-043 §2.1).
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    // PDF.js does not execute PDF-embedded JavaScript by default
    // (enableScripting defaults false) and we never enable the annotation
    // script layer — that is the XSS mitigation for untrusted PDFs.
    const doc = await pdfjs.getDocument({ data: bytes }).promise;
    const page = await doc.getPage(1);

    // Extract the text layer FIRST. It is the safety bar's authoritative input
    // (resolveAnchorStatus → located/unlocated) and MUST NOT be coupled to the
    // canvas paint: a paint failure (worker/bundler/renderer-API issue) must
    // still leave the operator with verified evidence status, never a blanket
    // "unlocated". (Regression: doing the paint first meant a render throw
    // skipped extraction and every anchor read unlocated.)
    let acc = "";
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = p === 1 ? page : await doc.getPage(p);
      const content = await pg.getTextContent();
      acc += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + " ";
      if (p === PREVIEW_PAGE) {
        // Keep the previewed page's item geometry (text matrix + run
        // width/height in user space) for the derived highlight boxes.
        const view = page.getViewport({ scale: 1 });
        pageGeometry = {
          items: content.items.map((it) =>
            "str" in it
              ? {
                  str: it.str,
                  transform: (it as { transform?: number[] }).transform,
                  width: (it as { width?: number }).width,
                  height: (it as { height?: number }).height,
                }
              : { str: "" },
          ),
          size: { width: view.width, height: view.height },
        };
      }
    }
    text = acc;

    // Best-effort canvas paint — isolated so a failure here can't wipe `text`.
    if (canvas) {
      try {
        const viewport = page.getViewport({ scale: 1.25 });
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        if (ctx) {
          // pdfjs-dist v4 RenderParameters is { canvasContext, viewport } — the
          // `canvas` key is v5-only (and v5's renderer needs a JS method the
          // target browsers lack; see the version pin in package.json).
          await page.render({ canvasContext: ctx, viewport }).promise;
          rendered = true;
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[AttachmentPreview] PDF canvas paint failed:", e);
      }
    }
    return { text, rendered, pageGeometry };
  } catch (e) {
    // Document open / text extraction failed — degrade to position-unconfirmed
    // but surface the reason for debugging the live deployment.
    // eslint-disable-next-line no-console
    console.error("[AttachmentPreview] PDF open/extract failed:", e);
    return { text, rendered, pageGeometry };
  }
}

export function AttachmentPreview({ caseId, attachment, anchors, onHighlightShown }: AttachmentPreviewProps) {
  // ADR-043 field↔source linking — the selected evidence ref shared with the
  // entity sections. Selecting a safety-bar row foregrounds it here AND lets a
  // sibling section's row light up; clicking an entity elsewhere foregrounds
  // the matching row + overlay here. Default (no provider) is a safe no-op.
  const { selectedRef, selectRef } = useEvidenceSelection();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [format, setFormat] = useState<PreviewFormat | null | undefined>(undefined);
  const [docText, setDocText] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // PDF bytes are held until the canvas mounts (see the render effect below);
  // `pageRendered` gates the spatial overlays so they only draw over a page
  // that actually painted — never as floating boxes over a blank canvas.
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pageRendered, setPageRendered] = useState(false);
  // Page-1 text-item geometry — input for the text-layer-derived highlight
  // boxes (Phase 1.5). Null until extraction succeeds.
  const [pageGeometry, setPageGeometry] = useState<{
    items: TextItemGeometry[];
    size: PageSize;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const attachmentId = attachment.attachment_id ?? null;

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    if (!attachmentId) {
      setLoadState("error");
      setError("This attachment is not stored — no preview available.");
      return;
    }

    setLoadState("loading");
    setError(null);
    setDocText(null);
    setObjectUrl(null);
    setFormat(undefined);
    setPdfBytes(null);
    setPageRendered(false);
    setPageGeometry(null);

    (async () => {
      try {
        const blob = await attachmentsApi.getBlob(caseId, attachmentId, {
          mimeType: attachment.mime_type,
          fileName: attachment.name,
          // Mock mode embeds these so the safety bar locates them; the real API
          // ignores the hint and streams genuine bytes.
          evidenceText: anchors.map((a) => a.text),
        });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (cancelled) return;
        const fmt = detectPreviewFormat(bytes);
        setFormat(fmt);

        if (fmt === "image") {
          createdUrl = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(createdUrl);
            return;
          }
          setObjectUrl(createdUrl);
        } else if (fmt === "text") {
          setDocText(new TextDecoder("utf-8").decode(bytes));
        } else if (fmt === "pdf") {
          // The <canvas> is gated on loadState==="ready", so it is NOT mounted
          // yet (we're still "loading") — rendering here would target a null
          // ref and silently never paint the page. Stash the bytes; the render
          // effect below paints once the canvas exists.
          if (cancelled) return;
          setPdfBytes(bytes);
        }
        if (!cancelled) setLoadState("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Preview failed");
        setLoadState("error");
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [caseId, attachmentId]);

  // Paint the PDF page once the canvas is actually mounted. This MUST be a
  // separate effect from the loader: while loadState is "loading" the <canvas>
  // (gated on ready+pdf) isn't mounted, so canvasRef.current is null and a
  // render attempted in the loader silently never draws the page — leaving a
  // blank canvas under the spatial overlays. By the time this runs, the
  // ready+pdf commit has mounted the canvas, so the page paints; `rendered`
  // tells us whether it did, which gates the overlays.
  useEffect(() => {
    if (format !== "pdf" || !pdfBytes) return;
    let cancelled = false;
    (async () => {
      // getDocument takes OWNERSHIP of the typed array and detaches its buffer
      // (worker handoff). The bytes live in state and this effect may run again
      // (re-render / dev double-invoke), so hand PDF.js a fresh copy each time;
      // the state copy stays intact and re-extraction never hits a detached
      // buffer.
      const { text, rendered, pageGeometry: geom } = await renderPdfAndExtractText(
        new Uint8Array(pdfBytes),
        canvasRef.current,
      );
      if (cancelled) return;
      setDocText(text);
      setPageRendered(rendered);
      setPageGeometry(geom);
    })();
    return () => {
      cancelled = true;
    };
  }, [format, pdfBytes]);

  // Decision-quality cohort (ADR-043 §2.7): record that a highlight safety bar
  // was actually presented to the operator for this case.
  const highlightReportedRef = useRef(false);
  useEffect(() => {
    if (anchors.length > 0 && loadState === "ready" && !highlightReportedRef.current) {
      highlightReportedRef.current = true;
      onHighlightShown?.();
    }
  }, [anchors.length, loadState, onHighlightShown]);

  // Overlay geometry: backend-recorded bboxes (ADR-045, authoritative) plus
  // best-effort text-layer boxes for the text-derived anchors (Phase 1.5 —
  // e.g. email-content evidence with no document geometry). A ref with a
  // spatial box never also gets a derived one.
  const spatial = spatialOverlays(anchors, PREVIEW_PAGE);
  const spatialRefs = new Set(spatial.map((o) => o.supportsRef));
  const derived = pageGeometry
    ? textLayerBoxes(pageGeometry.items, pageGeometry.size, docText, anchors).filter(
        (b) => !spatialRefs.has(b.supportsRef),
      )
    : [];
  const overlays = [
    ...spatial.map((o) => ({ ...o, kind: "spatial" as const })),
    ...derived.map((o) => ({ ...o, kind: "text-layer" as const })),
  ];

  return (
    <section
      aria-label={`Attachment preview: ${attachment.name}`}
      className="bg-surface-primary rounded-md border border-border-subtle p-12 mt-8"
    >
      {/* Non-dismissable honesty banner (ADR-043 §2.7) — highlight is not
          authorization, and a missing highlight is not proof of absence. */}
      <div
        role="note"
        aria-label="Evidence highlighting disclaimer"
        data-testid="highlight-disclaimer"
        className="flex items-start gap-8 mb-12 p-8 bg-surface-secondary rounded-sm border border-border-subtle"
      >
        <HelpCircle size={14} className="text-text-tertiary shrink-0 mt-2" aria-hidden />
        <p className="m-0 text-caption text-text-secondary leading-normal">
          Highlights mark where the system believes evidence appears. The absence
          of a highlight is <strong>not</strong> confirmation a value is absent —
          you are authorising against the document, not the highlights.
        </p>
      </div>

      {/* Safety bar — the authoritative evidence surface. */}
      {anchors.length > 0 && (
        <ul
          aria-label="Evidence anchors"
          data-testid="evidence-safety-bar"
          className="m-0 mb-12 p-0 list-none flex flex-col gap-6"
        >
          {anchors.map((anchor, idx) => {
            const status = resolveAnchorStatus(docText, anchor);
            const meta = STATUS_META[status];
            const isSelected = selectedRef === anchor.supports_ref;
            return (
              <li key={`${anchor.supports_ref}-${idx}`} data-status={status}>
                {/* The row is a toggle: selecting it foregrounds the matching
                    in-document overlay (and any sibling entity row on the same
                    ref). Keyboard-operable; selection is conveyed by
                    aria-pressed + a ring, never colour alone. */}
                <button
                  type="button"
                  data-supports-ref={anchor.supports_ref}
                  data-selected={isSelected || undefined}
                  aria-pressed={isSelected}
                  onClick={() => selectRef(anchor.supports_ref)}
                  className={cn(
                    "w-full flex items-center gap-8 px-10 py-6 bg-surface-secondary rounded-sm text-left",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                    isSelected && "ring-2 ring-brand bg-brand-subtle",
                  )}
                >
                  <meta.Icon size={14} className="shrink-0 text-text-tertiary" aria-hidden />
                  <span className="text-body font-semibold text-text-primary">
                    {anchor.label}
                  </span>
                  <span className="font-mono text-caption text-text-secondary truncate">
                    {anchor.text}
                  </span>
                  <span className="ml-auto text-caption text-text-tertiary">{meta.label}</span>
                  {isSelected && (
                    <span className="text-label font-semibold uppercase tracking-wider text-brand shrink-0">
                      Highlighted
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Preview surface. */}
      <div className="rounded-sm border border-border-subtle bg-surface-secondary overflow-auto max-h-[480px] p-8">
        {loadState === "loading" && (
          <div className="flex items-center gap-8 text-caption text-text-tertiary p-12">
            <Loader2 size={14} className="animate-spin" aria-hidden />
            <span>Loading preview…</span>
          </div>
        )}

        {loadState === "error" && (
          <div className="flex items-start gap-8 text-caption text-text-secondary p-12">
            <FileWarning size={14} className="text-text-tertiary shrink-0 mt-2" aria-hidden />
            <span>{error ?? "Preview unavailable."}</span>
          </div>
        )}

        {loadState === "ready" && format === "pdf" && (
          <div
            className="relative inline-block max-w-full"
            data-testid="pdf-canvas-layer"
            // `isolation: isolate` scopes the overlays' multiply blend to this
            // layer (canvas + boxes) so it never mixes with page content behind.
            style={{ isolation: "isolate" }}
          >
            <canvas ref={canvasRef} aria-label={`PDF preview of ${attachment.name}`} className="max-w-full" />
            {/* In-document highlight overlays, drawn only once the page has
                actually painted (`pageRendered`) — without that guard the
                boxes would float over a blank canvas when PDF.js can't
                render, which reads as garbled bars rather than highlights.
                Two sources, one treatment: backend-recorded spatial bboxes
                (ADR-045) and best-effort text-layer boxes for text-derived
                anchors that uniquely locate on this page (Phase 1.5). The
                safety bar above stays the authoritative surface; an
                ambiguous/unlocated anchor has no box. */}
            {pageRendered && overlays.map((o) => {
              const isSelected = selectedRef === o.supportsRef;
              return (
                <div
                  key={o.supportsRef}
                  data-testid={o.kind === "spatial" ? "spatial-overlay" : "text-layer-overlay"}
                  data-supports-ref={o.supportsRef}
                  data-selected={isSelected || undefined}
                  aria-hidden
                  className="absolute pointer-events-none rounded-sm transition-[box-shadow,opacity] duration-normal"
                  style={{
                    left: `${o.leftPct}%`,
                    top: `${o.topPct}%`,
                    width: `${o.widthPct}%`,
                    height: `${o.heightPct}%`,
                    // Selected overlay is emphasised (thicker border + ring);
                    // unselected ones dim slightly so the foregrounded box
                    // stands out when a ref is active.
                    border: isSelected
                      ? "3px solid var(--color-brand)"
                      : "2px solid var(--color-brand)",
                    boxShadow: isSelected ? "0 0 0 3px var(--color-brand-ring)" : "none",
                    opacity: selectedRef && !isSelected ? 0.4 : 1,
                    // Translucent highlighter wash, NOT an opaque fill — the box
                    // sits above the PDF canvas, so the document text under it
                    // must remain legible (an opaque fill hides the evidence).
                    background: "var(--color-highlight-evidence)",
                    // Composite like a real highlighter: multiply the wash AND
                    // the border with the canvas instead of painting over it, so
                    // black text shows through at ANY scale/DPI. On a downscaled
                    // mobile canvas the box gets short and the fixed-width border
                    // would otherwise close over the tiny text; multiply keeps
                    // dark glyphs dark (text × tint = text), never hidden.
                    mixBlendMode: "multiply",
                  }}
                />
              );
            })}
          </div>
        )}

        {loadState === "ready" && format === "image" && objectUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- preview blob, not a static asset
          <img src={objectUrl} alt={`Preview of ${attachment.name}`} className="max-w-full h-auto" />
        )}

        {loadState === "ready" && format === "text" && docText !== null && (
          <pre className="m-0 whitespace-pre-wrap break-words font-mono text-caption text-text-primary">
            {docText}
          </pre>
        )}

        {loadState === "ready" && (format === null || format === undefined) && (
          <div className="flex items-start gap-8 text-caption text-text-secondary p-12">
            <FileWarning size={14} className="text-text-tertiary shrink-0 mt-2" aria-hidden />
            <span>
              This file type can&apos;t be previewed safely. Download it to view.
            </span>
          </div>
        )}
      </div>

      {/* Download — always available, even when preview is denied/failed. */}
      <div className="mt-8 flex">
        <AttachmentDownloadButton caseId={caseId} attachment={attachment} />
      </div>
    </section>
  );
}
