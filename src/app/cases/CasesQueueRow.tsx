// CasesQueueRow — left-pane queue row for the `/cases` workspace.
//
// Today's anatomy (pre-ADR-041 P3e): origin / SLA / pinned chips,
// PO/SO/case_id monospace identifier, lifecycle label. Extracted
// from `page.tsx:553-626` as a standalone component so the new
// `CasesQueueRowV2` can ship behind a flag without making the
// `else` branch of the conditional unreadable.
//
// Architecturally:
//   * Pure projector — every field comes from `case_`. No
//     composition; no fallback chains. The row's only contract is
//     "render the case as the operator sees it on the queue."
//   * Listbox option semantics (`role="option"`, `aria-selected`,
//     roving tabindex via `tabIndex={-1}`). The container is the
//     single Tab stop; arrow keys move via `aria-activedescendant`
//     (see `useKeyboardListNav`).

"use client";

import { AlertTriangle, Clock, Mail, PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/cases";
import type { CaseListItem } from "@/lib/api";
import type { Origin, SlaBand, SlaSnapshot } from "@/types/cases";

// Origin chrome — duplicated here (and not imported from page.tsx)
// so the row component is self-contained for rollback. Once V2 is
// the only row, page.tsx will own the chrome and pass it as a prop.
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

export interface CasesQueueRowProps {
  case_: CaseListItem;
  sla: SlaSnapshot;
  isSelected: boolean;
  isPinned: boolean;
  onSelect: (caseId: string) => void;
}

export function CasesQueueRow({
  case_,
  sla,
  isSelected,
  isPinned,
  onSelect,
}: CasesQueueRowProps) {
  return (
    <button
      id={`case-row-${case_.case_id}`}
      type="button"
      role="option"
      aria-selected={isSelected}
      tabIndex={-1}
      data-keyboard-nav-id={case_.case_id}
      data-pinned={isPinned || undefined}
      onClick={() => onSelect(case_.case_id)}
      className={cn(
        "w-full text-left py-12 px-16 flex flex-col gap-4",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring",
        "transition-colors duration-fast",
        isSelected ? "bg-surface-row-active" : "hover:bg-surface-secondary",
      )}
    >
      <div className="flex items-center gap-8">
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
        {isPinned && (
          <Badge
            variant="info"
            size="sm"
            aria-label="Pinned because selected"
          >
            Pinned
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-8">
        <span className="font-mono text-body text-text-primary truncate">
          {case_.customer_po_number ?? case_.sales_order_id ?? case_.case_id}
        </span>
      </div>
      <span className="text-caption text-text-tertiary">
        {STATUS_LABEL[case_.status] ?? case_.status}
      </span>
    </button>
  );
}
