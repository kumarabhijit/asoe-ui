// RecordPreviewRail — record-scoped preview surfaces for the
// `/cases` xl audit rail.
//
// ADR-041 P3e §2.3 follow-on, PO finding 2026-05-28 #1: the rail's
// 320px third column was sparse — Compliance Hits often empty;
// the rest of the rail wasted. The 2026-05-28 UX panel synthesis
// recommended a stacked-section pattern (no tabs — Compliance SME
// veto on swapping their hits off-screen) with the AI-drafted
// reply as the Phase-1 preview tenant.
//
// This component fetches the analysis for the currently-selected
// record and renders `<DraftReplySection>` when `analysis.draft_reply`
// is present. Returns null otherwise — empty state on the rail is
// preferable to a placeholder that adds visual noise (matches the
// Compliance Hits null-on-empty contract above it).
//
// Architectural notes:
//   * Per-record (driven by `selectedRecordId`) — the rail's
//     compliance-hits sibling is per-case. Together they cover both
//     scopes within the same xl column.
//   * Pure projector (Guardrail #6) — fetches the existing
//     orderAnalysis endpoint and projects `analysis.draft_reply`.
//     No client-side composition.
//   * Lazy-load deferred to follow-on — `DraftReplySection` is a
//     small read-only render, no PDF preview here.

"use client";

import { useEffect, useState } from "react";

import { exceptionsApi } from "@/lib/api";
import type { OrderAnalysis } from "@/types/exceptions";
import { DraftReplySection } from "@/app/exceptions/DraftReplySection";

export interface RecordPreviewRailProps {
  /** Currently selected record id (URL `?record=` param). Null /
   *  undefined means "no record selected" — the rail renders
   *  nothing. */
  selectedRecordId?: string | null;
  /** PO finding 2026-05-28 round-2 #1 — the parent page collapses
   *  the entire rail (and switches the grid from 3-column back to
   *  2-column) when none of the rail tenants have content. This
   *  callback fires whenever the preview's contentful state
   *  changes so the parent can track it alongside its own
   *  policyHits check.
   *
   *  Idempotent — callers can re-set the same value repeatedly. */
  onContentfulChange?: (hasContent: boolean) => void;
}

export function RecordPreviewRail({
  selectedRecordId,
  onContentfulChange,
}: RecordPreviewRailProps) {
  const [analysis, setAnalysis] = useState<OrderAnalysis | null>(null);

  useEffect(() => {
    if (!selectedRecordId) {
      setAnalysis(null);
      return;
    }
    let cancelled = false;
    exceptionsApi
      .orderAnalysis(selectedRecordId)
      .then((a) => {
        if (!cancelled) setAnalysis(a);
      })
      .catch(() => {
        // Best-effort preview — never block the rail; the rest of
        // the rail (Compliance Hits) is independent.
        if (!cancelled) setAnalysis(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRecordId]);

  const draft = analysis?.draft_reply;
  const hasContent = draft != null;

  // Report contentful state to the parent so it can collapse the
  // rail when both this and ComplianceHitsRail are empty.
  // Cleanup on unmount reports false so the parent doesn't keep
  // the rail open after the preview component is gone.
  useEffect(() => {
    onContentfulChange?.(hasContent);
    return () => {
      onContentfulChange?.(false);
    };
  }, [hasContent, onContentfulChange]);

  if (!draft) return null;

  return (
    <section
      aria-label="Draft reply preview"
      className="border-t border-border-subtle p-16 bg-surface-secondary"
    >
      <div className="text-label uppercase tracking-wider text-text-quaternary font-semibold mb-8">
        Draft reply
      </div>
      {/* Read-only audit glance (UX/usability/a11y review verdict). Editing a
          financially-relevant buyer reply has ONE canonical home — the record
          detail. The rail shows the draft + its read-only version history and
          links to that single editor (useHashOpen expands + scrolls the
          detail's draft section). `regionLabel` disambiguates this landmark
          from the detail's "AI draft reply" region for screen-reader users. */}
      <DraftReplySection
        data={draft}
        regionLabel="AI draft reply — preview"
        editInDetailHref="#section-draft-reply"
      />
    </section>
  );
}
