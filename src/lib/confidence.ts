/**
 * Canonical confidence model + band mapping (cross-case trust surface).
 *
 * Why this exists: confidence numbers reach the operator from several
 * producers on two different scales — `composite_confidence` (0–1),
 * `OrderAnalysis.confidence` (0–100), per-entity `confidence` (0–1),
 * and `DuplicateDetectionData.confidence` (0–100). Rendering them ad-hoc
 * produced an inconsistent surface and a 0–1 vs 0–100 split that was
 * worked around inline in `ExceptionDetailPanel`. This module is the
 * single place that normalises a raw score to the canonical [0, 1] range
 * and maps it to a *visual* band, so every case type that surfaces a
 * confidence renders it the same way.
 *
 * Compliance posture (asoe-ui CLAUDE.md, Guardrail #1 / #2):
 *   - `confidenceBand` is a VISUAL MAPPING with a default fallback,
 *     analogous to `verdictVariant()` in Badge.tsx — not a policy or
 *     threshold *calculation* that drives a backend decision. The band
 *     never gates an action; it only colours a display.
 *   - The score is NOT a calibrated probability. Until the backend
 *     reports a calibration claim (the forthcoming `ConfidenceSignal`
 *     contract — see the Phase 0 plan and `compliance/audit_bearing_
 *     registry.yaml`), the UI must frame the number as a raw model
 *     score, never as a validated probability of correctness. The
 *     `calibrated` flag is consumed by `ConfidenceDisplay`, not here.
 */

export type ConfidenceScale = "unit" | "percent";
export type ConfidenceBand = "high" | "review" | "low";

/**
 * Display band stops (presentation only). These mirror the colour stops
 * the legacy inline `ConfidenceBar` already used (>=80 / >=50). They are
 * NOT a decision boundary — see the module header. Kept as exported
 * constants so the one architectural lock can assert they live here and
 * nowhere else.
 */
export const BAND_HIGH_MIN = 0.8;
export const BAND_REVIEW_MIN = 0.5;

/**
 * Normalise a raw confidence to canonical [0, 1].
 *
 * `scale` declares the producer's units: `"unit"` for 0–1 fields
 * (`composite_confidence`, per-entity `confidence`) and `"percent"` for
 * 0–100 fields (`OrderAnalysis.confidence`, `DuplicateDetectionData
 * .confidence`). Out-of-range and NaN inputs clamp into range so a
 * malformed payload can never paint a bar wider than its track or read
 * as a negative percentage.
 */
export function toCanonicalConfidence(
  value: number,
  scale: ConfidenceScale = "unit",
): number {
  const unit = scale === "percent" ? value / 100 : value;
  if (Number.isNaN(unit)) return 0;
  return Math.min(1, Math.max(0, unit));
}

/**
 * Map a canonical [0, 1] confidence to a visual band. Default-fallbacks
 * to `"low"` for anything below the review stop, so a 0 / NaN-clamped
 * value renders as the most cautious band rather than crashing.
 */
export function confidenceBand(canonical: number): ConfidenceBand {
  if (canonical >= BAND_HIGH_MIN) return "high";
  if (canonical >= BAND_REVIEW_MIN) return "review";
  return "low";
}

/** Canonical [0, 1] → integer percent for display. */
export function confidencePct(canonical: number): number {
  return Math.round(canonical * 100);
}
