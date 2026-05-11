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

import Link from "next/link";
import { Mail, PackageCheck, Clock, ShieldAlert, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import { PolicyHitBadge } from "@/components/ui/PolicyHitBadge";
import type { CaseSource, OrderCase, SlaBand } from "@/types/cases";
import type { ExceptionDetailResponse } from "@/types/api";
import { STATUS_LABEL, lastActivityLabel, sourceChannelLabel } from "@/lib/cases";
import { useSlaTicker } from "@/hooks/useSlaTicker";

import { slaSnapshot } from "./page";

const SLA_BAND_VARIANT: Record<SlaBand, "error" | "warning" | "success" | "neutral"> = {
  breached: "error",
  at_risk: "warning",
  today: "warning",
  comfortable: "success",
  none: "neutral",
};


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

// STATUS_LABEL is imported from src/lib/cases.ts — the consolidated
// shared map per Phase 28.5.x §D1.


export interface CaseDetailPanelProps {
  orderCase: OrderCase;
  /**
   * Compliance Shadow policy hits surfaced on this case, in
   * `combine_verdicts` form (ADR-039 §4.5). Strings prefixed with
   * `LLM_SHADOW:` are L2-LLM-derived; bare strings are L1
   * deterministic rule names. The `PolicyHitBadge` component
   * distinguishes the two visually.
   *
   * Sourced from `casesApi.getRecords(case_id).aggregated_policy_hits`
   * — the backend dedupes across child records so the UI never has
   * to recompute. Empty / undefined hides the section entirely
   * (Guardrail #6 — no synthesised "no hits" placeholder).
   */
  policyHits?: string[];
  /**
   * The child `ExceptionRecord`s attached to this case
   * (Phase 28.5.x §28.5 follow-up). Sourced from
   * `casesApi.getRecords(case_id).items`. Each row deep-links to
   * `/exceptions/{id}` for the full per-event detail. Empty array
   * hides the section entirely (Guardrail #6).
   */
  attachedRecords?: ExceptionDetailResponse[];
}

export function CaseDetailPanel({
  orderCase,
  policyHits,
  attachedRecords,
}: CaseDetailPanelProps) {
  // PO #20 (issue #133): tick the SLA snapshot once a minute so the
  // header countdown stays live without a refetch.
  const now = useSlaTicker();
  const sla = slaSnapshot(orderCase, now);
  const hasPolicyHits = (policyHits ?? []).length > 0;
  const hasAttachedRecords = (attachedRecords ?? []).length > 0;

  return (
    <div className="space-y-24">
      {/* ── Case header ──────────────────────────────────────────── */}
      <header
        aria-label="Case header"
        className="bg-surface-primary border border-border rounded-md p-16 shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-8 mb-12">
          <Badge variant="neutral" size="sm">
            {SOURCE_ICON[orderCase.source as CaseSource] ?? SOURCE_ICON.default}
            <span className="ml-4">
              {SOURCE_LABEL[orderCase.source as CaseSource] ?? SOURCE_LABEL.default}
            </span>
          </Badge>
          <Badge variant="neutral" size="sm">
            {sourceChannelLabel(orderCase.source_channel)}
          </Badge>
          {/* PO #17 / #20 (issue #133): SLA and status surface in the
              same top-line band so the CSR sees the time pressure
              without scrolling. */}
          {sla.band !== "none" && (
            <Badge
              variant={SLA_BAND_VARIANT[sla.band]}
              size="sm"
              aria-label={`SLA: ${sla.label}`}
            >
              <Clock size={10} aria-hidden className="mr-4" />
              {sla.label}
            </Badge>
          )}
          {/* PO #17 — "Last activity" surfaces in the header line so the
              CSR sees freshness next to status. Structurally omitted
              when updated_at hasn't been populated (V014 backfill
              window). Ticker drives the relative label. */}
          {(() => {
            const activity = lastActivityLabel(orderCase.updated_at, now);
            return activity ? (
              <span
                className="text-caption text-text-tertiary"
                aria-label={`Last activity ${activity}`}
                title={orderCase.updated_at ?? undefined}
              >
                Last activity {activity}
              </span>
            ) : null;
          })()}
          <span className="ml-auto text-caption text-text-tertiary">
            {STATUS_LABEL[orderCase.status] ?? orderCase.status}
          </span>
        </div>

        <h1 className="text-display font-semibold text-text-primary mb-12">
          Case <code className="font-mono">{orderCase.case_id}</code>
        </h1>

        {/* PO #17 (issue #133): timing context (Opened / SLA deadline)
            promoted to the top row of the grid so the CSR sees it
            without scrolling — under the old order it sat at the
            tail of a six-field grid. */}
        <dl className="grid grid-cols-2 gap-x-24 gap-y-12 text-body">
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
          <EvidenceBlock tier="contextual" value={orderCase.bundle_version_at_open}>
            {(v) => <Field label="Skill bundle at open" value={String(v)} mono />}
          </EvidenceBlock>
        </dl>
      </header>

      {/* ── Compliance hits (ADR-039 §4.5 — L1 vs L2 distinction) ── */}
      {hasPolicyHits && (
        <section
          aria-label="Compliance Shadow hits"
          className="bg-surface-primary border border-border rounded-md p-16 shadow-xs"
        >
          <div className="flex items-center gap-8 mb-12">
            <ShieldAlert size={16} aria-hidden className="text-text-secondary" />
            <h2 className="text-heading font-semibold text-text-primary m-0">
              Compliance hits
            </h2>
            <span className="ml-auto text-caption text-text-tertiary">
              {(policyHits ?? []).length}
            </span>
          </div>
          <p className="text-caption text-text-tertiary leading-normal mb-12">
            L1 rule names render plain; L2 LLM-derived concerns
            (ADR-039 §4.5) carry the AI badge.
          </p>
          <ul className="flex flex-wrap gap-8 m-0 p-0 list-none">
            {(policyHits ?? []).map((hit) => (
              <li key={hit}>
                <PolicyHitBadge hit={hit} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Attached records stack (Phase 28.5.x §28.5) ──────────── */}
      {hasAttachedRecords && (
        <section
          aria-label="Attached records"
          className="bg-surface-primary border border-border rounded-md p-16 shadow-xs"
        >
          <div className="flex items-center gap-8 mb-12">
            <h2 className="text-heading font-semibold text-text-primary m-0">
              Attached records
            </h2>
            <span className="ml-auto text-caption text-text-tertiary">
              {(attachedRecords ?? []).length}
            </span>
          </div>
          <p className="text-caption text-text-tertiary leading-normal mb-12">
            Per-event records (extraction, validation findings, agent
            decisions) attached to{" "}
            <code className="font-mono">{orderCase.case_id}</code>.
            Open one for the full enrichment + reasoning surface.
          </p>
          <ul role="list" className="m-0 p-0 list-none divide-y divide-border-subtle">
            {(attachedRecords ?? []).map((record) => (
              <li key={record.id}>
                <Link
                  href={`/exceptions/${record.id}`}
                  className="flex items-center gap-12 py-12 hover:bg-surface-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                  aria-label={`Open exception ${record.order_id ?? record.id}`}
                >
                  <Badge variant="neutral" size="sm">
                    {record.intent ?? "UNCLASSIFIED"}
                  </Badge>
                  <span className="font-mono text-body text-text-primary">
                    {record.order_id ?? record.id}
                  </span>
                  <span className="ml-auto text-caption text-text-tertiary">
                    {record.lifecycle_state}
                  </span>
                  <ChevronRight size={14} aria-hidden className="text-text-tertiary" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
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
