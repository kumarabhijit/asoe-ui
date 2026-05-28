// format.ts — display formatters for the queue + workspace surfaces.
//
// ADR-041 P3e §2.4. Currency renders in the new queue row's line 4
// (right-aligned, `font-mono tabular-nums`). The visible cell uses
// the symbol form; the a11y form swaps the symbol for the currency
// word so NVDA / JAWS / VoiceOver pronounce consistently.

/**
 * Format a money amount carried as integer cents + ISO 4217 code.
 *
 * Returns the symbol form (e.g. "$4,147.20", "€1.234,50"). Use this
 * for the visible cell. For the SR-spoken form, use
 * `formatCurrencyForA11y`.
 *
 * `locale` defaults to the browser locale; pass an explicit locale
 * when rendering server-side or in a test.
 */
export function formatCurrency(
  amountCents: number,
  currency: string,
  locale?: string,
): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(amount);
}

/**
 * A11y-spoken form: digits + currency word ("4,147.20 USD"). The
 * "$" glyph pronounces inconsistently across screen readers — NVDA
 * says "dollars", JAWS says "dollar sign", VoiceOver may skip it
 * entirely. Stripping the symbol and appending the ISO code gives a
 * deterministic spoken form. Used on the queue-row `aria-label`.
 */
export function formatCurrencyForA11y(
  amountCents: number,
  currency: string,
  locale?: string,
): string {
  const amount = amountCents / 100;
  const digits = new Intl.NumberFormat(locale, {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${digits} ${currency}`;
}
