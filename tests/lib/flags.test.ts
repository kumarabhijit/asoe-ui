/**
 * flags.ts tests — ADR-041 P3e Phase 3 rollout policy
 * (PO direction 2026-05-28: default ON everywhere; explicit `=0`
 * is the escape hatch).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { casesRowV2Enabled } from "@/lib/flags";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_CASES_ROW_V2;
  delete process.env.NEXT_PUBLIC_VERCEL_ENV;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("casesRowV2Enabled — default ON", () => {
  it("returns true when no env vars are set", () => {
    expect(casesRowV2Enabled()).toBe(true);
  });

  it("returns true on production by default", () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    expect(casesRowV2Enabled()).toBe(true);
  });

  it("returns true on preview by default", () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    expect(casesRowV2Enabled()).toBe(true);
  });
});

describe("casesRowV2Enabled — explicit override", () => {
  it("=1 explicit opt-in matches the default ON", () => {
    process.env.NEXT_PUBLIC_CASES_ROW_V2 = "1";
    expect(casesRowV2Enabled()).toBe(true);
  });

  it("=0 is the escape hatch — flips OFF on production", () => {
    process.env.NEXT_PUBLIC_CASES_ROW_V2 = "0";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    expect(casesRowV2Enabled()).toBe(false);
  });

  it("=0 is the escape hatch — flips OFF on preview", () => {
    process.env.NEXT_PUBLIC_CASES_ROW_V2 = "0";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    expect(casesRowV2Enabled()).toBe(false);
  });

  it("unknown values fall through to default ON", () => {
    process.env.NEXT_PUBLIC_CASES_ROW_V2 = "maybe";
    expect(casesRowV2Enabled()).toBe(true);
  });
});
