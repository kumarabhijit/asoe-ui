/**
 * UX remediation Batch 5 — scaffolding source locks (theme T1: fabricated data
 * presented as live; faked auth identity).
 *
 * Per the compliance/frontend-arch expert decision (see REMEDIATION.md):
 *   - Auth callback / login: FIX (drop the fixed identity; gate SSO copy to
 *     seed mode; remove fabricated pre-auth counts).
 *   - Dashboard: FIX the missing fetch-error/retry state; GATE+LABEL the
 *     RECENT_ACTIVITY sample feed behind the mock-data switch.
 *
 * These are page-level structural fixes; grep locks are the established pattern
 * here (cf. dashboard_live_refresh.test.ts) and each fails on the parent commit.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

function read(rel: string): string {
  return readFileSync(path.resolve(__dirname, "../../", rel), "utf-8");
}

describe("Batch 5 — auth callback no longer fabricates a fixed identity", () => {
  const src = read("src/app/auth/callback/page.tsx");
  it("does not hardcode jane@acme.com / a credentials sign-in", () => {
    expect(src).not.toContain("jane@acme.com");
    expect(src).not.toMatch(/signIn\(\s*["']credentials["']/);
  });
  it("branches on the auth mode", () => {
    expect(src).toMatch(/NEXT_PUBLIC_ASOE_AUTH_MODE/);
  });
});

describe("Batch 5 — login drops fabricated pre-auth counts + gates SSO copy", () => {
  const src = read("src/app/login/page.tsx");
  it("no fabricated agent/exception counts on the public screen", () => {
    expect(src).not.toContain("847 exceptions");
    expect(src).not.toContain("12 agents active");
  });
  it("gates the SSO flow on the auth mode (real Azure AD in entra)", () => {
    expect(src).toMatch(/NEXT_PUBLIC_ASOE_AUTH_MODE/);
    expect(src).toMatch(/signIn\(\s*["']azure-ad["']/);
  });
});

describe("Batch 5 — dashboard has a fetch-error state + gated sample feed", () => {
  const src = read("src/app/dashboard/page.tsx");
  it("tracks a load error and renders an alert + retry (not just console.error)", () => {
    // REGRESSION (fails on parent): the stats fetch only console.error'd, so a
    // failure left the tiles blank and skeletons spinning forever.
    expect(src).toMatch(/setLoadError/);
    expect(src).toMatch(/role="alert"/);
  });
  it("gates RECENT_ACTIVITY behind the mock-data switch and labels it", () => {
    expect(src).toMatch(/isMockDataMode\(\)/);
    expect(src).toMatch(/<SampleDataTag/);
    expect(src).toMatch(/preview-only/);
  });
});
