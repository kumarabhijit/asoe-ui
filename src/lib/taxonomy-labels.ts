/**
 * Taxonomy display-label resolvers (ADR-045).
 *
 * The backend `/health` `display_labels` map is the single authority for
 * operator-facing strings (Guardrail #2). These pure helpers project a
 * `HealthResponse` into humanised labels for taxonomy codes — the UI never
 * hand-authors a label for a code. They are framework-agnostic so they can
 * be unit-tested without React; `useDisplayLabel` is the hook wrapper.
 *
 * Two axes:
 *   - supergroup codes are already `SG_`-prefixed on the wire
 *     (`OrderCase.supergroup_code`).
 *   - intent codes arrive bare on the wire (`detail.intent =
 *     "MANUAL_ORDER_INTAKE"`) but the taxonomy keys them `INT_`-prefixed,
 *     so `intentLabel` normalises before lookup.
 *
 * Fallback chain: governed label → title-cased code. The title-case
 * fallback exists only so a brand-new code the UI hasn't synced never
 * renders as a raw machine token; it is not a substitute for the contract.
 */
import type { HealthResponse } from "@/types/exceptions";
import {
  INTENT_LABELS,
  INTENTS_BY_SUPERGROUP,
  SUPERGROUP_LABELS,
} from "@/generated/taxonomy";

/** Title-case an UPPER_SNAKE_CASE code: last-resort fallback only. */
export function titleCaseCode(code: string): string {
  return code
    .replace(/^(SG|INT)_/, "")
    .toLowerCase()
    .split("_")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Normalise a wire intent (`MANUAL_ORDER_INTAKE`) to its taxonomy code. */
export function intentCodeFor(code: string): string {
  return code.startsWith("INT_") ? code : `INT_${code}`;
}

/**
 * Resolution order for every label: the live `/health` payload is the
 * runtime authority; the generated taxonomy constants are the SAME YAML
 * projection, committed and drift-locked, so they are the correct
 * *synchronous* fallback before `/health` resolves (no label flash, and
 * acronyms like "Duplicate PO" / "EDI Mismatch" render correctly rather
 * than as title-cased "Duplicate Po"). Title-case is the last resort, only
 * for a brand-new code the UI hasn't synced yet.
 */

/** Human label for a supergroup code (`SG_NEW_ORDER` → "New Order"). */
export function supergroupLabel(
  health: HealthResponse | null | undefined,
  code: string,
): string {
  return (
    health?.display_labels?.supergroups?.[code]
    ?? SUPERGROUP_LABELS[code]
    ?? titleCaseCode(code)
  );
}

/** Human label for an intent code, bare or `INT_`-prefixed. */
export function intentLabel(
  health: HealthResponse | null | undefined,
  code: string,
): string {
  const key = intentCodeFor(code);
  return (
    health?.display_labels?.intents?.[key]
    ?? INTENT_LABELS[key]
    ?? titleCaseCode(key)
  );
}

/**
 * How many intents a supergroup fans out to. Drives the qualifier rule.
 * Unknown supergroup → 0 (no qualifier shown).
 */
export function intentFanout(
  health: HealthResponse | null | undefined,
  supergroupCode: string,
): number {
  const fromHealth = health?.intents_by_supergroup?.[supergroupCode]?.length;
  if (fromHealth !== undefined) return fromHealth;
  // Synchronous fallback: same YAML projection as /health.
  return (INTENTS_BY_SUPERGROUP as Record<string, readonly string[]>)[supergroupCode]?.length ?? 0;
}

/**
 * The qualifier rule (ADR-045): show the intent label as a qualifier on
 * the summary surface only when its supergroup fans out to more than one
 * intent. A 1:1 bucket like `SG_NEW_ORDER` reads as just its supergroup
 * label; a fan-out bucket like `SG_BLOCK_AVAILABILITY` needs the intent to
 * tell back-order from over-max from MOQ.
 */
export function showsIntentQualifier(
  health: HealthResponse | null | undefined,
  supergroupCode: string | null | undefined,
): boolean {
  if (!supergroupCode) return false;
  return intentFanout(health, supergroupCode) > 1;
}
