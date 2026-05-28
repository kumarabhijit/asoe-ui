// CasesQueueRowV2 — ADR-041 P3e §2.1 queue row anatomy.
//
// Four-line row with a pinned-row left-edge stripe. Carries the
// seven CaseSummary projection fields the backend populates via
// `build_case_summary` (ADR-041 P3e §3.1). All audit-bearing
// fields render through `<EvidenceBlock>` (Guardrail #6 — no
// `?? "—"` fallbacks); rows missing fields collapse gracefully.
//
// Layout:
//   [stripe]  Line 1: origin · SLA · status · VerdictDot
//             Line 2: case_id · customer name
//             Line 3: SKU code — title — problem one-liner
//             Line 4: intent badge (left) · currency (right)
//
// Compact density (`useRowDensity`) collapses to lines 1 + 3.
//
// A11y: the `<button role="option">` carries a deterministic
// `aria-label` concatenating every visible fact in scan order so
// SR users get the same scan benefit as sighted users. Currency
// is spelled with `formatCurrencyForA11y` (NVDA / JAWS / VoiceOver
// pronounce `$` inconsistently).

"use client";

import { AlertTriangle, Clock, Mail, PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import { VerdictDot } from "@/components/ui/VerdictDot";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, formatCaseId } from "@/lib/cases";
import type { CaseListItem, CaseSummaryDollarImpact } from "@/lib/api";
import type { Origin, SlaBand, SlaSnapshot } from "@/types/cases";
import { formatCurrency, formatCurrencyForA11y } from "@/lib/format";
import type { RowDensity } from "@/hooks/useRowDensity";
import { reportRowClick } from "@/lib/telemetry";

const ORIGIN_LABEL: Record<Origin | "default", string> = {
  CUSTOMER: "Customer Inbox",
  API: "API",
  default: "Unknown origin",
};

const ORIGIN_ICON: Record<Origin | "default", React.ReactNode> = {
  CUSTOMER: <Mail size={12} aria-hidden />,
  API: <PackageCheck size={12} aria-hidden />,
  default: <Clock size={12} aria-hidden />,
};

const SLA_BAND_VARIANT: Record<
  SlaBand,
  "error" | "warning" | "success" | "neutral"
> = {
  breached: "error",
  at_risk: "warning",
  today: "warning",
  comfortable: "success",
  none: "neutral",
};

export interface CasesQueueRowV2Props {
  case_: CaseListItem;
  sla: SlaSnapshot;
  isSelected: boolean;
  isPinned: boolean;
  density: RowDensity;
  onSelect: (caseId: string) => void;
  /** Position in the visible queue (0-indexed) at render time.
   *  Surfaced into the row-click telemetry so the backend can
   *  correlate "top-row click rate" with SLA-sort effectiveness. */
  rowIndex?: number;
}

