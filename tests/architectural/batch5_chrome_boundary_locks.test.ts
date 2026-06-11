/**
 * UX remediation Batch 5 — source locks for chrome/boundary parity fixes.
 *
 * These guard structural fixes that behavioural tests can't easily reach
 * (boundary chrome tab set, the /cases/[id] notFound() path), each anchored to
 * a real audit finding so the lock fails on the parent commit.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

function read(rel: string): string {
  return readFileSync(path.resolve(__dirname, "../../", rel), "utf-8");
}

describe("Batch 5 — ChromeBoundary uses the canonical NAV_TABS", () => {
  const src = read("src/components/ui/ChromeBoundary.tsx");
  it("imports NAV_TABS from the single source of truth", () => {
    expect(src).toMatch(/import\s*\{\s*NAV_TABS\s*\}\s*from\s*["']@\/config\/nav-tabs["']/);
  });
  it("no longer redefines a local (drifted) NAV_TABS array", () => {
    // The local copy was missing the `home` tab and carried a stale
    // "Customer Inbox" entry, so a /home boundary highlighted nothing.
    expect(src).not.toMatch(/const\s+NAV_TABS\s*=/);
    expect(src).not.toContain("Customer Inbox");
  });
});

describe("Batch 5 — route error.tsx boundaries do not leak the raw error.message", () => {
  const routes = ["home", "dashboard", "inbox", "settings", "cases"];
  for (const r of routes) {
    it(`${r}/error.tsx renders BoundaryError, not {error.message}`, () => {
      const src = read(`src/app/${r}/error.tsx`);
      // REGRESSION (fails on parent): each boundary rendered
      // `{error?.message || "…"}`, exposing arbitrary thrown-value detail.
      expect(src).not.toMatch(/error\??\.message/);
      expect(src).toContain("<BoundaryError");
    });
  }

  it("a root-segment error.tsx covers routes without their own boundary", () => {
    // Phase 2 UX overhaul (2026-06-11): segments without a boundary
    // (login, 403, auth callback, root redirect) white-screened on a
    // thrown error. The root boundary is the catch-all; same
    // no-raw-message rule as the per-route boundaries.
    const src = read("src/app/error.tsx");
    expect(src).not.toMatch(/error\??\.message/);
    expect(src).toContain("<BoundaryError");
  });
});

describe("Batch 5 — /cases/[id] reaches not-found.tsx and drops hardcoded chrome", () => {
  const src = read("src/app/cases/[id]/page.tsx");
  it("calls notFound() instead of rendering a dead inline branch", () => {
    expect(src).toMatch(/notFound\(\)/);
    expect(src).not.toMatch(/Case not found:/);
  });
  it("sources agentCount from health, not a hardcoded literal", () => {
    expect(src).not.toMatch(/agentCount=\{3\}/);
    expect(src).toMatch(/agentCount=\{health\?\.allowed_intents\?\.length/);
  });
  it("mounts the HotkeyCheatsheet for keyboard-nav parity with the workspace", () => {
    expect(src).toContain("<HotkeyCheatsheet />");
  });
});
