/**
 * Mock-mode reanalyze attribution + timestamp regression tests.
 *
 * Two cross-bundle bugs surfaced in the deployed UI (mock mode, no
 * NEXT_PUBLIC_USE_REAL_API):
 *
 * 1. `_currentMockUser` is module-level state set by `authApi.login()`
 *    server-side via NextAuth's credentials provider. The browser
 *    bundle has its own module instance where `_currentMockUser` was
 *    never updated, so reanalyze attribution defaulted to the
 *    hardcoded `marcus.webb@acme-corp.com` regardless of who logged
 *    in. Fix: `getCurrentMockUserEmail()` reads the NextAuth session
 *    client-side; falls back to the module-level state for SSR /
 *    test contexts.
 *
 * 2. Mock writes (reanalyze, disposition) returned a fresh
 *    `updated_at` in the response but did NOT mutate the
 *    `MOCK_EXCEPTIONS` entry, so the followup `refreshDetail()`
 *    re-fetch (see useExceptionActions.ts::handleReanalyze) read
 *    back the stale ts and clobbered the fresh one. Fix: mutate
 *    `exc.updated_at` in place after recording the change.
 *
 * These tests pin both behaviours so the bugs don't regress.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { authApi, exceptionsApi } from "@/lib/api";

const SAMPLE_EXCEPTION_ID = "exc-002"; // YELLOW DUPLICATE_PO — eligible for reanalysis

beforeEach(async () => {
  vi.unstubAllGlobals();
  // Reset module-level mock state by re-running login as the default
  // user. Per-test login below overrides as needed.
  await authApi.login({ email: "marcus.webb@acme-corp.com", password: "x" });
});

describe("Mock reanalyze attribution (Bug #1)", () => {
  it("attributes the reanalysis to the user from the active NextAuth session, not module-level state", async () => {
    // Simulate a browser context where:
    // - getSession() returns user.email = jane@acme.com
    // - module-level _currentMockUser remains marcus.webb (server-side default)
    vi.stubGlobal("window", {});
    vi.doMock("next-auth/react", () => ({
      getSession: async () => ({ user: { email: "jane@acme.com" } }),
    }));
    // Re-import so the dynamic `await import("next-auth/react")` inside
    // getCurrentMockUserEmail picks up the stub.
    const api = await import("@/lib/api");

    const updated = await api.exceptionsApi.reanalyze(SAMPLE_EXCEPTION_ID, {
      reason: "test reason",
    });
    const lastEntry = (updated.reanalysis_history ?? []).at(-1);
    expect(lastEntry?.triggered_by).toBe("jane@acme.com");
    expect(lastEntry?.triggered_by).not.toBe("marcus.webb@acme-corp.com");
  });
});

describe("Mock reanalyze updated_at persistence (Bug #2)", () => {
  it("bumps updated_at on the response AND on the underlying MOCK_EXCEPTIONS entry, so refreshDetail() reads the new ts", async () => {
    const before = await exceptionsApi.get(SAMPLE_EXCEPTION_ID);
    const beforeTs = before.updated_at;

    // Tiny delay so the new ISO ts is strictly greater (test would
    // otherwise be racy on very fast machines where ms tick is the same).
    await new Promise((r) => setTimeout(r, 5));

    const reanalyzed = await exceptionsApi.reanalyze(SAMPLE_EXCEPTION_ID, {
      reason: "test reason",
    });
    expect(reanalyzed.updated_at).not.toBe(beforeTs);
    expect(new Date(reanalyzed.updated_at).getTime())
      .toBeGreaterThan(new Date(beforeTs).getTime());

    // The followup re-fetch (what useExceptionActions::handleReanalyze
    // does via refreshDetail) must see the SAME fresh ts — was stale
    // before the fix because exceptionsApi.get() reads from
    // MOCK_EXCEPTIONS which never got mutated.
    const after = await exceptionsApi.get(SAMPLE_EXCEPTION_ID);
    expect(after.updated_at).toBe(reanalyzed.updated_at);
  });
});
