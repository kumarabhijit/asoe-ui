/**
 * Override-reason cluster mapping (ADR-033 §D).
 *
 * Per-intent UI grouping for the OverrideChooserDialog. The reason-code
 * *values* still come from `/api/v1/health.allowed_override_reason_tags_by_intent`
 * (Guardrail #2 — never hardcoded). Cluster *groups* are a UI-side
 * presentation concern explicitly sanctioned by ADR-033 §D:
 *
 *   "Cluster mapping for DUPLICATE_PO is a UI-side constant; mapping for
 *    future intents is added when their vocabulary lands."
 *
 * Why clusters? CSR (U1) feedback in the 2026-05-03 design review:
 * eight reason codes on a flat list pushes operators toward `OTHER` —
 * 3-cluster grouping preserves the data-collection signal while staying
 * ergonomic. The 2026-05-10 sign-off review revised "Agent was right"
 * → "Confirm the agent" so the single-item cluster reads as intentional.
 *
 * Adding a new per-intent cluster mapping:
 *   1. Confirm the per-intent vocabulary has landed in
 *      `asoe2/constraints/specs.py::INTENT_REASON_TAGS`.
 *   2. Add a new entry to REASON_CODE_CLUSTERS keyed by the intent name.
 *   3. Each cluster carries `label` (operator-facing copy) and `codes`
 *      (subset of the per-intent vocabulary).
 *   4. The dialog falls back to a flat list for intents without a
 *      cluster mapping — no other UI changes needed.
 */

export interface ReasonCluster {
  /** Operator-facing cluster label rendered as an `<optgroup>` header. */
  readonly label: string;
  /**
   * Reason-code values in this cluster. Order is the rendering order
   * within the group. Codes not in the per-intent vocabulary are
   * filtered out at render time so an outdated cluster mapping never
   * blocks an operator from seeing a real backend code.
   */
  readonly codes: readonly string[];
}

/** Per-intent cluster mapping. Keyed by the intent value as it appears
 *  on `ExceptionDetail.intent` (matching `AllowedIntent` on asoe2). */
export const REASON_CODE_CLUSTERS: Readonly<Record<string, readonly ReasonCluster[]>> = {
  /**
   * DUPLICATE_PO — ADR-033 §D, table:
   *   Cluster 1 (Confirm the agent) — single-item, *intentional* per
   *     2026-05-10 revision. Labels the affirmation explicitly so the
   *     single-item presentation does not read as a UX accident.
   *   Cluster 2 (Override with a structured reason) — six structured
   *     reasons that all categorise distinct duplicate-detection
   *     dispositions. Order matches the table in the ADR for stable
   *     muscle-memory across releases.
   *   Cluster 3 (Edge case) — `OTHER` only; free-text mandatory at
   *     submit when this is selected.
   */
  DUPLICATE_PO: [
    {
      label: "Confirm the agent",
      codes: ["CONFIRMED_DUPLICATE"],
    },
    {
      label: "Override with a structured reason",
      codes: [
        "INTENTIONAL_REORDER",
        "AMENDED_PO",
        "DIFFERENT_SHIP_TO",
        "BLANKET_RELEASE",
        "SYSTEM_RETRY_VALID",
        "PARTIAL_OVERLAP",
      ],
    },
    {
      label: "Edge case",
      codes: ["OTHER"],
    },
  ],
} as const;

/**
 * The reason codes that REQUIRE free-text notes at submit time.
 * Per ADR-033 §D.3 — "Free-text notes mandatory only when reason is
 * OTHER, optional otherwise." Both the legacy lowercase `other` and the
 * curated SCREAMING_SNAKE_CASE `OTHER` are treated identically.
 */
export const NOTES_REQUIRED_REASON_CODES: ReadonlySet<string> = new Set([
  "OTHER",
  "other",
]);

/**
 * Resolve the cluster mapping for an intent. Returns `null` when no
 * mapping exists — the dialog renders a flat list in that case.
 */
export function clustersForIntent(
  intent: string | undefined | null,
): readonly ReasonCluster[] | null {
  if (!intent) return null;
  return REASON_CODE_CLUSTERS[intent] ?? null;
}

/**
 * Whether free-text notes are required at submit time given the
 * selected reason code. The dialog and the action hook both consult
 * this so the rule is enforced in exactly one place.
 */
export function notesRequiredForReason(reasonCode: string): boolean {
  return NOTES_REQUIRED_REASON_CODES.has(reasonCode);
}
