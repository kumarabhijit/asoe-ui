/**
 * OrderEntrySection — Customer Inbox "Order Entry" tab (ADR-042 Phase 3).
 *
 * Dumb projector (Guardrail #6): renders the extracted order form
 * (`analysis.order_entry_extraction`) exactly as the extraction gateway
 * supplies it (preview-only until that gateway lands). The agent's
 * recommendation / autonomy live separately on `EmailOrderEntrySection`.
 * Optional fields flow through <EvidenceBlock> — never an ad-hoc placeholder.
 *
 * This is read-only review evidence. The ERP-submit action is a disposition
 * on the action surface, not part of this projector (no business logic here).
 */
"use client";

import { ClipboardList, AlertTriangle } from "lucide-react";

import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import type {
  OrderEntryExtraction,
  OrderEntryValidationFlag,
} from "@/types/exceptions";

interface OrderEntrySectionProps {
  data: OrderEntryExtraction;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function flagClasses(severity: string): string {
  // Visual mapping with a default fallback (allowed — not enum dispatch).
  switch (severity.toUpperCase()) {
    case "ERROR":
      return "text-status-error";
    case "WARNING":
      return "text-status-warning";
    default:
      return "text-text-tertiary";
  }
}

export function OrderEntrySection({ data }: OrderEntrySectionProps) {
  const { header } = data;
  return (
    <section
      aria-label="Extracted order"
      className="bg-surface-primary rounded-md shadow-sm p-16"
    >
      <div className="flex items-center gap-8 mb-12">
        <ClipboardList size={14} className="text-text-tertiary" aria-hidden />
        <span className="text-subhead font-semibold text-text-primary">
          Extracted order
        </span>
        <span className="ml-auto text-caption text-text-tertiary font-mono">
          {data.source_type} · {Math.round(data.confidence * 100)}%
        </span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-2 gap-12 mb-12">
        <EvidenceBlock tier="audit-bearing" value={header.customer_po}>
          {(v) => <Field label="Customer PO" value={String(v)} monospace />}
        </EvidenceBlock>
        <EvidenceBlock tier="contextual" value={header.requested_date}>
          {(v) => <Field label="Requested date" value={String(v)} monospace />}
        </EvidenceBlock>
        <EvidenceBlock tier="contextual" value={data.customer_name}>
          {(v) => <Field label="Customer" value={String(v)} />}
        </EvidenceBlock>
        <EvidenceBlock tier="contextual" value={data.customer_bp}>
          {(v) => <Field label="BP #" value={String(v)} monospace />}
        </EvidenceBlock>
      </div>

      {/* Line items */}
      <div className="mb-12">
        <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
          Line items ({data.line_items.length})
        </div>
        <ul className="m-0 p-0 list-none flex flex-col gap-4">
          {data.line_items.map((li, idx) => (
            <li
              key={`${li.line_num}-${idx}`}
              className="flex items-center gap-10 px-10 py-8 bg-surface-secondary rounded-sm border border-border-subtle"
            >
              <span className="font-mono text-caption text-text-tertiary w-32 shrink-0">
                {li.line_num}
              </span>
              <span className="font-mono font-semibold text-body text-text-primary truncate">
                {li.material}
              </span>
              <span className="ml-auto font-mono text-body text-text-primary">
                {li.quantity}
                {li.uom ? ` ${li.uom}` : ""}
              </span>
              <EvidenceBlock tier="audit-bearing" value={li.unit_price}>
                {(v) => (
                  <span className="font-mono text-body text-text-secondary w-80 text-right">
                    {formatUsd(Number(v))}
                  </span>
                )}
              </EvidenceBlock>
            </li>
          ))}
        </ul>
      </div>

      {/* Validation flags — contextual; suppressed entirely when none. */}
      <EvidenceBlock tier="contextual" value={data.validation_flags}>
        {(value) => {
          const flags = value as OrderEntryValidationFlag[];
          return (
            <div className="pt-12 border-t border-border-subtle flex flex-col gap-4">
              {flags.map((f, idx) => (
                <div
                  key={`${f.field}-${idx}`}
                  className="flex items-start gap-6 text-caption"
                >
                  <AlertTriangle
                    size={12}
                    className={`${flagClasses(f.severity)} shrink-0 mt-2`}
                    aria-hidden
                  />
                  <span className={`font-semibold ${flagClasses(f.severity)}`}>
                    {f.severity}
                  </span>
                  <span className="text-text-tertiary">
                    {f.field}: {f.message}
                  </span>
                </div>
              ))}
            </div>
          );
        }}
      </EvidenceBlock>
    </section>
  );
}

function Field({
  label,
  value,
  monospace = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div>
      <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
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
