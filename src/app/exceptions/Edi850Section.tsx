/**
 * Edi850Section — Customer Inbox "EDI 850 Audit" tab (ADR-042 Phase 5).
 *
 * Dumb projector (Guardrail #6): renders the deterministically built ANSI X12
 * 5010 purchase order (`analysis.edi_850_audit`) exactly as the edi_850 builder
 * supplies it (preview-only until that producer lands). No business logic, no
 * client-side segment assembly — the builder owns construction in asoe2.
 *
 * Three sub-views mirror the prototype EDI850Viewer: Decoded (human-readable
 * cards), Raw X12 (terminal-style segment dump + copy), and Segment Map
 * (segment → decoded meaning). The view switch is local presentation state.
 */
"use client";

import { Fragment, useState } from "react";
import { FileText, Code2, Map, Copy, Check } from "lucide-react";

import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import type {
  Edi850Document,
  Edi850LineItem,
  Edi850Party,
  Edi850Segment,
} from "@/types/exceptions";

interface Edi850SectionProps {
  data: Edi850Document;
}

type View = "decoded" | "raw" | "map";

const VIEWS: { id: View; label: string; icon: typeof FileText }[] = [
  { id: "decoded", label: "Decoded", icon: FileText },
  { id: "raw", label: "Raw X12", icon: Code2 },
  { id: "map", label: "Segment Map", icon: Map },
];

