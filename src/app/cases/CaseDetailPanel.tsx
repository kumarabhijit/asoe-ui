// CaseDetailPanel — case-level detail surface (ADR-038 §6 / S15a).
//
// Renders the case header (source / channel / SLA / status), the
// per-event attached-records list as a picker, and — when a record
// is selected — mounts the full ExceptionDetailPanel inline so the
// CSA reaches the HITL action ribbon (Approve / Reject / Override
// / Escalate / Reanalyze) without leaving the case surface.
//
// Single-record cases auto-mount the panel; multi-record cases
// surface the picker first, then auto-mount on selection. The URL
// `?record=<id>` query keeps the selection bookmarkable and lets
// callers deep-link straight to a specific record.
//
// Architecturally:
//   * Pure projector (Guardrail #6) — all evidence comes from the
//     OrderCase prop or the child records loaded via the existing
//     /api/v1/exceptions/<id> surface. No client-side composition.
//   * No per-intent dispatch (Guardrail #1) — sections mount via
//     data-presence on the analysis payload, same as the queue-page
//     sidebar.
//   * <EvidenceBlock> renders all audit-bearing case fields. The
//     three legal presence states are enforced by that primitive.

"use client";

import { useEffect, useState } from "react";
import { Mail, PackageCheck, Clock, ShieldAlert, ChevronRight, ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import { PolicyHitBadge } from "@/components/ui/PolicyHitBadge";
import type { CaseSource, OrderCase, SlaBand } from "@/types/cases";
import type { ExceptionDetailResponse } from "@/types/api";
import { STATUS_LABEL, lastActivityLabel, sourceChannelLabel } from "@/lib/cases";
import { useSlaTicker } from "@/hooks/useSlaTicker";
import ExceptionDetailPanel from "../exceptions/ExceptionDetailPanel";

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
   * `casesApi.getRecords(case_id).items`. Selecting a row mounts
   * the per-record ribbon + sections inline. Empty array hides the
   * section entirely (Guardrail #6).
   */
  attachedRecords?: ExceptionDetailResponse[];
  /**
   * Currently selected child record id. The page binds this to the
   * URL `?record=<id>` query so the selection survives reload and
   * deep-links. Undefined means "no record selected yet" — the
   * picker renders without a mounted ribbon.
   */
  selectedRecordId?: string;
  /** Picker click handler — flips selection (and the URL query). */
  onSelectRecord?: (recordId: string) => void;
}

export function CaseDetailPanel({
  orderCase,
  policyHits,
  attachedRecords,
  selectedRecordId,
  onSelectRecord,
}: CaseDetailPanelProps) {
  // PO #20 (issue #133): tick the SLA snapshot once a minute so the
  // header countdown stays live without a refetch.
  const now = useSlaTicker();
  const sla = slaSnapshot(orderCase, now);
  const hasPolicyHits = (policyHits ?? []).length > 0;
  const records = attachedRecords ?? [];
  const hasAttachedRecords = records.length > 0;
  // When a record is selected, the per-record HITL ribbon is the
  // primary work surface; the case header collapses to a slim
  // context strip so the ribbon starts near the top of the
  // viewport. The disclosure lets the operator re-expand the full
  // field grid on demand without losing the case URL as the
  // canonical action surface.
  const [showFullCaseHeader, setShowFullCaseHeader] = useState(false);

  // Single-record cases auto-mount the ribbon — the picker step
  // collapses to zero clicks. We surface this through onSelectRecord
  // so the URL stays in sync and a subsequent record arrival (multi-
  // record case loading in stages) re-renders the picker correctly.
  useEffect(() => {
    if (!onSelectRecord) return;
    if (selectedRecordId) return;
    if (records.length === 1) onSelectRecord(records[0].id);
  }, [onSelectRecord, selectedRecordId, records]);

  const selectedRecord = selectedRecordId
    ? records.find((r) => r.id === selectedRecordId) ?? null
    : null;
  // Slim strip when a record is mounted inline, full header
  // otherwise. The disclosure (only present in the slim variant)
  // expands the full field grid below the strip without
  // unmounting the selected-record panel.
  const renderSlimHeader = selectedRecord !== null && !showFullCaseHeader;

  return (
    <div className="space-y-24">
      {renderSlimHeader ? (
        <header
          aria-label="Case context"
          className="flex flex-wrap items-center gap-8 px-12 py-8 bg-surface-secondary border border-border-subtle rounded-md text-caption text-text-secondary"
        >
          <code className="font-mono text-text-primary">{orderCase.case_id}</code>
          <span aria-hidden className="text-text-quaternary">·</span>
          <span>{sourceChannelLabel(orderCase.source_channel)}</span>
          {sla.band !== "none" && (
            <>
              <span aria-hidden className="text-text-quaternary">·</span>
              <Badge
                variant={SLA_BAND_VARIANT[sla.band]}
                size="sm"
                aria-label={`SLA: ${sla.label}`}
              >
                <Clock size={10} aria-hidden className="mr-4" />
                {sla.label}
              </Badge>
            </>
          )}
          <EvidenceBlock tier="audit-bearing" value={orderCase.customer_po_number}>
            {(v) => (
              <>
                <span aria-hidden className="text-text-quaternary">·</span>
                <span>
                  PO <code className="font-mono text-text-primary">{String(v)}</code>
                </span>
              </>
            )}
          </EvidenceBlock>
          <span className="ml-auto text-text-tertiary">
            {STATUS_LABEL[orderCase.status] ?? orderCase.status}
          </span>
          <button
            type="button"
            aria-expanded={false}
            aria-controls="case-full-header"
            onClick={() => setShowFullCaseHeader(true)}
            className="flex items-center gap-4 text-text-tertiary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm px-4"
          >
            <ChevronDown size={12} aria-hidden />
            Case details
          </button>
        </header>
      ) : (
      <header
        id={selectedRecord ? "case-full-header" : undefined}
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
        {selectedRecord && showFullCaseHeader && (
          <button
            type="button"
            aria-expanded={true}
            aria-controls="case-full-header"
            onClick={() => setShowFullCaseHeader(false)}
            className="mt-12 flex items-center gap-4 text-caption text-text-tertiary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm"
          >
            <ChevronRight size={12} aria-hidden className="rotate-90" />
            Hide case details
          </button>
        )}
      </header>
      )}

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
              {records.length}
            </span>
          </div>
          <p className="text-caption text-text-tertiary leading-normal mb-12">
            Per-event records (extraction, validation findings, agent
            decisions) attached to{" "}
            <code className="font-mono">{orderCase.case_id}</code>.
            {records.length > 1 ? " Pick one to act on." : null}
          </p>
          <ul
            role="radiogroup"
            aria-label="Select a record to act on"
            className="m-0 p-0 list-none divide-y divide-border-subtle"
          >
            {records.map((record) => {
              const isSelected = record.id === selectedRecordId;
              return (
                <li key={record.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onSelectRecord?.(record.id)}
                    data-testid={`record-picker-row-${record.id}`}
                    className={[
                      "w-full flex items-center gap-12 py-12 px-8 rounded-sm text-left",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
                      isSelected
                        ? "bg-surface-row-active"
                        : "hover:bg-surface-secondary",
                    ].join(" ")}
                  >
                    <Badge variant={isSelected ? "info" : "neutral"} size="sm">
                      {record.intent ?? "UNCLASSIFIED"}
                    </Badge>
                    <span className="font-mono text-body text-text-primary">
                      {record.order_id ?? record.id}
                    </span>
                    <span className="ml-auto text-caption text-text-tertiary">
                      {record.lifecycle_state}
                    </span>
                    <ChevronRight
                      size={14}
                      aria-hidden
                      className="text-text-tertiary"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Selected-record HITL surface — mounts the full ExceptionDetailPanel
          (HeaderRibbon + ContextStrip + AgentAnalysis + EvidenceGrid +
          Diagnostics + per-record cosign banner). Single-record cases
          mount here automatically via the auto-select effect above.
          The panel is the canonical action surface — CSA reaches
          Approve / Reject / Override / Escalate / Reanalyze in a
          single click from the case URL. */}
      {selectedRecord && (
        <section
          aria-label="Selected record detail"
          data-testid="case-selected-record-detail"
          className="bg-surface-primary border border-border rounded-md p-16 shadow-xs"
        >
          <ExceptionDetailPanel exceptionId={selectedRecord.id} />
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
