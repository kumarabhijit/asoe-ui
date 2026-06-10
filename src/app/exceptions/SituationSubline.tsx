"use client";

/**
 * SituationSubline — decision-context line under the Situation headline
 * (audit finding #2, option C — sign-off 2026-06-10).
 *
 * Answers "how urgent, where in the flow" directly in the operator's
 * reading order. Option C deliberately carries SLA + lifecycle state
 * ONLY: the $ figure keeps its single Priority-1 home in the ImpactBar,
 * so no fact is rendered twice and nothing leaves Layer 1.
 *
 * Dumb projector (Guardrail #6): renders the backend-composed
 * `presentation.situation_context` as given — membership is decided by
 * the asoe2 composer, never re-derived here. A null fact structurally
 * omits its segment (and the separator); when both facts are null the
 * component renders nothing. No dash/placeholder partial-truth states.
 *
 * The SLA segment receives the ISO timestamp and renders a live
 * relative label via the shared banding rule (`lib/sla.ts`) + the
 * per-minute ticker — never a backend-prerendered string that would go
 * stale. Mounted only in the Modern view, so Legacy gains no ticker
 * re-renders.
 *
 * Accessibility: urgency is carried by the words ("due in" /
 * "breached"), never by color alone (WCAG 1.4.1); the Clock icon is
 * decorative. The per-minute tick is explicitly silent to screen
 * readers (`aria-live="off"`), matching the CaseDetailPanel posture —
 * band-transition announcements stay the SlaBandAnnouncer's job.
 */

import { Clock } from "lucide-react";
import { useSlaTicker } from "@/hooks/useSlaTicker";
import { slaSnapshotFromDeadline } from "@/lib/sla";
import { humanizeEnumLabel } from "@/lib/format";
import type { SituationContext } from "@/types/exceptions";

interface SituationSublineProps {
  context?: SituationContext | null;
}

/** True when the backend-composed context carries at least one
 *  renderable fact; both-null renders nothing (structural omission). */
function sublineHasFacts(context?: SituationContext | null): boolean {
  return !!(context && (context.sla_due_at || context.lifecycle_state));
}

export function SituationSubline({ context }: SituationSublineProps) {
  const now = useSlaTicker();
  if (!sublineHasFacts(context)) return null;

  const sla = context?.sla_due_at
    ? slaSnapshotFromDeadline(context.sla_due_at, now)
    : null;
  // band "none" here means an unparseable timestamp — omit rather than
  // surface "Invalid SLA" as operator-facing decision context.
  const showSla = !!sla && sla.band !== "none";
  const state = context?.lifecycle_state;

  if (!showSla && !state) return null;

  const slaTone =
    sla?.band === "breached"
      ? "text-error font-semibold"
      : sla?.band === "at_risk"
        ? "text-warning font-semibold"
        : "text-text-tertiary";

  return (
    <p
      aria-live="off"
      className="m-0 mt-2 flex items-center gap-6 flex-wrap text-caption text-text-tertiary"
    >
      {showSla && sla && (
        <span className={`flex items-center gap-4 ${slaTone}`}>
          <Clock size={11} aria-hidden className="shrink-0" />
          {/* "Due in 3h" → "SLA due in 3h"; "Breached 2h ago" →
              "SLA breached 2h ago" — presentational casing only. */}
          {`SLA ${sla.label.charAt(0).toLowerCase()}${sla.label.slice(1)}`}
        </span>
      )}
      {showSla && state && (
        <span aria-hidden className="text-text-quaternary">
          ·
        </span>
      )}
      {state && <span>{humanizeEnumLabel(state)}</span>}
    </p>
  );
}
