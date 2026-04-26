/**
 * EvidenceBlock — Layer 2 evidence renderer with three explicit
 * presence states.
 *
 * The Verdict (2026-04-22 compliance workshop) named three
 * acceptable UI states for a Layer-2 evidence field:
 *
 *   1. PRESENT — the backend produced an authoritative value.
 *      Render the evidence.
 *   2. STRUCTURALLY OMITTED — the field was classified `contextual`
 *      in the audit-bearing registry and is absent from the payload.
 *      Do NOT render anything — no dash, no "—", no placeholder.
 *      The operator should not even know the field could have been
 *      there.
 *   3. CONTEXT NOT REQUIRED FOR RESOLUTION — the field was
 *      classified `conditional` and its predicate (typically
 *      `resolved_action == X`) didn't hold for this record. The
 *      field is absent BY DESIGN, not by data gap. The operator
 *      needs to see that the system deliberately skipped it (so
 *      they don't wonder if it crashed).
 *
 * This component is the ONE place in the UI that decides between
 * states (2) and (3). Section components pass the three inputs
 * (value, registry_tier, predicate_holds) and let the block render
 * correctly. Ad-hoc `data.field ?? "—"` patterns are forbidden
 * (CLAUDE.md §rejection of partial-truth states) — use this block
 * instead.
 *
 * Rationale for shipping the primitive before the full per-section
 * refactor: each section's refactor depends on its adapter landing
 * on the asoe2 side. Having the primitive ready means every
 * adapter PR can refactor its section in a single focused commit
 * rather than re-solving the rendering question each time.
 */

"use client";

import type { ReactNode } from "react";

export type EvidenceTier = "audit-bearing" | "conditional" | "contextual";

export interface EvidenceBlockProps {
  /**
   * Registry-declared tier for the field. Drives the absence
   * behaviour:
   *   - audit-bearing: value must be present. Absent means the
   *     composer flagged AUDIT_CONTEXT_MISSING — the section
   *     should not have mounted. We still render defensively
   *     (structural omission) and log a dev-mode warning.
   *   - conditional: absence depends on `predicateHolds`. When
   *     the predicate fails → "Context Not Required for
   *     Resolution". When the predicate holds but value is
   *     absent → treat as audit-bearing missing.
   *   - contextual: absence → structural omission (render null).
   */
  tier: EvidenceTier;

  /**
   * The field value. Undefined / null / empty-string / empty-array
   * counts as absent (mirrors the backend's `_populated()` in
   * api/analysis_composer.py).
   */
  value: unknown;

  /**
   * Only consulted when `tier === "conditional"`. When false, the
   * block renders the "Context Not Required for Resolution"
   * placeholder. When true, the field is required for this
   * resolution path and absence is a gap.
   */
  predicateHolds?: boolean;

  /**
   * Render function for the present-value case. Called only when
   * the value is present. Caller owns the visual — EvidenceBlock
   * decides WHETHER to render, not HOW.
   */
  children: (value: NonNullable<unknown>) => ReactNode;

  /**
   * Optional human-readable label for the "Context Not Required
   * for Resolution" placeholder. Shown as muted text so the
   * operator knows what the system chose to skip. Defaults to
   * "Context Not Required for Resolution".
   */
  notRequiredLabel?: string;
}

/** Match the backend's presence definition in
 * api/analysis_composer.py::_populated. Undefined/null, empty
 * strings/arrays/objects all count as absent. */
export function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.length === 0) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === "object" && Object.keys(value as object).length === 0) {
    return false;
  }
  return true;
}

export function EvidenceBlock({
  tier,
  value,
  predicateHolds = true,
  children,
  notRequiredLabel = "Context Not Required for Resolution",
}: EvidenceBlockProps) {
  const present = isPresent(value);

  // Conditional fields where the predicate doesn't hold: emit the
  // explicit not-required placeholder so the operator knows the
  // system deliberately skipped the evidence. This is the
  // Verdict's named alternative to structural omission.
  if (tier === "conditional" && !predicateHolds) {
    return (
      <div
        role="note"
        aria-label={notRequiredLabel}
        className="text-label text-text-tertiary italic py-6"
      >
        {notRequiredLabel}
      </div>
    );
  }

  // Present with a value: caller renders it.
  if (present) {
    return <>{children(value as NonNullable<unknown>)}</>;
  }

  // Audit-bearing absence SHOULDN'T reach the UI (composer would
  // have routed to AUDIT_CONTEXT_MISSING), but if it does we fail
  // closed: render nothing rather than show partial truth. Dev
  // mode logs a warning so the gap is visible during development.
  // Non-production: log the gap so it surfaces in dev consoles AND
  // vitest runs (NODE_ENV=test). Production stays silent.
  if (tier === "audit-bearing" && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(
      "[EvidenceBlock] audit-bearing field is absent on the payload " +
        "— the composer should have routed this record to " +
        "AUDIT_CONTEXT_MISSING. Possible registry / adapter drift.",
    );
  }

  // Contextual absence OR conditional-predicate-holds-but-absent
  // OR audit-bearing absence: structural omission.
  return null;
}
