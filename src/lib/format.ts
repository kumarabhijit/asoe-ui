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
 * Sign-preserving money for whole currency units (NOT cents): "$10.00",
 * "-$3.50", "$0.00". No leading "+" on positives — use this for magnitudes
 * that can legitimately be negative (e.g. a net-credit RESULT in a pricing
 * waterfall), where forcing a "+" would be wrong. The minus is textual, so
 * direction never depends on colour alone (WCAG 1.4.1).
 */
export function fmtMoney(n: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    signDisplay: "auto",
  }).format(n);
}

/**
 * Explicit-sign money for DELTAS (price adjustments, freight deltas,
 * variances) in whole currency units: "+$2.00", "-$3.50", "$0.00". The
 * canonical signed formatter the UX audit (T3) calls for — replaces the
 * `Math.abs`-then-colour pattern so a negative delta is never shown as a
 * positive amount distinguished only by colour. For magnitudes that are
 * always >= 0 (prices, totals, at-risk) keep `fmtPrice` in
 * app/exceptions/shared.tsx.
 */
export function fmtSignedPrice(n: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    signDisplay: "exceptZero",
  }).format(n);
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
