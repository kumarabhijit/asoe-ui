/**
 * UX remediation Batch 6 — source locks for the enrichment-section fixes
 * (report 05). Structural/vocabulary fixes anchored to real audit findings;
 * each fails on the parent commit.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

function read(rel: string): string {
  return readFileSync(path.resolve(__dirname, "../../", rel), "utf-8");
}

describe("Batch 6 — DeliveryDelaySection humanises delay_category", () => {
  const src = read("src/app/exceptions/DeliveryDelaySection.tsx");
  it("renders humanizeEnumLabel(delay_category), not the raw enum token", () => {
    expect(src).toMatch(/humanizeEnumLabel\(data\.delay_category\)/);
    expect(src).not.toMatch(/>\s*\{data\.delay_category\}\s*</);
  });
});

describe("Batch 6 — MOQSection drops the conflicting text-colour utilities", () => {
  const src = read("src/app/exceptions/MOQSection.tsx");
  it("the struck-through original qty has a single text-colour utility", () => {
    expect(src).not.toMatch(/text-text-primary line-through text-text-tertiary/);
  });
});

describe("Batch 6 — PriceHoldSection renders thresholds unsigned", () => {
  const src = read("src/app/exceptions/PriceHoldSection.tsx");
  it("uses unsigned fmtPct for tolerance + hard-block thresholds", () => {
    expect(src).toMatch(/value=\{fmtPct\(data\.tolerance_pct\)\}/);
    expect(src).toMatch(/value=\{fmtPct\(data\.hard_block_pct\)\}/);
    // The signed fmtVariance is no longer used on the threshold rows.
    expect(src).not.toMatch(/fmtVariance\(data\.tolerance_pct\)/);
  });
});
