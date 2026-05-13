/**
 * Architectural lock for the detail-panel error surfacing fix.
 *
 * History: ExceptionDetailPanel previously caught fetch errors and
 * silently logged them, leaving `detail` as null. The render path
 * then took the `if (!detail)` branch and showed "Exception not
 * found." — even when the real cause was a 15-minute JWT expiry.
 * The operator had no way to recover without leaving the page and
 * coming back, and even then the symptom wasn't obvious.
 *
 * This test pins the corrected behaviour at the source level: the
 * panel imports `signIn` from next-auth (proves the unauthorized
 * branch is wired) and the catch block routes errors through a
 * `classifyFetchError` helper rather than swallowing them. A
 * behavioural test through the panel itself fights jsdom + NextAuth
 * setup; the source-string lock is more durable for what is in
 * essence a one-direction guarantee.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PANEL_PATH = path.resolve(
  __dirname,
  "../../src/app/exceptions/ExceptionDetailPanel.tsx",
);

describe("ExceptionDetailPanel: unauthorized-fetch surfacing", () => {
  it("imports signIn from next-auth/react so the 401 branch can re-auth", () => {
    const src = readFileSync(PANEL_PATH, "utf-8");
    expect(src).toMatch(/import\s+\{\s*signIn\s*\}\s+from\s+["']next-auth\/react["']/);
  });

  it("classifies UNAUTHORIZED errors instead of silently swallowing", () => {
    const src = readFileSync(PANEL_PATH, "utf-8");
    expect(src).toMatch(/classifyFetchError/);
    expect(src).toMatch(/UNAUTHORIZED/);
    expect(src).toMatch(/setFetchError/);
  });

  it("does NOT silently swallow refresh errors with bare console.error", () => {
    const src = readFileSync(PANEL_PATH, "utf-8");
    // Specifically check that refreshDetail's catch sets state, not just logs.
    // Look for the catch-and-classify pattern, not the legacy log-only one.
    const refreshFnMatch = src.match(/const refreshDetail = useCallback[\s\S]*?\}, \[exceptionId\]\)/);
    expect(refreshFnMatch, "refreshDetail block not found").toBeTruthy();
    expect(refreshFnMatch![0]).toMatch(/setFetchError/);
  });
});

// ADR-041 P4 (2026-05-13) — the previous ExceptionQueuePage (V5.1)
// locks pinned `/exceptions/page.tsx` shape (useCases + case_*
// invalidation). Those tests were deleted along with the route.
// The equivalent contract for the canonical `/cases/page.tsx`
// workspace is locked by:
//   * `tests/architectural/case_pivot_mock_wiring.test.ts` —
//     `/cases/page.tsx` consumes casesApi (not exceptionsApi).
//   * `tests/architectural/case_invalidation_silent_refresh.test.ts`
//     — `case_*` event invalidation contract.
