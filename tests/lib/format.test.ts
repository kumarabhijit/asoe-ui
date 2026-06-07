/**
 * format.ts tests — ADR-041 P3e §2.4.
 *
 * `formatCurrency` is the visible cell renderer for the queue row's
 * line 4. `formatCurrencyForA11y` is the spoken form used in the
 * row's aria-label. Both wrap Intl.NumberFormat with explicit
 * locale so test output is stable regardless of CI locale.
 */
import {
  formatCurrency,
  formatCurrencyForA11y,
  fmtMoney,
  fmtSignedPrice,
} from "@/lib/format";

describe("fmtMoney (sign-preserving, no forced +)", () => {
  it("formats positive magnitudes without a sign", () => {
    expect(fmtMoney(10)).toBe("$10.00");
  });
  it("keeps the minus on negatives (e.g. a net-credit RESULT)", () => {
    expect(fmtMoney(-3.5)).toBe("-$3.50");
  });
  it("zero has no sign", () => {
    expect(fmtMoney(0)).toBe("$0.00");
  });
});

describe("fmtSignedPrice (explicit +/- for deltas)", () => {
  it("prefixes + on positive deltas", () => {
    expect(fmtSignedPrice(3.5)).toBe("+$3.50");
  });
  it("prefixes - on negative deltas (never colour-only)", () => {
    expect(fmtSignedPrice(-3.5)).toBe("-$3.50");
  });
  it("zero has no sign", () => {
    expect(fmtSignedPrice(0)).toBe("$0.00");
  });
});

describe("formatCurrency", () => {
  it("renders USD with narrow symbol", () => {
    expect(formatCurrency(414720, "USD", "en-US")).toBe("$4,147.20");
  });

  it("renders EUR with narrow symbol", () => {
    expect(formatCurrency(123450, "EUR", "en-US")).toBe("€1,234.50");
  });

  it("renders GBP with narrow symbol", () => {
    expect(formatCurrency(500, "GBP", "en-US")).toBe("£5.00");
  });

  it("respects locale-specific separators", () => {
    // German locale: thousands "." and decimal ","
    expect(formatCurrency(123450, "EUR", "de-DE")).toMatch(/1\.234,50/);
  });

  it("handles zero", () => {
    expect(formatCurrency(0, "USD", "en-US")).toBe("$0.00");
  });

  it("handles negative amounts (refunds / credits)", () => {
    expect(formatCurrency(-414720, "USD", "en-US")).toBe("-$4,147.20");
  });
});

describe("formatCurrencyForA11y", () => {
  it("strips the symbol and appends ISO code (deterministic SR pronunciation)", () => {
    expect(formatCurrencyForA11y(414720, "USD", "en-US")).toBe("4,147.20 USD");
  });

  it("keeps locale separators in the digit form", () => {
    expect(formatCurrencyForA11y(123450, "EUR", "de-DE")).toMatch(/1\.234,50 EUR/);
  });

  it("zero amount is announced fully", () => {
    expect(formatCurrencyForA11y(0, "USD", "en-US")).toBe("0.00 USD");
  });

  it("negative amount keeps the minus sign", () => {
    expect(formatCurrencyForA11y(-414720, "USD", "en-US")).toBe("-4,147.20 USD");
  });
});
