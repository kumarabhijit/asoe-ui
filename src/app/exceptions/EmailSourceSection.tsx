/**
 * EmailSourceSection — Inbound email source-of-truth substrate
 * (ADR-034 Phase G).
 *
 * Renders ONLY when `analysis.email_source` is present. Backend
 * ownership: `EmailOrderEntryRecipe.py` SECONDARY adapter
 * (`api/analysis_adapters.py::adapt_email_source`) projects the
 * `email_intake/fetch_message` gateway response from
 * `enrichment_context.email_source_context` into `EmailSourceData`.
 *
 * Per the ADR-034 §6 (PO-driven IA correction), the CSA authorising
 * an email-channel order sees the inbound email metadata + body
 * excerpt + attachment manifest on the SAME detail surface as the
 * agent's recommendation — no tab switch between an /inbox view and
 * the /exceptions queue.
 *
 * Compliance posture (Pillar 3 — dumb projector):
 *   * Audit-bearing fields (from_address, received_at, subject,
 *     body_hash, attachment_manifest) come straight from
 *     `data.<field>`. Absence flows through `<EvidenceBlock>` —
 *     never an ad-hoc "—" / "N/A" placeholder.
 *   * `body_excerpt` is contextual: absent → block omitted entirely.
 */
"use client";

import Link from "next/link";
import { ExternalLink, Mail, Paperclip, Hash, Clock } from "lucide-react";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import type { EmailSourceData } from "@/types/exceptions";

interface EmailSourceSectionProps {
  data: EmailSourceData;
}

/**
 * Pretty-print a byte count without inventing precision the substrate
 * doesn't have. Pure function, no I/O.
 */
function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailSourceSection({ data }: EmailSourceSectionProps) {
  return (
    <section
      aria-label="Source email"
      className="bg-surface-primary rounded-md shadow-sm p-16"
    >
      {/* Section header */}
      <div className="flex items-center gap-8 mb-12">
        <Mail size={14} className="text-text-tertiary" />
        <span className="text-subhead font-semibold text-text-primary">
          Source Email
        </span>
        {/* ADR-034 Phase G — back-link to the Inbox row when the
            correlation id is present. Contextual: absent when the
            upstream email-intelligence-agent integration hasn't
            shipped (Phase F / proposed ADR-036). */}
        <EvidenceBlock tier="contextual" value={data.source_email_id}>
          {(value) => (
            <Link
              href={`/inbox?msg=${encodeURIComponent(String(value))}`}
              className="ml-auto inline-flex items-center gap-4 text-caption font-semibold text-brand hover:underline"
              aria-label="View source email in inbox"
            >
              View source email
              <ExternalLink size={12} aria-hidden />
            </Link>
          )}
        </EvidenceBlock>
      </div>

      {/* From + Received */}
      <div className="grid grid-cols-2 gap-12 mb-12">
        <EvidenceBlock tier="audit-bearing" value={data.from_address}>
          {(value) => (
            <Field
              label="From"
              value={String(value)}
              monospace
            />
          )}
        </EvidenceBlock>
        <EvidenceBlock tier="audit-bearing" value={data.received_at}>
          {(value) => (
            <Field
              label="Received"
              value={String(value)}
              icon={<Clock size={12} className="text-text-tertiary" aria-hidden />}
              monospace
            />
          )}
        </EvidenceBlock>
      </div>

      {/* Subject */}
      <div className="mb-12">
        <EvidenceBlock tier="audit-bearing" value={data.subject}>
          {(value) => (
            <Field label="Subject" value={String(value)} />
          )}
        </EvidenceBlock>
      </div>

      {/* Body excerpt — contextual; suppressed entirely when absent */}
      <EvidenceBlock tier="contextual" value={data.body_excerpt}>
        {(value) => (
          <div className="mb-12 p-12 bg-surface-secondary rounded-sm border border-border-subtle">
            <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
              Body excerpt
            </div>
            <p className="m-0 text-body text-text-secondary leading-normal whitespace-pre-wrap">
              {String(value)}
            </p>
          </div>
        )}
      </EvidenceBlock>

      {/* Attachment manifest */}
      <EvidenceBlock
        tier="audit-bearing"
        value={data.attachment_manifest}
      >
        {(value) => {
          const manifest = value as EmailSourceData["attachment_manifest"];
          // Audit-bearing: an empty list is still meaningfully populated
          // (operator sees "no attachments"). EvidenceBlock's isPresent
          // treats [] as absent, so the audit-bearing absence path
          // applies in dev — but in practice an email order without any
          // attachment is a corner case that warrants the dev warning.
          return (
            <div>
              <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8 flex items-center gap-6">
                <Paperclip size={12} aria-hidden />
                Attachments
                <span className="text-text-tertiary font-normal lowercase">
                  ({manifest.length})
                </span>
              </div>
              <ul className="m-0 p-0 list-none">
                {manifest.map((entry, idx) => (
                  <li
                    key={`${entry.name}-${idx}`}
                    className="flex items-center gap-10 px-10 py-8 bg-surface-secondary rounded-sm border-b border-border-subtle last:border-b-0"
                  >
                    <span className="font-mono font-semibold text-body text-text-primary truncate">
                      {entry.name}
                    </span>
                    <span className="text-caption text-text-tertiary">
                      {entry.mime_type}
                    </span>
                    <span className="ml-auto text-caption text-text-tertiary font-mono">
                      {formatBytes(entry.bytes)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }}
      </EvidenceBlock>

      {/* Body hash — audit-trail substrate. Surfaced last because it's
          for tamper-detection, not human consumption. */}
      <div className="mt-12 pt-12 border-t border-border-subtle">
        <EvidenceBlock tier="audit-bearing" value={data.body_hash}>
          {(value) => (
            <div className="flex items-start gap-8 text-caption">
              <Hash size={12} className="text-text-quaternary shrink-0 mt-2" aria-hidden />
              <span className="text-text-tertiary font-semibold">Body hash:</span>
              <span className="font-mono text-text-tertiary break-all">
                {String(value)}
              </span>
            </div>
          )}
        </EvidenceBlock>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  icon,
  monospace = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  monospace?: boolean;
}) {
  return (
    <div>
      <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4 flex items-center gap-6">
        {icon}
        {label}
      </div>
      <div
        className={
          monospace
            ? "font-mono text-body text-text-primary break-all"
            : "text-body text-text-primary"
        }
      >
        {value}
      </div>
    </div>
  );
}
