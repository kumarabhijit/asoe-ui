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
 * Whole-dollar USD (no cents): "$4,147", "-$3". For summary figures where
 * cents are noise (e.g. the SAP credit-exposure card). Canonical replacement
 * for SapDataSection's local `formatUsd` (which set maximumFractionDigits: 0).
 * For the WITH-cents form (the other three sections' `formatUsd`) use the
 * existing `fmtMoney` above — its `signDisplay: "auto"` matches the old output.
 */
export function fmtMoneyRounded(n: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Title-case a snake_case pipeline node / graph id for display.
 * `build_analysis` → "Build Analysis". No closed enum mapping
 * (Guardrail #2) — purely mechanical. Shared by PipelineDAG and
 * EventsTimeline (was duplicated verbatim in both).
 */
export function humanizeNodeId(id: string): string {
  return id
    .split("_")
    .map((p) => (p.length === 0 ? "" : p[0].toUpperCase() + p.slice(1)))
    .join(" ");
}

/**
 * Title-case an UPPER_SNAKE backend enum token for display
 * ("CARRIER_ISSUE" → "Carrier Issue", "WARNING" → "Warning"). Mechanical
 * (lower-case then capitalise each word) — NOT a closed enum map, so a new
 * backend value humanises automatically (Guardrail #2 display-mapping is
 * allowed; this just avoids per-value literals).
 */
export function humanizeEnumLabel(token: string): string {
  return token
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Canonical duration formatter for the pipeline surfaces (WaterfallStepper,
 * EventsTimeline, PipelineDAG) the same operator sees side-by-side.
 *
 * - `undefined` → `null` (no duration recorded; caller renders nothing).
 * - sub-second → integer milliseconds, e.g. "0ms", "42ms". A genuine 0ms
 *   (sub-millisecond, rounded) node renders "0ms", not blank — only an
 *   absent value is null.
 * - >= 1s → seconds at 2 dp, e.g. "1.23s" (audit precision; previously the
 *   three surfaces disagreed at 1 vs 2 dp).
 */
export function formatDurationMs(ms?: number): string | null {
  if (typeof ms !== "number") return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Human-readable local timestamp for an ISO-8601 string, e.g.
 * "Jun 7, 2026, 3:52 PM". Keep the raw ISO value in the element's
 * `dateTime` attribute for machine/audit fidelity; this is the visible
 * label only. An unparseable value is returned verbatim rather than
 * fabricating a date (no partial-truth on an audit surface).
 */
export function formatTimestamp(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
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
