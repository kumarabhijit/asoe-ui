/**
 * ConfidenceDisplay — the single cross-case renderer for a confidence
 * score (asoe-ui CLAUDE.md Guardrail #1 visual-mapping pattern).
 *
 * Every case type that surfaces a confidence — manual order intake
 * (`composite_confidence`), the Agent Recommendation card
 * (`OrderAnalysis.confidence`), duplicate detection, extracted entities,
 * the extracted order form — renders it through this component so the
 * scale (0–1 vs 0–100), the band colours, the icon+text accessibility
 * pairing, and the honesty framing are identical everywhere.
 *
 * Honesty posture (Verdict 2026-04-22 / the trust review):
 *   The score is a raw model output, not a calibrated probability of
 *   correctness, until the backend reports a calibration claim. The
 *   `calibrated` prop carries that claim:
 *     - `true`  → framed as "Calibrated confidence".
 *     - `false` / `undefined` → framed as a model score, with a
 *       **visible** "model score" marker (not aria-only) so a sighted
 *       operator sees the caveat too — the rendered-experience audit
 *       (2026-06) found the note was previously screen-reader-only on the
 *       `bar` / `inline` variants, leaving a confident-looking "98% High"
 *       chip with no visible honesty cue. Every variant now shows it.
 *
 * Accessibility: the band is never colour-only. The band label (text)
 * and the percentage are always rendered, the visible calibration marker
 * is `text-secondary` (legible, AA), and the root carries an `aria-label`
 * that states the value, band, and calibration posture (WCAG 1.4.1).
 */
"use client";

import { ShieldCheck, Gauge } from "lucide-react";
import {
  toCanonicalConfidence,
  confidenceBand,
  confidencePct,
  type ConfidenceScale,
  type ConfidenceBand,
} from "@/lib/confidence";
import { cn } from "@/lib/utils";

/** Band → visual mapping (design tokens only). Default-fallback safe:
 *  `confidenceBand` only ever returns one of these three keys. */
const BAND_META: Record<
  ConfidenceBand,
  { label: string; barClass: string; textClass: string; ringVar: string }
> = {
  high: { label: "High", barClass: "bg-success", textClass: "text-success", ringVar: "var(--color-success)" },
  review: { label: "Needs check", barClass: "bg-warning", textClass: "text-warning", ringVar: "var(--color-warning)" },
  low: { label: "Low", barClass: "bg-error", textClass: "text-error", ringVar: "var(--color-error)" },
};

export type ConfidenceVariant = "bar" | "inline" | "prominent" | "ring";

export interface ConfidenceDisplayProps {
  /** Raw score from the producer. */
  value: number;
  /** Producer units. `"unit"` for 0–1 fields, `"percent"` for 0–100. */
  scale?: ConfidenceScale;
  /**
   * Backend calibration claim. `undefined` means the backend did not
   * report one — the component frames the value as a raw model score
   * rather than asserting a calibration the data does not support.
   */
  calibrated?: boolean;
  /** Layout. `bar` (Layer-1 card), `inline` (chip), `prominent` (hero). */
  variant?: ConfidenceVariant;
  /** Visible label. Defaults to "Confidence". */
  label?: string;
  className?: string;
}

/** Short, accessible note on calibration posture. Shown as muted text in
 *  `prominent`, and folded into the `aria-label` in every variant. */
function calibrationNote(calibrated?: boolean): string {
  return calibrated === true
    ? "Calibrated confidence"
    : "Model score — calibration not reported; not a validated probability";
}