export function CasesQueueRowV2({
  case_,
  sla,
  isSelected,
  isPinned,
  density,
  onSelect,
  rowIndex,
}: CasesQueueRowV2Props) {
  const compact = density === "compact";
  const ariaLabel = buildAriaLabel(case_, sla);

  // ADR-041 P3e Phase 3 sign-off gate #5 — row-click telemetry.
  // Best-effort, no-op in mock mode, never blocks selection.
  function handleClick() {
    reportRowClick({
      case_id: case_.case_id,
      row_index: rowIndex,
      audit_verdict_color: case_.audit_verdict_color ?? null,
    });
    onSelect(case_.case_id);
  }

  return (
    <div className="relative">
      {/* Left-edge pinned stripe (CSA panel miss #3). Absolute-positioned
          so the row's flex layout stays untouched; aria-hidden because
          the "Pinned" semantic carries on the button's aria-label. */}
      {isPinned && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ backgroundColor: "var(--color-info)" }}
        />
      )}
      <button
        id={`case-row-${case_.case_id}`}
        type="button"
        role="option"
        aria-selected={isSelected}
        aria-label={ariaLabel}
        tabIndex={-1}
        data-keyboard-nav-id={case_.case_id}
        data-pinned={isPinned || undefined}
        data-density={density}
        onClick={handleClick}
        className={cn(
          "w-full text-left flex flex-col",
          "py-12 pr-16",
          isPinned ? "pl-[19px]" : "pl-16",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring",
          "transition-colors duration-fast",
          isSelected ? "bg-surface-row-active" : "hover:bg-surface-secondary",
          compact ? "gap-2" : "gap-4",
        )}
      >
        {/* Line 1 — chips. */}
        <div className="flex items-center flex-wrap gap-4">
          <Badge variant="neutral" size="sm">
            {ORIGIN_ICON[case_.origin as Origin] ?? ORIGIN_ICON.default}
            <span className="ml-4">
              {ORIGIN_LABEL[case_.origin as Origin] ?? ORIGIN_LABEL.default}
            </span>
          </Badge>
          <Badge
            variant={SLA_BAND_VARIANT[sla.band]}
            size="sm"
            aria-label={`SLA: ${sla.label}`}
          >
            {sla.band === "breached" && (
              <AlertTriangle size={10} aria-hidden className="mr-4" />
            )}
            <Clock size={10} aria-hidden className="mr-4" />
            {sla.label}
          </Badge>
          <Badge variant="neutral" size="sm">
            {STATUS_LABEL[case_.status] ?? case_.status}
          </Badge>
          <EvidenceBlock tier="audit-bearing" value={case_.audit_verdict_color}>
            {(v) => <VerdictDot color={v as "R" | "A" | "G"} />}
          </EvidenceBlock>
        </div>

        {/* Line 2 — case id + customer name. Hidden in compact density. */}
        {!compact && (
          <div className="flex items-center gap-8 min-w-0">
            <span
              className="font-mono text-body text-text-primary truncate"
              title={case_.case_id}
            >
              {formatCaseId(case_.case_id)}
            </span>
            {case_.customer_name && (
              <span className="text-caption text-text-tertiary truncate min-w-0">
                {case_.customer_name}
              </span>
            )}
          </div>
        )}

        {/* Line 3 — SKU + title + problem one-liner. Single truncate;
            full text in title= so the operator can hover for the
            whole string. */}
        <Line3Subject case_={case_} />

        {/* Line 4 — intent + currency. Hidden in compact density. */}
        {!compact && (
          <div className="grid grid-cols-[1fr_auto] items-center gap-8">
            <EvidenceBlock tier="audit-bearing" value={case_.intent}>
              {(v) => (
                <Badge variant="neutral" size="sm">
                  {String(v)}
                </Badge>
              )}
            </EvidenceBlock>
            <EvidenceBlock tier="audit-bearing" value={case_.dollar_impact}>
              {(v) => {
                const d = v as CaseSummaryDollarImpact;
                return (
                  <span
                    className="font-mono text-body text-text-primary tabular-nums text-right"
                    aria-hidden
                    // aria-hidden because the a11y form is already on
                    // the button's aria-label — avoids the SR
                    // announcing the amount twice.
                  >
                    {formatCurrency(d.amount_cents, d.currency)}
                  </span>
                );
              }}
            </EvidenceBlock>
          </div>
        )}
      </button>
    </div>
  );
}

/* ── Line 3 — subject line ─────────────────────────────────────── */

function Line3Subject({ case_ }: { case_: CaseListItem }) {
  // The subject is one cell with three concatenated parts; all three
  // are audit-bearing but they share a line, so we let the row
  // collapse if EVERY part is null (no decorative empty line).
  const sku = case_.top_line_sku_code;
  const title = case_.top_line_sku_title;
  const oneLiner = case_.problem_one_liner;
  if (!sku && !title && !oneLiner) return null;

  const fullText = [sku, title, oneLiner].filter(Boolean).join(" — ");

  return (
    <div className="flex items-baseline gap-6 min-w-0" title={fullText}>
      {sku && (
        <span className="font-mono text-caption text-text-primary shrink-0">
          {sku}
        </span>
      )}
      {(title || oneLiner) && (
        <span className="text-caption text-text-tertiary truncate min-w-0">
          {[title, oneLiner].filter(Boolean).join(" — ")}
        </span>
      )}
    </div>
  );
}

/* ── A11y string ──────────────────────────────────────────────── */

// Concatenates every visible fact on the row in scan order. The
// button's accessible name carries this; SR users get a one-utterance
// summary instead of walking the per-element aria-labels (which
// produce a noisy "origin badge, SLA badge, status, verdict ..."
// announce sequence).
function buildAriaLabel(case_: CaseListItem, sla: SlaSnapshot): string {
  const origin =
    ORIGIN_LABEL[case_.origin as Origin] ?? ORIGIN_LABEL.default;
  const status = STATUS_LABEL[case_.status] ?? case_.status;
  const verdict = case_.audit_verdict_color
    ? `audit verdict ${case_.audit_verdict_color}`
    : null;
  const customer = case_.customer_name;
  const subject = [
    case_.top_line_sku_code,
    case_.top_line_sku_title,
    case_.problem_one_liner,
  ]
    .filter(Boolean)
    .join(" — ");
  const intent = case_.intent;
  const amount = case_.dollar_impact
    ? formatCurrencyForA11y(
        case_.dollar_impact.amount_cents,
        case_.dollar_impact.currency,
      )
    : null;

  return [
    origin,
    `SLA ${sla.label}`,
    status,
    verdict,
    `case ${formatCaseId(case_.case_id)}`,
    customer,
    subject,
    intent,
    amount,
  ]
    .filter(Boolean)
    .join(", ");
}
