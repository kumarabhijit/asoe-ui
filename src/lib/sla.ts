/**
 * SLA snapshot derivation — single source of the banding/label logic.
 *
 * Extracted from `app/cases/page.tsx::slaSnapshot` (which now delegates
 * here) so the Situation hero sub-line (audit finding #2, option C) and
 * the case surfaces share ONE banding rule instead of drifting copies.
 * Pure function over a deadline string + a `now` reference; consumers
 * pair it with `useSlaTicker` for a live label.
 *
 * Presentational mapping only (Guardrail #1-compatible): the deadline
 * itself is backend-decided; this maps it to a visual band + relative
 * label, with a `none` fallback for absent/invalid input.
 */
import type { SlaBand, SlaSnapshot } from "@/types/cases";

export function slaSnapshotFromDeadline(
  deadline: string | null | undefined,
  now: Date = new Date(),
): SlaSnapshot {
  if (!deadline) {
    return { band: "none", deadline: null, label: "No SLA set" };
  }
  const target = new Date(deadline).getTime();
  if (Number.isNaN(target)) {
    return { band: "none", deadline, label: "Invalid SLA" };
  }
  const ms = target - now.getTime();

  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  let band: SlaBand;
  let label: string;
  if (ms < 0) {
    band = "breached";
    label = `Breached ${formatDeltaShort(-ms)} ago`;
  } else if (ms < TWO_HOURS_MS) {
    band = "at_risk";
    label = `Due in ${formatDeltaShort(ms)}`;
  } else if (ms < ONE_DAY_MS) {
    band = "today";
    label = `Due in ${formatDeltaShort(ms)}`;
  } else {
    band = "comfortable";
    label = `Due in ${formatDeltaShort(ms)}`;
  }
  return { band, deadline, ms_until_deadline: ms, label };
}

function formatDeltaShort(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}
