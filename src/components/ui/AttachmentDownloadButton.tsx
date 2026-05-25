/**
 * AttachmentDownloadButton — downloads a stored attachment's bytes (ADR-043).
 *
 * Encapsulates the byte fetch so section components stay dumb projectors: they
 * render this button rather than importing the API client / calling `fetch`
 * themselves (Guardrail #6 + the EmailSourceSection caseId-wiring lock). Bytes
 * come via `attachmentsApi` (mock mode returns a synthesized blob; real mode
 * hits the RBAC-gated download endpoint).
 */
"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { attachmentsApi } from "@/lib/api";
import type { EmailAttachmentManifestEntry } from "@/types/exceptions";

interface AttachmentDownloadButtonProps {
  caseId: string;
  attachment: EmailAttachmentManifestEntry;
  /** Compact icon-only variant for dense list rows. */
  compact?: boolean;
}

export function AttachmentDownloadButton({
  caseId,
  attachment,
  compact = false,
}: AttachmentDownloadButtonProps) {
  const [busy, setBusy] = useState(false);
  const disabled = busy || !attachment.attachment_id;

  async function handleDownload() {
    if (!attachment.attachment_id || busy) return;
    setBusy(true);
    try {
      const blob = await attachmentsApi.getBlob(caseId, attachment.attachment_id, {
        mimeType: attachment.mime_type,
        fileName: attachment.name,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name || "attachment";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={disabled}
      aria-label={`Download ${attachment.name}`}
      className="inline-flex items-center gap-4 px-8 py-4 rounded-sm border border-border-subtle text-caption text-text-secondary hover:bg-surface-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-50"
    >
      {busy ? (
        <Loader2 size={12} className="animate-spin" aria-hidden />
      ) : (
        <Download size={12} aria-hidden />
      )}
      {compact ? null : <span>Download</span>}
    </button>
  );
}
