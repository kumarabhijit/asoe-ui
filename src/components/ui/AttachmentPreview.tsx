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
 * NOTE: precise pixel overlays on the PDF canvas are ADR-045 (spatial) territory;
 * Phase-1 PDF highlighting verifies anchors against the extracted text layer and
 * reports status via the safety bar. PDF.js rendering is browser-only and
 * degrades to "position unconfirmed" if extraction fails.
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
import type { EmailAttachmentManifestEntry, EvidenceAnchor } from "@/types/exceptions";

interface AttachmentPreviewProps {
  /** Threaded explicitly from ExceptionDetailPanel (provenance must be visible
   *  on a SOX surface — not React context). */
  caseId: string;
  attachment: EmailAttachmentManifestEntry;
  anchors: EvidenceAnchor[];
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
): Promise<string | null> {
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
    if (canvas) {
      const viewport = page.getViewport({ scale: 1.25 });
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      }
    }

    let text = "";
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = p === 1 ? page : await doc.getPage(p);
      const content = await pg.getTextContent();
      text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + " ";
    }
    return text;
  } catch {
    // Browser/bundler-specific failure — degrade to position-unconfirmed.
    return null;
  }
}

export function AttachmentPreview({ caseId, attachment, anchors }: AttachmentPreviewProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [format, setFormat] = useState<PreviewFormat | null | undefined>(undefined);
  const [docText, setDocText] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
          const text = await renderPdfAndExtractText(bytes, canvasRef.current);
          if (cancelled) return;
          setDocText(text);
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
            return (
              <li
                key={`${anchor.supports_ref}-${idx}`}
                data-status={status}
                className="flex items-center gap-8 px-10 py-6 bg-surface-secondary rounded-sm"
              >
                <meta.Icon size={14} className="shrink-0 text-text-tertiary" aria-hidden />
                <span className="text-body font-semibold text-text-primary">
                  {anchor.label}
                </span>
                <span className="font-mono text-caption text-text-secondary truncate">
                  {anchor.text}
                </span>
                <span className="ml-auto text-caption text-text-tertiary">{meta.label}</span>
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
          <canvas ref={canvasRef} aria-label={`PDF preview of ${attachment.name}`} className="max-w-full" />
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
