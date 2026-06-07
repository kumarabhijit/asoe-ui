/**
 * ErasureCertificateButton — downloads the regulator-facing erasure
 * certificate (PARITY-0.5 / PARITY-8).
 *
 * The backend endpoint
 * (GET /api/v1/attachments/{id}/erasure-certificate) returns the
 * PII-free tombstone plus the hash-chain proof an auditor or regulator
 * independently verifies (ADR-023). The endpoint is manager+admin
 * only and tenant-scoped — both invariants live on the backend; this
 * component is a dumb projector that triggers the fetch and packages
 * the JSON as a downloadable file.
 *
 * Why a separate primitive (not a generic download button):
 *   - the certificate is JSON, not bytes, so we synthesise the Blob
 *     from the response rather than streaming.
 *   - the filename encodes the attachment id + erased-at timestamp so
 *     the regulator can correlate against their request log.
 *   - the operator-facing label is deliberately distinct from
 *     "download attachment" — this is proof OF erasure, not the
 *     erased bytes (which by definition no longer exist).
 *
 * Per Guardrail #6 the component is a dumb projector — it does not
 * blend the certificate with event fields, it only renders the
 * `<EvidenceBlock>` slot for the certificate metadata that the
 * containing section already requested.
 */
"use client";

import { useState } from "react";
import { FileCheck, Loader2 } from "lucide-react";

import { attachmentsApi } from "@/lib/api";
import type { AttachmentErasureCertificate } from "@/lib/api";

interface ErasureCertificateButtonProps {
  attachmentId: string;
  /** Optional callback fired after a successful fetch (e.g. to refresh
   * an inline preview of the certificate metadata). */
  onCertificate?: (cert: AttachmentErasureCertificate) => void;
  /** Compact icon-only variant for dense list rows. */
  compact?: boolean;
}

export function ErasureCertificateButton({
  attachmentId,
  onCertificate,
  compact = false,
}: ErasureCertificateButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const cert = await attachmentsApi.getErasureCertificate(attachmentId);
      onCertificate?.(cert);
      const json = JSON.stringify(cert, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      // Filename encodes the attachment id + erased-at so a regulator
      // can correlate against their request log without opening the
      // file first.
      const erasedAt = cert.tombstone.erased_at?.replace(/[:.]/g, "-") ?? "unknown";
      const filename = `erasure-certificate-${attachmentId}-${erasedAt}.json`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const label = compact ? null : <span>Download erasure certificate</span>;

  return (
    <div className="inline-flex flex-col gap-4">
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        aria-busy={busy || undefined}
        aria-label={`Download erasure certificate for ${attachmentId}`}
        className="inline-flex items-center gap-4 px-8 py-4 rounded-sm border border-border-subtle text-caption text-text-secondary hover:bg-surface-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:opacity-50"
      >
        {busy ? (
          <Loader2 size={12} className="animate-spin" aria-hidden />
        ) : (
          <FileCheck size={12} aria-hidden />
        )}
        {label}
      </button>
      {error ? (
        // role="alert" already implies an assertive live region; pairing it
        // with aria-live="polite" is contradictory, so we keep only the role.
        <div role="alert" className="text-caption text-error">
          {error}
        </div>
      ) : null}
    </div>
  );
}
