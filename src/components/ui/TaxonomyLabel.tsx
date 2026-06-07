/**
 * TaxonomyLabel — render an operator-facing label for a taxonomy code (ADR-045).
 *
 * The single render path for supergroup / intent codes on summary
 * surfaces. It projects the governed `/health` `display_labels` strings
 * (via `useDisplayLabel`) so no component hand-authors a label — adding or
 * renaming a taxonomy code in `case_taxonomy.yaml` surfaces here with zero
 * UI change (Guardrail #2). This replaces the drifted `intentLabelFor`
 * path that mislabelled `MANUAL_ORDER_INTAKE` as "Email Order Intake".
 *
 * Zone split (ADR-045): summary surfaces render humanised labels (default).
 * The audit / Diagnostics zone keeps the raw machine token — pass `raw` so
 * the audit intent is explicit in the code, not an accident. The SOX trace
 * needs `MANUAL_ORDER_INTAKE` verbatim; the operator's summary needs
 * "Manual Order Intake".
 */
"use client";

import { useDisplayLabel } from "@/hooks/useDisplayLabel";

interface TaxonomyLabelProps {
  /** Which label vocabulary to resolve against. */
  axis: "supergroup" | "intent";
  /** Taxonomy code. Supergroups are `SG_`-prefixed; intents may be bare. */
  code: string | null | undefined;
  /**
   * Render the raw machine code verbatim instead of the humanised label.
   * Use only in the audit / Diagnostics zone where the token is the
   * evidence.
   */
  raw?: boolean;
  /** Shown when `code` is null/undefined (e.g. an unclassified record). */
  fallback?: string;
  className?: string;
}

export function TaxonomyLabel({
  axis,
  code,
  raw = false,
  fallback = "Unclassified",
  className,
}: TaxonomyLabelProps) {
  const { supergroupLabel, intentLabel } = useDisplayLabel();

  if (!code) {
    return <span className={className}>{fallback}</span>;
  }
  if (raw) {
    return <span className={className}>{code}</span>;
  }

  const label = axis === "supergroup" ? supergroupLabel(code) : intentLabel(code);
  return <span className={className}>{label}</span>;
}
