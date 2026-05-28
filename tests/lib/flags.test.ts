/**
 * flags.ts tests — ADR-041 P3e Phase 3 rollout policy.
 *
 * Locks the three-way resolver:
 *   * Explicit `=1` → ON
 *   * Explicit `=0` → OFF (overrides preview default)
 *   * `VERCEL_ENV=preview` AND no explicit override → ON
 *   * Anything else (including production) → OFF
 *
 * Without the explicit `=0` escape hatch a preview deploy
 * couldn't be flipped back without redeploying — that branch is
 * important for "preview broke; turn the flag back off without
 * a code change" recovery.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { casesRowV2Enabled } from "@/lib/flags";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // Reset to a known-empty state before each case.
  delete process.env.NEXT_PUBLIC_CASES_ROW_V2;
  delete process.env.NEXT_PUBLIC_VERCEL_ENV;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("casesRowV2Enabled — explicit flag wins", () => {
  it("returns true when NEXT_PUBLIC_CASES_ROW_V2=1", () => {
    process.env.NEXT_PUBLIC_CASES_ROW_V2 = "1";
    expect(casesRowV2Enabled()).toBe(true);
  });

  it("returns true even on production when explicitly set", () => {
    process.env.NEXT_PUBLIC_CASES_ROW_V2 = "1";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    expect(casesRowV2Enabled()).toBe(true);
  });

  it("returns false when NEXT_PUBLIC_CASES_ROW_V2=0 even on preview", () => {
    process.env.NEXT_PUBLIC_CASES_ROW_V2 = "0";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    expect(casesRowV2Enabled()).toBe(false);
  });
});

describe("casesRowV2Enabled — Vercel preview default", () => {
  it("returns true on VERCEL_ENV=preview without explicit flag", () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    expect(casesRowV2Enabled()).toBe(true);
  });

  it("returns false on VERCEL_ENV=production without explicit flag", () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    expect(casesRowV2Enabled()).toBe(false);
  });

  it("returns false on VERCEL_ENV=development without explicit flag", () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "development";
    expect(casesRowV2Enabled()).toBe(false);
  });
});

describe("casesRowV2Enabled — defaults", () => {
  it("returns false when no env vars are set (local dev / CI default)", () => {
    expect(casesRowV2Enabled()).toBe(false);
  });

  it("returns false on empty NEXT_PUBLIC_VERCEL_ENV", () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "";
    expect(casesRowV2Enabled()).toBe(false);
  });
});