export function ConfidenceDisplay({
  value,
  scale = "unit",
  calibrated,
  variant = "inline",
  label = "Confidence",
  className,
}: ConfidenceDisplayProps) {
  const canonical = toCanonicalConfidence(value, scale);
  const band = confidenceBand(canonical);
  const pct = confidencePct(canonical);
  const meta = BAND_META[band];
  const note = calibrationNote(calibrated);
  const ariaLabel = `${label}: ${pct} percent, ${meta.label} band. ${note}.`;

  if (variant === "bar") {
    return (
      <div
        className={cn("flex flex-col gap-4", className)}
        role="group"
        aria-label={ariaLabel}
        data-variant="bar"
      >
        <div className="flex items-center gap-8">
          <div
            className="flex-1 h-1.5 bg-surface-tertiary rounded-full overflow-hidden"
            aria-hidden
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-normal ease-out",
                meta.barClass,
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={cn(
              "text-label font-mono font-semibold min-w-[32px] text-right",
              meta.textClass,
            )}
            aria-hidden
          >
            {pct}%
          </span>
          <span
            className="text-label font-semibold uppercase tracking-wider text-text-tertiary"
            aria-hidden
          >
            {meta.label}
          </span>
        </div>
        {/* Visible calibration cue (not aria-only). */}
        <CalibrationMark calibrated={calibrated} />
      </div>
    );
  }

  if (variant === "prominent") {
    // Raw producer value preserved for audit fidelity (confidence is
    // audit-bearing). Unit-scale producers show two decimals; percent
    // producers show the integer they emitted.
    const rawLabel = scale === "percent" ? String(Math.round(value)) : value.toFixed(2);
    return (
      <div className={className} aria-label={ariaLabel} role="group" data-variant="prominent">
        <div className="flex items-baseline gap-8">
          <span className={cn("text-display font-bold leading-tight", meta.textClass)} aria-hidden>
            {pct}%
          </span>
          <ChipLabel meta={meta} />
          <span className="text-caption text-text-tertiary font-mono" aria-hidden>
            raw {rawLabel}
          </span>
        </div>
        {/* Visible calibration honesty note. Not a focus stop — it is static
            text already covered by the group's composed aria-label, so a
            tabIndex here would be an empty keyboard stop on non-interactive
            content. */}
        <div className="mt-4 flex items-center gap-6 text-caption text-text-tertiary">
          {calibrated === true ? (
            <ShieldCheck size={12} className="text-success shrink-0" aria-hidden />
          ) : (
            <Gauge size={12} className="text-text-tertiary shrink-0" aria-hidden />
          )}
          <span aria-hidden>{note}</span>
        </div>
      </div>
    );
  }

  if (variant === "ring") {
    // Cockpit Layer-1 hero (cockpit-refactor). A radial gauge reads the
    // band at a glance; the percentage + band label + calibration cue keep
    // it honest and never colour-only (WCAG 1.4.1). Conic-gradient colours
    // are design-token vars (Guardrail #2), not hardcoded hex. The arc fills
    // to `pct`; the remainder is the neutral track.
    const ringStyle = {
      background: `conic-gradient(${meta.ringVar} ${pct}%, var(--color-surface-tertiary) ${pct}% 100%)`,
    };
    return (
      <div
        className={cn("flex items-center gap-16", className)}
        role="group"
        aria-label={ariaLabel}
        data-variant="ring"
      >
        <div className="relative shrink-0 h-[104px] w-[104px]">
          <div className="h-full w-full rounded-full" style={ringStyle} aria-hidden />
          <div className="absolute inset-[10px] rounded-full bg-surface-primary flex flex-col items-center justify-center">
            <span className={cn("text-title font-bold leading-none", meta.textClass)} aria-hidden>
              {pct}%
            </span>
            <span className="text-label font-semibold uppercase tracking-wider text-text-tertiary mt-2" aria-hidden>
              {meta.label}
            </span>
          </div>
        </div>
        {/* Visible calibration honesty cue beside the gauge (not aria-only). */}
        <CalibrationMark calibrated={calibrated} />
      </div>
    );
  }

  // inline
  return (
    <span
      className={cn("inline-flex items-center gap-6", className)}
      role="img"
      aria-label={ariaLabel}
      data-variant="inline"
    >
      <span className={cn("font-mono font-semibold", meta.textClass)} aria-hidden>
        {pct}%
      </span>
      <ChipLabel meta={meta} />
      {/* Visible calibration cue (compact) — not aria-only. */}
      <CalibrationMark calibrated={calibrated} compact />
    </span>
  );
}

/**
 * Visible calibration cue. `compact` (inline) shows a short "model score" /
 * "calibrated" tag; non-compact (bar) shows the fuller caveat. Always
 * `aria-hidden` — the root group/img `aria-label` already states the
 * calibration posture, so this avoids a double announcement while making the
 * cue visible to sighted operators. `text-secondary` keeps it legible (AA).
 */
function CalibrationMark({
  calibrated,
  compact = false,
}: {
  calibrated?: boolean;
  compact?: boolean;
}) {
  const ok = calibrated === true;
  const Icon = ok ? ShieldCheck : Gauge;
  const text = ok
    ? "calibrated"
    : compact
      ? "model score"
      : "Model score — not a calibrated probability";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-4 text-text-secondary",
        compact ? "text-label" : "text-caption",
      )}
      aria-hidden
    >
      <Icon
        size={compact ? 11 : 12}
        className={cn("shrink-0", ok ? "text-success" : "text-text-tertiary")}
      />
      <span>{text}</span>
    </span>
  );
}

function ChipLabel({ meta }: { meta: (typeof BAND_META)[ConfidenceBand] }) {
  return (
    <span
      className={cn(
        "text-label font-semibold uppercase tracking-wider",
        meta.textClass,
      )}
      aria-hidden
    >
      {meta.label}
    </span>
  );
}

/** Re-export so a section can compose its own layout while still using
 *  the canonical band colour (rare; prefer a variant above). */
export function confidenceBandMeta(canonical: number): {
  label: string;
  barClass: string;
  textClass: string;
} {
  return BAND_META[confidenceBand(canonical)];
}