// Visual mapping (allowed — default fallback, not enum dispatch). Buckets the
// X12 segment groups onto semantic colour tokens for the legend / raw view.
function groupClass(group: string): string {
  switch (group) {
    case "envelope":
      return "text-info";
    case "header":
      return "text-brand";
    case "dates":
      return "text-success";
    case "party":
      return "text-warning";
    case "line":
      return "text-error";
    default:
      return "text-text-tertiary";
  }
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function Edi850Section({ data }: Edi850SectionProps) {
  const [view, setView] = useState<View>("decoded");

  return (
    <section
      aria-label="EDI 850 purchase order"
      className="bg-surface-primary rounded-md shadow-sm p-16"
    >
      <div className="flex items-center gap-8 mb-12">
        <FileText size={14} className="text-text-tertiary" aria-hidden />
        <span className="text-subhead font-semibold text-text-primary">
          EDI 850 Audit
        </span>
        <span className="ml-auto text-caption text-text-tertiary font-mono">
          {data.standard} · {data.transaction_set}
        </span>
      </div>

      {/* View switcher */}
      <div
        role="tablist"
        aria-label="EDI 850 view"
        className="flex gap-4 mb-12 border-b border-border-subtle"
      >
        {VIEWS.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(id)}
              className={`flex items-center gap-6 px-10 py-6 text-caption font-semibold border-b-2 -mb-px transition-colors ${
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-text-tertiary hover:text-text-secondary"
              }`}
            >
              <Icon size={12} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      {view === "decoded" && <DecodedView data={data} />}
      {view === "raw" && <RawView data={data} />}
      {view === "map" && <SegmentMapView segments={data.segments} />}
    </section>
  );
}

function DecodedView({ data }: { data: Edi850Document }) {
  const { envelope, header, totals } = data;
  return (
    <div className="flex flex-col gap-16">
      {/* Interchange envelope */}
      <Card title="Interchange Envelope">
        <div className="grid grid-cols-2 gap-12">
          <Field label="Sender ID" value={envelope.sender_id} monospace />
          <Field label="Receiver ID" value={envelope.receiver_id} monospace />
          <Field
            label="Interchange Ctrl #"
            value={envelope.interchange_control_number}
            monospace
          />
          <Field label="X12 Version" value={envelope.x12_version} monospace />
        </div>
      </Card>

      {/* PO header */}
      <Card title="PO Header">
        <div className="grid grid-cols-2 gap-12">
          <Field label="PO Number" value={header.po_number} monospace />
          <Field
            label="Purpose"
            value={`${header.purpose_code} / ${header.po_type}`}
            monospace
          />
          <EvidenceBlock tier="contextual" value={header.po_date}>
            {(v) => <Field label="PO Date" value={String(v)} monospace />}
          </EvidenceBlock>
          <EvidenceBlock tier="contextual" value={header.currency}>
            {(v) => <Field label="Currency" value={String(v)} monospace />}
          </EvidenceBlock>
          <EvidenceBlock
            tier="contextual"
            value={header.requested_delivery_date}
          >
            {(v) => (
              <Field label="Requested Delivery" value={String(v)} monospace />
            )}
          </EvidenceBlock>
        </div>
      </Card>

      {/* Party information */}
      <Card title="Party Information">
        <ul className="m-0 p-0 list-none flex flex-col gap-8">
          {data.parties.map((p, idx) => (
            <PartyRow key={`${p.entity_code}-${idx}`} party={p} />
          ))}
        </ul>
      </Card>

      {/* Line items */}
      <Card title={`Line Items (${data.line_items.length})`}>
        {data.line_items.length === 0 ? (
          <div className="text-caption text-text-tertiary">No line items.</div>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-4">
            {data.line_items.map((li, idx) => (
              <LineRow key={`${li.line_num}-${idx}`} line={li} />
            ))}
          </ul>
        )}
      </Card>

      {/* CTT totals */}
      <Card title="Totals (CTT)">
        <div className="grid grid-cols-3 gap-12">
          <Field label="Line Items" value={String(totals.total_line_items)} monospace />
          <Field label="Total Qty" value={String(totals.total_quantity)} monospace />
          <EvidenceBlock tier="contextual" value={totals.total_amount}>
            {(v) => (
              <Field label="Total Amount" value={formatUsd(Number(v))} monospace />
            )}
          </EvidenceBlock>
        </div>
      </Card>
    </div>
  );
}

function PartyRow({ party }: { party: Edi850Party }) {
  return (
    <li className="flex items-center gap-10 px-10 py-8 bg-surface-secondary rounded-sm border border-border-subtle">
      <span className="font-mono text-caption text-text-tertiary w-32 shrink-0">
        {party.entity_code}
      </span>
      <div className="min-w-0">
        <div className="text-body text-text-primary font-medium truncate">
          {party.name}
        </div>
        <div className="text-caption text-text-tertiary">{party.role}</div>
      </div>
      <EvidenceBlock tier="contextual" value={party.id_value}>
        {(v) => (
          <span className="ml-auto font-mono text-caption text-text-secondary">
            {party.id_qualifier ? `${party.id_qualifier}:` : ""}
            {String(v)}
          </span>
        )}
      </EvidenceBlock>
    </li>
  );
}

function LineRow({ line }: { line: Edi850LineItem }) {
  return (
    <li className="flex items-center gap-10 px-10 py-8 bg-surface-secondary rounded-sm border border-border-subtle">
      <span className="font-mono text-caption text-text-tertiary w-32 shrink-0">
        {line.line_num}
      </span>
      <EvidenceBlock tier="contextual" value={line.product_id}>
        {(v) => (
          <span className="font-mono font-semibold text-body text-text-primary truncate">
            {String(v)}
          </span>
        )}
      </EvidenceBlock>
      <span className="ml-auto font-mono text-body text-text-primary">
        {line.quantity} {line.uom}
      </span>
      <EvidenceBlock tier="contextual" value={line.unit_price}>
        {(v) => (
          <span className="font-mono text-body text-text-secondary w-80 text-right">
            {formatUsd(Number(v))}
          </span>
        )}
      </EvidenceBlock>
      <EvidenceBlock tier="contextual" value={line.extended_amount}>
        {(v) => (
          <span className="font-mono text-body text-text-primary w-96 text-right">
            {formatUsd(Number(v))}
          </span>
        )}
      </EvidenceBlock>
    </li>
  );
}

function RawView({ data }: { data: Edi850Document }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.raw_x12);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — silent no-op.
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-8">
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-6 px-10 py-6 text-caption font-semibold text-text-secondary hover:text-text-primary rounded-sm border border-border-subtle"
        >
          {copied ? (
            <Check size={12} className="text-success" aria-hidden />
          ) : (
            <Copy size={12} aria-hidden />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="m-0 p-12 bg-surface-secondary rounded-sm border border-border-subtle overflow-x-auto text-caption font-mono leading-relaxed"
        aria-label="Raw X12 segments"
      >
        {data.segments.map((seg, idx) => (
          <div key={`${seg.seg_id}-${idx}`} className={groupClass(seg.group)}>
            {seg.raw}
          </div>
        ))}
      </pre>
    </div>
  );
}

function SegmentMapView({ segments }: { segments: Edi850Segment[] }) {
  return (
    <div>
      <div className="grid grid-cols-[120px_1fr] gap-x-12 gap-y-6">
        <div className="text-label font-bold uppercase tracking-wider text-text-quaternary">
          Segment
        </div>
        <div className="text-label font-bold uppercase tracking-wider text-text-quaternary">
          Decoded Meaning
        </div>
        {segments.map((seg, idx) => (
          <Fragment key={`${seg.seg_id}-${idx}`}>
            <div
              className={`font-mono text-caption font-semibold ${groupClass(seg.group)}`}
            >
              {seg.seg_id}
            </div>
            <div className="text-caption text-text-secondary">{seg.meaning}</div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
        {title}
      </div>
      {children}
    </div>
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
