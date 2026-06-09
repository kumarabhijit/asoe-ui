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
//   * Null on empty — an empty rail tenant renders nothing (matches the
//     Compliance Hits / RecordPreview null-on-empty contract).

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
}

export function AgentActivityRail({
  selectedRecordId,
  onContentfulChange,
}: AgentActivityRailProps) {
  const [trace, setTrace] = useState<TraceResponse | null>(null);

  useEffect(() => {
    // Clear the prior record's trace immediately on switch so we never
    // flash a different record's activity in the rail while the new fetch
    // is in flight (an audit surface must never show the wrong record).
    setTrace(null);
    if (!selectedRecordId) return;
    let cancelled = false;
    exceptionsApi
      .trace(selectedRecordId)
      .then((t) => {
        if (!cancelled) setTrace(t);
      })
      .catch(() => {
        // Best-effort rail tenant — never block the rail; the other
        // tenants (Compliance Hits, draft preview) are independent.
        if (!cancelled) setTrace(null);
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

  if (!hasContent) return null;

  return (
    <section
      aria-label="Agent activity"
      className="border-b border-border-subtle p-16 bg-surface-secondary"
    >
      <div className="flex items-center gap-8 mb-8">
        {/* Agent-first activity indicator (Guardrail #4) — icon + text,
            never colour-only. The pulse signals the system is the actor. */}
        <span
          className="inline-block h-[8px] w-[8px] rounded-full bg-success animate-pulse"
          aria-hidden
        />
        <span className="text-label uppercase tracking-wider text-text-quaternary font-semibold">
          Agent activity
        </span>
      </div>
      {/* Reuse the canonical executed-events renderer — same component the
          Diagnostics surface uses, fed the same trace.executed_nodes. */}
      <EventsTimeline
        executedNodes={nodes}
        finalStatus={trace?.final_status ?? undefined}
      />
    </section>
  );
}
