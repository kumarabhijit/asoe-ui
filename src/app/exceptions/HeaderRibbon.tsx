/**
 * HeaderRibbon — Layer 1 of the Exception Detail Panel.
 *
 * Breadcrumb-style context: Reference ID > Customer > Location > Primary SKU.
 * Status row: lifecycle badge + event type + shadow verdict (read-only) + total value.
 */
"use client";

import { ChevronRight } from "lucide-react";
import { Badge, lifecycleVariant, verdictVariant } from "@/components/ui/Badge";
import { TaxonomyLabel } from "@/components/ui/TaxonomyLabel";
import { fmtPrice } from "./shared";
import { fmtSignedPrice, humanizeEnumLabel } from "@/lib/format";
import type { ExceptionDetail, EntityProfile } from "@/types/exceptions";

interface HeaderRibbonProps {
  detail: ExceptionDetail;
  entityProfile?: EntityProfile | null;
  primarySkuLabel: string;
  totalPo: number;
  delta: number;
  /**
   * S1 finding #1, #5 — when this panel is mounted INSIDE
   * `CaseDetailPanel` (the /cases workspace right pane), the case-level
   * slim header already carries customer, case id, and compliance
   * verdict. Showing the breadcrumb + Audit Result here as well puts
   * two parallel headers above the same action ribbon and surfaces
   * compliance state four times across the screen.
   *
   * `embedded` suppresses the breadcrumb row, the Audit Result
   * badge, the Type label, and the order-total/delta figure — all of
   * which either duplicate the case-level chrome (id, customer,
   * verdict) or, in the case of the order total, present a SECOND
   * dollar number that competes with the ImpactBar's at-risk figure
   * (the canonical blast radius). What survives is the per-record
   * lifecycle "Current State" — decision-relevant and with no clean
   * case-level analog on a multi-record case (council follow-up
   * 2026-06-09). Standalone `/exceptions/[id]` (no left queue pane)
   * keeps the full chrome.
   */
  embedded?: boolean;
  /**
   * Situation sub-line state relocation (audit finding #2, option C —
   * sign-off 2026-06-10). When the Modern Situation hero renders the
   * lifecycle state in its sub-line, the "Current State" badge here
   * would repeat the same fact a few rows below. Suppressing it keeps
   * one fact in one home (S1/S2 redundancy posture) — relocation, not
   * removal: the state stays on the Layer-1 surface, just in the
   * operator's reading order under the headline. Never set in Legacy,
   * so the classic ribbon is untouched.
   */
  suppressLifecycle?: boolean;
}

export function HeaderRibbon({ detail, entityProfile: ep, primarySkuLabel, totalPo, delta, embedded = false, suppressLifecycle = false }: HeaderRibbonProps) {
  // Embedded mode strips the ribbon down to the lifecycle badge alone
  // (see `embedded` above) — with that relocated into the sub-line too,
  // nothing remains, so drop the empty chrome row instead of rendering
  // a bare border.
  if (embedded && suppressLifecycle) return null;

  return (
    <div className="px-16 py-10 border-b border-border bg-surface-primary shrink-0">
      {/* Breadcrumb row */}
      {!embedded && (
        <div className="flex items-center gap-6 text-caption text-text-tertiary mb-6 flex-wrap min-w-0">
          <span className="font-mono font-bold text-text-primary">
            {detail.order_id}
          </span>
          <ChevronRight size={10} />
          <span className="font-medium text-text-secondary">
            {ep?.customer_name ?? detail.tenant_id}
          </span>
          {/* Structural omission for the contextual entity-profile
              location: drop the chevron + slot when absent rather than
              rendering "—" (CLAUDE.md Guardrail #6). */}
          {ep?.location && (
            <>
              <ChevronRight size={10} />
              <span>{ep.location}</span>
            </>
          )}
          <ChevronRight size={10} />
          <span>{primarySkuLabel}</span>
        </div>
      )}

      {/* Status row \u2014 labels make the two parallel facts unambiguous:
          "Current State" is the lifecycle (where the exception sits in
          the persistence state machine) vs. "Audit Result" which is
          the Compliance-Shadow verdict (GREEN/YELLOW/RED). The PO
          requested explicit labels so reviewers don't have to learn
          which colored pill means which thing. */}
      <div className="flex items-center gap-10 flex-wrap">
        {/* Suppressed when the Modern Situation sub-line carries the
            state (relocation — see `suppressLifecycle` above). */}
        {!suppressLifecycle && (
        <div className="flex items-center gap-4">
          <span className="text-label font-semibold uppercase tracking-wider text-text-quaternary">
            Current State:
          </span>
          <Badge variant={lifecycleVariant(detail.lifecycle_state)} size="sm">
            {/* Governed plain-language label (same humanizer the
                RecordListPane uses for lifecycle), not the raw enum. On
                a single-record case this is the ONLY state surface — the
                case header drops its duplicate status (CaseDetailPanel
                S2) — so it must read in the operator's language, e.g.
                "Pending Review" rather than "PENDING REVIEW". */}
            {humanizeEnumLabel(detail.lifecycle_state)}
          </Badge>
        </div>
        )}
        {/* S1 finding #5 — when embedded inside `CaseDetailPanel`, the
            case-level Compliance surfaces (slim-header chip + rail or
            inline section) already carry the verdict. Suppress the
            per-record Audit Result badge so compliance state is not
            repeated four times across the screen. */}
        {!embedded && detail.shadow_verdict && (
          <div className="flex items-center gap-4">
            <span className="text-label font-semibold uppercase tracking-wider text-text-quaternary">
              Audit Result:
            </span>
            <Badge variant={verdictVariant(detail.shadow_verdict)} size="sm">
              {detail.shadow_verdict}
            </Badge>
          </div>
        )}
        {/* ADR-045 zone split: the summary shows the governed intent
            label ("Manual Order Intake"), not the raw event token
            ("EMAIL_ORDER_ENTRY_REQUEST"). The raw event_type stays in the
            audit zone (DiagnosticsSection / Source Email), where the
            machine token is the evidence.

            Embedded (workspace) mode drops the Type and the
            order-total/delta: Type is channel jargon that doesn't
            discriminate the decision here (Guardrail #0/#1), and the
            order total is a SECOND dollar figure competing with the
            ImpactBar's at-risk number (council follow-up 2026-06-09). */}
        {!embedded && (
          <>
            <div className="flex items-center gap-4">
              <span className="text-label font-semibold uppercase tracking-wider text-text-quaternary">
                Type:
              </span>
              <span className="text-caption text-text-tertiary">
                <TaxonomyLabel axis="intent" code={detail.intent} />
              </span>
            </div>
            <div className="flex-1" />
            <span className="font-mono font-bold text-body text-text-primary">
              {fmtPrice(totalPo)}
            </span>
            {delta !== 0 && (
              <span className="font-mono font-semibold text-caption text-error">
                {"\u0394"} {fmtSignedPrice(delta)}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
