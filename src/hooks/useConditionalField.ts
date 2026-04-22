/**
 * useConditionalField — registry-aware visibility for "conditional"
 * audit-bearing fields.
 *
 * Background: the asoe2 audit-bearing field registry
 * (`compliance/audit_bearing_registry.yaml`) classifies some fields
 * as `tier: conditional` with a `depends_on` predicate, e.g.:
 *
 *     alternate_warehouses:
 *       tier: conditional
 *       depends_on: resolved_action == ALT_DC
 *
 * Such a field is audit-bearing (must be authoritative) only when
 * the record's `resolved_action` matches the predicate. When the
 * predicate fails, the field is contextual and the UI must
 * STRUCTURALLY OMIT it — not render a dash, not render "N/A"
 * (review H5 / workshop 2026-04-22 mandates structural omission
 * over partial-truth states).
 *
 * This hook is a thin wrapper the section components use to decide
 * whether to render a conditional row. It reads
 * `detail.resolved_action` from the exception and compares against
 * the predicate string.
 *
 * Predicate vocabulary (matches asoe2 `_predicate_holds`):
 *   * `resolved_action == <VALUE>`
 *   * `resolved_action in [<V1>, <V2>, ...]`
 *
 * Any other predicate shape returns `false` (fail-closed — if we
 * can't evaluate it, hide the field rather than show stale data).
 */

import { useMemo } from "react";

export interface UseConditionalFieldOptions {
  /** Predicate string from the registry (e.g. "resolved_action == ALT_DC") */
  dependsOn: string;
  /** The record's resolved action (from ExceptionDetail.resolved_action) */
  resolvedAction: string | null | undefined;
}

/**
 * Return true iff the conditional field should render (predicate
 * holds against the current resolved_action).
 */
export function useConditionalField({
  dependsOn,
  resolvedAction,
}: UseConditionalFieldOptions): boolean {
  return useMemo(
    () => predicateHolds(dependsOn, resolvedAction ?? null),
    [dependsOn, resolvedAction],
  );
}

/** Pure predicate evaluator — exported for testing without renders. */
export function predicateHolds(
  dependsOn: string,
  resolvedAction: string | null,
): boolean {
  const text = dependsOn.trim();

  const eqPrefix = "resolved_action == ";
  if (text.startsWith(eqPrefix)) {
    const expected = text.slice(eqPrefix.length).trim();
    return resolvedAction === expected;
  }

  const inPrefix = "resolved_action in ";
  if (text.startsWith(inPrefix)) {
    // Tolerate bracket / quote styles — registry is compliance-authored
    // text, not machine-generated.
    const inside = text
      .slice(inPrefix.length)
      .trim()
      .replace(/^\[/, "")
      .replace(/\]$/, "");
    const choices = inside
      .split(",")
      .map((c) => c.trim().replace(/^['"]|['"]$/g, ""));
    return resolvedAction !== null && choices.includes(resolvedAction);
  }

  // Unknown predicate shape — fail closed.
  return false;
}
