/**
 * useDisplayLabel — operator-facing taxonomy labels from /health (ADR-045).
 *
 * Per Guardrail #2 the UI must not hand-author labels for taxonomy codes;
 * it projects the governed strings the backend serves at
 * `/api/v1/health.display_labels`. This hook binds the pure resolvers in
 * `src/lib/taxonomy-labels.ts` to the live `useHealth()` payload so call
 * sites get a ready-to-render label without threading `health` through
 * every component.
 *
 * The `<TaxonomyLabel>` component is the preferred render path; use this
 * hook directly only where a string (not an element) is required — e.g. an
 * `aria-label` or a `title` attribute.
 */
"use client";

import { useMemo } from "react";

import { useHealth } from "@/hooks/useHealth";
import {
  intentLabel as intentLabelFn,
  showsIntentQualifier as showsIntentQualifierFn,
  supergroupLabel as supergroupLabelFn,
} from "@/lib/taxonomy-labels";

interface UseDisplayLabelReturn {
  /** Human label for a supergroup code (`SG_NEW_ORDER` → "New Order"). */
  supergroupLabel: (code: string) => string;
  /** Human label for an intent code, bare or `INT_`-prefixed. */
  intentLabel: (code: string) => string;
  /** Whether to show the intent qualifier for a supergroup (fan-out > 1). */
  showsIntentQualifier: (supergroupCode: string | null | undefined) => boolean;
  /** True until /health resolves; callers may show a skeleton meanwhile. */
  loading: boolean;
}

export function useDisplayLabel(): UseDisplayLabelReturn {
  const { health, loading } = useHealth();

  return useMemo(
    () => ({
      supergroupLabel: (code: string) => supergroupLabelFn(health, code),
      intentLabel: (code: string) => intentLabelFn(health, code),
      showsIntentQualifier: (supergroupCode: string | null | undefined) =>
        showsIntentQualifierFn(health, supergroupCode),
      loading,
    }),
    [health, loading],
  );
}
