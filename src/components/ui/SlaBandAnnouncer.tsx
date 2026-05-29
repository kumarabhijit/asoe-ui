// SlaBandAnnouncer — accessible status messages for SLA band
// transitions.
//
// S3 sprint 2026-05-29 finding #B. `useSlaTicker` re-renders SLA
// labels once a minute. Sighted operators see the SLA chip's color
// flip when a case crosses comfortable → at_risk → breached.
// Screen-reader users get nothing — the chip carries an
// `aria-label` but lives outside any `aria-live` region, and
// announcing the per-minute label changes ("2 hours left", "1
// hour 59 minutes left") would be noise. WCAG 4.1.3.
//
// What this component announces:
//   * NOT every tick.
//   * NOT the literal label change.
//   * Only the BAND TRANSITION — the operator-meaningful event
//     (the chip changed colour). Renders a one-line message into
//     a single `aria-live="polite"` region for SR users.
//
// Mounted on the selected case's chrome — that's the one the
// operator is acting on. The queue's per-row band transitions are
// deliberately silent because announcing for dozens of cases in
// parallel would drown out the actual decision surface.
//
// Re-baselines (no announcement) when `caseId` changes — the
// announcer's purpose is to surface a CHANGE on the case the
// operator is dwelling on, not to read out the SLA whenever the
// operator opens a new case.

"use client";

import { useEffect, useRef, useState } from "react";

import type { SlaBand, SlaSnapshot } from "@/types/cases";

export interface SlaBandAnnouncerProps {
  /** Current SLA snapshot for the selected case. */
  sla: SlaSnapshot;
  /**
   * Case identifier — used as the baseline anchor (announce only
   * when the band changes for the SAME case, not when switching
   * cases) and surfaced in the announcement text for context.
   * Undefined means "no case selected"; the announcer stays silent.
   */
  caseId: string | undefined;
}

function bandTransitionLabel(prev: SlaBand, next: SlaBand): string | null {
  // Surface the canonical operator-facing transitions only. Band
  // movements like at_risk → comfortable (an SLA reset) are
  // surfaced too because they ARE meaningful — the operator's
  // mental "urgency" model for the case just shifted. The `none`
  // band is silent — there is no SLA on the case, so transitions
  // through it are not actionable.
  if (prev === next) return null;
  if (prev === "none" || next === "none") return null;
  const labels: Record<SlaBand, string> = {
    breached: "SLA breached",
    at_risk: "SLA at risk",
    today: "SLA due today",
    comfortable: "SLA on track",
    none: "",
  };
  return labels[next];
}

export function SlaBandAnnouncer({ sla, caseId }: SlaBandAnnouncerProps) {
  const previousRef = useRef<{ caseId: string; band: SlaBand } | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!caseId) {
      previousRef.current = null;
      return;
    }
    const previous = previousRef.current;
    // Baseline on first sight of THIS case — never announce the
    // initial state. The operator's eye is already on the chip;
    // they read the current band without needing an SR utterance.
    if (!previous || previous.caseId !== caseId) {
      previousRef.current = { caseId, band: sla.band };
      return;
    }
    // Same case, different band — operator-meaningful transition.
    if (previous.band !== sla.band) {
      const transition = bandTransitionLabel(previous.band, sla.band);
      if (transition) {
        setMessage(`Case ${caseId}: ${transition}`);
      }
      previousRef.current = { caseId, band: sla.band };
    }
  }, [sla.band, caseId]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
