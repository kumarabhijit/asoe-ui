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
  humanizeNodeId,
  formatDurationMs,
  formatTimestamp,
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

describe("humanizeNodeId (shared by PipelineDAG + EventsTimeline)", () => {
  it("title-cases snake_case node ids", () => {
    expect(humanizeNodeId("build_analysis")).toBe("Build Analysis");
    expect(humanizeNodeId("shadow_audit")).toBe("Shadow Audit");
  });
  it("handles a single token", () => {
    expect(humanizeNodeId("classify")).toBe("Classify");
  });
  it("tolerates empty segments from leading/double underscores", () => {
    expect(humanizeNodeId("_a__b")).toBe(" A  B");
  });
});

describe("formatDurationMs (unified across pipeline surfaces)", () => {
  it("returns null for an absent duration (caller renders nothing)", () => {
    expect(formatDurationMs(undefined)).toBeNull();
  });
  // REGRESSION: WaterfallStepper's old `if (!ms) return ""` (and parity with
  // the 0ms behaviour) — a genuine 0ms node must render "0ms", not blank/null.
  it("renders '0ms' for a real zero duration (not blank)", () => {
    expect(formatDurationMs(0)).toBe("0ms");
  });
  it("renders sub-second values as integer ms", () => {
    expect(formatDurationMs(42)).toBe("42ms");
  });
  // REGRESSION: the three surfaces disagreed (1dp vs 2dp). Unify on 2dp.
  it("renders >= 1s in seconds at 2 decimal places", () => {
    expect(formatDurationMs(1234)).toBe("1.23s");
    expect(formatDurationMs(1200)).toBe("1.20s");
  });
});

describe("formatTimestamp (audit-strip human label, ISO kept in dateTime)", () => {
  it("renders a localized human-readable timestamp for valid ISO", () => {
    // Pin the locale + a UTC instant so the assertion is CI-stable.
    expect(formatTimestamp("2026-06-07T15:52:00Z", "en-US")).toMatch(
      /Jun 7, 2026/,
    );
  });
  // No fabrication on an audit surface: an unparseable value passes through.
  it("returns the raw value verbatim when unparseable", () => {
    expect(formatTimestamp("not-a-date", "en-US")).toBe("not-a-date");
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
