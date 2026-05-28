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
import { Mail, PackageCheck, Clock, ChevronRight, ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { ClassificationHistoryPanel } from "@/components/cases/ClassificationHistoryPanel";
import { ComplianceHitCountChip } from "@/components/ui/ComplianceHitCountChip";
import { ComplianceHitsRail } from "./ComplianceHitsRail";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import { useClassificationHistory } from "@/hooks/useClassificationHistory";
import type { Origin, OrderCase, SlaBand } from "@/types/cases";
import type { ExceptionDetailResponse } from "@/types/api";
import { STATUS_LABEL, lastActivityLabel, sourceChannelLabel } from "@/lib/cases";
import { useSlaTicker } from "@/hooks/useSlaTicker";
import ExceptionDetailPanel from "../exceptions/ExceptionDetailPanel";
import { RecordListPane } from "./RecordListPane";

import { slaSnapshot } from "./page";

const SLA_BAND_VARIANT: Record<SlaBand, "error" | "warning" | "success" | "neutral"> = {
  breached: "error",
  at_risk: "warning",
  today: "warning",
  comfortable: "success",
  none: "neutral",
};


// Origin chrome — KEEP the "Customer Inbox" label per requirements
// §4 Q7 even though the internal field flipped from CaseSource to
// Origin. Partners read the visible chrome, not the field name.
const ORIGIN_ICON: Record<Origin | "default", React.ReactNode> = {
  CUSTOMER: <Mail size={14} aria-hidden />,
  API: <PackageCheck size={14} aria-hidden />,
  default: <Clock size={14} aria-hidden />,
};

const ORIGIN_LABEL: Record<Origin | "default", string> = {
  CUSTOMER: "Customer Inbox",
  API: "API",
  default: "Unknown origin",
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
   * The child `ChildCase`s attached to this case
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
  /**
   * Invoked after a HITL action (disposition / override / escalate /
   * cosign / reanalyze) on the inline-mounted record succeeds.
   *
   * The mutated record's `lifecycle_state` rolls up into
   * `OrderCase.status` (STATUS_MODEL.md §3) — so the action changes
   * state the case header badge, the `RecordListPane` rows, and the
   * outer queue all project. Without this seam the inner
   * `ExceptionDetailPanel` refreshes its own `detail` while every
   * other pane keeps showing the pre-action status until an unrelated
   * WebSocket event happens to arrive. The `/cases` workspace wires
   * this to a case-detail + queue refetch so all panes stay
   * consistent. Optional — standalone consumers may omit it.
   */
  onRecordActionComplete?: () => void;
  /**
   * Whether to render the attached-records picker INSIDE this panel.
   * Default `true`: the `/cases` workspace and the focused
   * `/cases/[id]` view both stack the picker (`RecordListPane`) at the
   * top of this panel — there is no separate column for it. A consumer
   * can pass `false` to suppress it (e.g. an embed that supplies its
   * own picker).
   */
  showInlineRecordList?: boolean;
  /**
   * ADR-041 P3e §2.3 — suppress the inline Compliance Hits section.
   * When the `/cases` workspace mounts the audit rail as a third
   * column at xl, the inline render becomes redundant. Default
   * `false` keeps today's stacked behaviour for the focused
   * `/cases/[id]` view and lg/<lg breakpoints.
   */
  suppressInlineComplianceHits?: boolean;
}

export function CaseDetailPanel({
  orderCase,
  policyHits,
  attachedRecords,
  selectedRecordId,
  onSelectRecord,
  onRecordActionComplete,
  showInlineRecordList = true,
  suppressInlineComplianceHits = false,
}: CaseDetailPanelProps) {
  // PO #20 (issue #133): tick the SLA snapshot once a minute so the
  // header countdown stays live without a refetch.
  const now = useSlaTicker();
  const sla = slaSnapshot(orderCase, now);
  const hasPolicyHits = (policyHits ?? []).length > 0;
  // Requirements §8.6 — classification-history audit strip.
  const {
    entries: classificationHistory,
    loading: classificationHistoryLoading,
    error: classificationHistoryError,
  } = useClassificationHistory(orderCase.case_id);
  const records = attachedRecords ?? [];
  const hasAttachedRecords = records.length > 0;
  // When a record is selected, the per-record HITL ribbon is the
  // primary work surface; the case header collapses to a slim
  // context strip so the ribbon starts near the top of the
  // viewport. The disclosure lets the operator re-expand the full
  // field grid on demand without losing the case URL as the
  // canonical action surface.
  const [showFullCaseHeader, setShowFullCaseHeader] = useState(false);

  // Auto-mount the first record's ribbon when no record is selected
  // yet — for single- AND multi-record cases the operator lands
  // directly on a work surface instead of an empty detail pane. We
  // surface this through onSelectRecord so the URL stays the canonical
  // selection (?record=) and a later record arrival (a multi-record
  // case loading in stages) still resolves to the first row. A
  // deep-linked ?record= wins via the selectedRecordId guard.
  useEffect(() => {
    if (!onSelectRecord) return;
    if (selectedRecordId) return;
    if (records.length > 0) onSelectRecord(records[0].id);
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
          {/* ADR-041 P3e §2.3 — Compliance reversal condition #3.
              Non-dismissible count chip stays on the slim header so
              the operator always sees Compliance presence even when
              the full hits surface (rail at xl, inline below xl) is
              scrolled off-screen. Returns null when count is 0. */}
          <ComplianceHitCountChip count={(policyHits ?? []).length} />
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
            {ORIGIN_ICON[orderCase.origin as Origin] ?? ORIGIN_ICON.default}
            <span className="ml-4">
              {ORIGIN_LABEL[orderCase.origin as Origin] ?? ORIGIN_LABEL.default}
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

      {/* ── Compliance hits (ADR-039 §4.5 — L1 vs L2 distinction) ──
          Extracted to `ComplianceHitsRail` (ADR-041 P3e §2.3).
          Suppressed inline when the workspace mounts it as a third
          column at xl; otherwise stacks here as before. */}
      {hasPolicyHits && !suppressInlineComplianceHits && (
        <ComplianceHitsRail hits={policyHits ?? []} variant="inline" />
      )}

      {/* ── Classification history (requirements §8.6) ────────── */}
      <ClassificationHistoryPanel
        entries={classificationHistory}
        loading={classificationHistoryLoading}
        error={classificationHistoryError}
      />

      {/* ── Attached records picker ──────────────────────────────
          Stacked at the top of the detail pane so the operator picks
          which attached record to act on. Shown on every surface that
          mounts CaseDetailPanel (the `/cases` workspace + the focused
          `/cases/[id]` view). */}
      {showInlineRecordList && hasAttachedRecords && (
        <RecordListPane
          caseId={orderCase.case_id}
          records={records}
          selectedRecordId={selectedRecordId}
          onSelectRecord={onSelectRecord}
        />
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
          <ExceptionDetailPanel
            exceptionId={selectedRecord.id}
            onActionComplete={onRecordActionComplete}
          />
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
