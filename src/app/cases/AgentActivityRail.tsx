// AgentActivityRail — cockpit rail tenant (cockpit-refactor).
//
// The agent-first "what the agents did" stream for the `/cases` xl rail.
// Council/Guardrail #4: the system is the primary actor; the operator
// should see the reasoning the agents already performed without leaving
// the workspace.
//
// Architectural notes (deliberately mirrors RecordPreviewRail):
//   * Self-contained, per-record (driven by `selectedRecordId`) — it
//     fetches its OWN data (the reasoning trace) and never touches the
//     page's state machine, so the existing /cases grid logic, locks,
//     and e2e are unaffected.
//   * Pure projector (Guardrail #6) — fetches the existing trace endpoint
//     and projects `trace.executed_nodes` through the shared
//     `EventsTimeline`. No client-side composition, no fabricated events.
//   * Gated by `cockpitEnabled()` at the mount site; this component does
//     not read the flag itself (keeps it unit-testable in isolation).
//   * Null on empty by default — an empty xl-rail tenant renders nothing
//     (matches the Compliance Hits / RecordPreview null-on-empty
//     contract, so the column collapses). The `/cases/[id]` detail
//     surface opts in via `showWhenEmpty` so the rail is DISCOVERABLE
//     even before a trace exists: it renders a loading skeleton while
//     fetching and an explicit empty state when the record has no
//     recorded activity yet (council 2026-06-10). The empty/loading
//     shells are still pure projectors — no fabricated events.

"use client";

import { useEffect, useState } from "react";

import { exceptionsApi } from "@/lib/api";
import type { TraceResponse } from "@/types/api";
import { EventsTimeline } from "@/components/ui/EventsTimeline";

export interface AgentActivityRailProps {
  /** Currently selected record id (URL `?record=` param). Null /
   *  undefined means "no record selected" — the rail renders nothing. */
  selectedRecordId?: string | null;
  /** Reports contentful state to the parent so it can keep the xl rail
   *  column open while there is activity to show, and collapse it
   *  otherwise (same contract as RecordPreviewRail). Idempotent. */
  onContentfulChange?: (hasContent: boolean) => void;
  /** Discoverability mode for the detail surface. When true AND a record
   *  is selected, the rail renders its loading skeleton + empty state
   *  instead of collapsing to nothing, so the operator can see WHERE
   *  agent activity surfaces even before a trace lands. Default false
   *  preserves the xl-rail tenant's null-on-empty collapse contract. */
  showWhenEmpty?: boolean;
}

function RailHeader({ live }: { live: boolean }) {
  return (
    <div className="flex items-center gap-8 mb-8">
      {/* Agent-first activity indicator (Guardrail #4) — icon + text,
          never colour-only. Pulses while agents are (or were) the actor;
          a settled empty record shows a static dot so the pulse never
          implies activity that isn't there. */}
      <span
        className={`inline-block h-[8px] w-[8px] rounded-full ${
          live ? "bg-success animate-pulse" : "bg-text-quaternary"
        }`}
        aria-hidden
      />
      <span className="text-label uppercase tracking-wider text-text-quaternary font-semibold">
        Agent activity
      </span>
    </div>
  );
}

export function AgentActivityRail({
  selectedRecordId,
  onContentfulChange,
  showWhenEmpty = false,
}: AgentActivityRailProps) {
  const [trace, setTrace] = useState<TraceResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Clear the prior record's trace immediately on switch so we never
    // flash a different record's activity in the rail while the new fetch
    // is in flight (an audit surface must never show the wrong record).
    setTrace(null);
    if (!selectedRecordId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    exceptionsApi
      .trace(selectedRecordId)
      .then((t) => {
        if (!cancelled) setTrace(t);
      })
      .catch(() => {
        // Best-effort rail tenant — never block the rail; the other
        // tenants (Compliance Hits, draft preview) are independent.
        if (!cancelled) setTrace(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRecordId]);

  const nodes = trace?.executed_nodes ?? [];
  const hasContent = nodes.length > 0;

  useEffect(() => {
    onContentfulChange?.(hasContent);
    return () => {
      onContentfulChange?.(false);
    };
  }, [hasContent, onContentfulChange]);

  // Default tenant (xl rail): collapse to nothing unless contentful. The
  // detail surface opts into the discoverable empty/loading shells, but
  // only while a record is actually selected (nothing to look at
  // otherwise).
  if (!hasContent && (!showWhenEmpty || !selectedRecordId)) return null;

  return (
    <section
      aria-label="Agent activity"
      className="border-b border-border-subtle p-16 bg-surface-secondary"
    >
      <RailHeader live={hasContent || loading} />
      {hasContent ? (
        // Reuse the canonical executed-events renderer — same component
        // the Diagnostics surface uses, fed the same trace.executed_nodes.
        <EventsTimeline
          executedNodes={nodes}
          finalStatus={trace?.final_status ?? undefined}
        />
      ) : loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="text-caption text-text-tertiary"
        >
          Loading agent activity…
        </div>
      ) : (
        <p className="text-caption text-text-tertiary m-0">
          No agent activity recorded for this record yet.
        </p>
      )}
    </section>
  );
}
