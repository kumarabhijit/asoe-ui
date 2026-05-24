/**
 * SapDataSection — Customer Inbox "SAP Data" tab (ADR-042 Phase 2).
 *
 * Dumb projector (Guardrail #6): renders `analysis.sap_data_analysis` exactly
 * as the SAP gateway read supplies it (preview-only until that composer
 * adapter lands). Mounts in `ExceptionDetailPanel` by data presence.
 *
 * `system` / `validation_status` / `order_value_usd` are audit-bearing (the
 * decision is scoped to a specific SAP order, state, and value);
 * `sap_doc_number` is a contextual reference. Optional fields flow through
 * <EvidenceBlock> — never an ad-hoc "—" placeholder.
 */
"use client";

import { Database, FileText } from "lucide-react";

import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import type { SapDataAnalysisData } from "@/types/exceptions";

interface SapDataSectionProps {
  data: SapDataAnalysisData;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function SapDataSection({ data }: SapDataSectionProps) {
  return (
    <section
      aria-label="SAP data"
      className="bg-surface-primary rounded-md shadow-sm p-16"
    >
      <div className="flex items-center gap-8 mb-12">
        <Database size={14} className="text-text-tertiary" aria-hidden />
        <span className="text-subhead font-semibold text-text-primary">
          SAP data
        </span>
      </div>

      <div className="grid grid-cols-2 gap-12">
        <Field label="System" value={data.system} monospace />
        <Field label="Validation status" value={data.validation_status} />
      </div>

      {/* Order value — audit-bearing; absence flows through EvidenceBlock. */}
      <div className="mt-12">
        <EvidenceBlock tier="audit-bearing" value={data.order_value_usd}>
          {(value) => (
            <Field label="Order value" value={formatUsd(Number(value))} monospace />
          )}
        </EvidenceBlock>
      </div>

      {/* SAP doc number — contextual reference; suppressed when absent. */}
      <div className="mt-12 pt-12 border-t border-border-subtle">
        <EvidenceBlock tier="contextual" value={data.sap_doc_number}>
          {(value) => (
            <div className="flex items-center gap-8 text-caption">
              <FileText size={12} className="text-text-quaternary shrink-0" aria-hidden />
              <span className="text-text-tertiary font-semibold">SAP doc:</span>
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
