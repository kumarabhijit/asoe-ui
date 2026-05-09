/**
 * CaseDetailPanel — case-level detail surface (ADR-038 §6 / Phase H.6).
 *
 * Renders the case header (source / channel / SLA / status) and
 * delegates per-issue evidence to the existing `*Section.tsx`
 * components in src/app/exceptions/. Future child-record rendering
 * (one stack entry per attached ExceptionRecord) lands as Phase H.6
 * iterates; this commit ships the case-header anatomy and the
 * data-presence dispatch contract.
 *
 * Architecturally:
 *   * Pure projector (Guardrail #6) — all evidence comes from the
 *     OrderCase prop or the child records loaded via the existing
 *     /api/v1/exceptions/* surfaces. No client-side composition.
 *   * No per-intent dispatch (Guardrail #1) — sections mount via
 *     data-presence on the analysis payload exactly as they do
 *     today on /exceptions/[id].
 *   * <EvidenceBlock> renders all audit-bearing case fields. The
 *     three legal presence states are enforced by that primitive.
 */

"use client";

import { Mail, PackageCheck, Clock } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import type { CaseSource, OrderCase } from "@/types/cases";

import { slaSnapshot } from "./page";


const SOURCE_ICON: Record<CaseSource | "default", React.ReactNode> = {
  manual_order: <Mail size={14} aria-hidden />,
  automated_order: <PackageCheck size={14} aria-hidden />,
  default: <Clock size={14} aria-hidden />,
};

const SOURCE_LABEL: Record<CaseSource | "default", string> = {
  manual_order: "Manual Order",
  automated_order: "Automated Order",
  default: "Unknown source",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN_AGENT_PROCESSING: "Agent processing",
  OPEN_AWAITING_HUMAN: "Awaiting review",
  OPEN_AWAITING_BUYER: "Awaiting buyer",
  OPEN_AWAITING_ERP: "Awaiting ERP",
  RESOLVED: "Resolved",
  FAILED: "Failed",
  BLOCKED: "Blocked",
};


export interface CaseDetailPanelProps {
  orderCase: OrderCase;
}

export function CaseDetailPanel({ orderCase }: CaseDetailPanelProps) {
  const sla = slaSnapshot(orderCase);

  return (
    <div className="space-y-24">
      {/* ── Case header ──────────────────────────────────────────── */}
      <header
        aria-label="Case header"
        className="bg-surface-primary border border-border rounded-md p-16 shadow-xs"
      >
        <div className="flex items-center gap-12 mb-12">
          <Badge variant="neutral" size="sm">
            {SOURCE_ICON[orderCase.source as CaseSource] ?? SOURCE_ICON.default}
            <span className="ml-4">
              {SOURCE_LABEL[orderCase.source as CaseSource] ?? SOURCE_LABEL.default}
            </span>
          </Badge>
          <Badge variant="neutral" size="sm">
            {orderCase.source_channel}
          </Badge>
          <span className="ml-auto text-caption text-text-tertiary uppercase tracking-wider">
            {STATUS_LABEL[orderCase.status] ?? orderCase.status}
          </span>
        </div>

        <h1 className="text-display font-semibold text-text-primary mb-12">
          Case <code className="font-mono">{orderCase.case_id}</code>
        </h1>

        <dl className="grid grid-cols-2 gap-x-24 gap-y-12 text-body">
          <EvidenceBlock tier="audit-bearing" value={orderCase.customer_po_number}>
            {(v) => (
              <Field label="Customer PO" value={String(v)} mono />
            )}
          </EvidenceBlock>
          <EvidenceBlock tier="contextual" value={orderCase.sales_order_id}>
            {(v) => (
              <Field label="Sales order" value={String(v)} mono />
            )}
          </EvidenceBlock>
          <EvidenceBlock tier="contextual" value={orderCase.customer_id}>
            {(v) => <Field label="Customer" value={String(v)} />}
          </EvidenceBlock>
          <Field label="Opened" value={orderCase.opened_at} mono />
          <EvidenceBlock tier="conditional"
                         value={sla.deadline}
                         predicateHolds={sla.band !== "none"}>
            {(v) => (
              <Field
                label={`SLA deadline · ${sla.label}`}
                value={String(v)}
                mono
              />
            )}
          </EvidenceBlock>
          <EvidenceBlock tier="contextual" value={orderCase.bundle_version_at_open}>
            {(v) => <Field label="Skill bundle at open" value={String(v)} mono />}
          </EvidenceBlock>
        </dl>
      </header>

      {/* ── Children placeholder (Phase H.6 iteration target) ────── */}
      <section
        aria-label="Children"
        className="bg-surface-primary border border-border rounded-md p-16 shadow-xs"
      >
        <h2 className="text-heading font-semibold text-text-primary mb-8">
          Attached records
        </h2>
        <p className="text-text-secondary text-body leading-normal">
          Per-event records (extraction, validation findings, agent
          decisions) attach to this case and render via the existing
          enrichment-section components. The next Phase H.6 iteration
          wires the case → child-record join so this section stacks
          one entry per <code className="font-mono">ExceptionRecord</code>{" "}
          attached to <code className="font-mono">{orderCase.case_id}</code>.
        </p>
      </section>
    </div>
  );
}


/* ── Tiny field renderer ──────────────────────────────────────── */

interface FieldProps {
  label: string;
  value: string;
  mono?: boolean;
}

function Field({ label, value, mono = false }: FieldProps) {
  return (
    <div>
      <dt className="text-label uppercase tracking-wider text-text-quaternary mb-2">
        {label}
      </dt>
      <dd className={mono ? "font-mono text-text-primary" : "text-text-primary"}>
        {value}
      </dd>
    </div>
  );
}
