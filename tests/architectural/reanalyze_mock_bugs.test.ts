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

describe("Mock write updated_at persistence (Bug #2 — covers every action)", () => {
  /**
   * Each write path (reanalyze / disposition / escalate / challenge /
   * adminRelease / cosign) must:
   *   1. return a response with updated_at strictly greater than before;
   *   2. mutate the underlying MOCK_EXCEPTIONS entry so the followup
   *      refreshDetail() refetch reads back the SAME fresh ts. Without
   *      (2) the immediate detail reload after a write reverts to the
   *      stale ts and the "Last Updated" label appears frozen.
   *
   * Each test runs against a different exc-id so cross-test mutation
   * doesn't taint other cases.
   */

  async function assertUpdatedAtAdvances(
    excId: string,
    write: () => Promise<{ updated_at: string }>,
  ): Promise<void> {
    const before = await exceptionsApi.get(excId);
    const beforeTs = before.updated_at;
    // Tiny delay so the new ISO ts is strictly greater (test would
    // otherwise be racy on very fast machines where the ms tick is the same).
    await new Promise((r) => setTimeout(r, 5));
    const after = await write();
    expect(after.updated_at).not.toBe(beforeTs);
    expect(new Date(after.updated_at).getTime())
      .toBeGreaterThan(new Date(beforeTs).getTime());
    // refreshDetail() refetch must see the same fresh ts — proves
    // the underlying MOCK_EXCEPTIONS entry was mutated.
    const refetched = await exceptionsApi.get(excId);
    expect(refetched.updated_at).toBe(after.updated_at);
  }

  it("reanalyze advances updated_at and persists to refetch", async () => {
    await assertUpdatedAtAdvances(SAMPLE_EXCEPTION_ID, () =>
      exceptionsApi.reanalyze(SAMPLE_EXCEPTION_ID, { reason: "test" }),
    );
  });

  it("disposition (approve) advances updated_at and persists to refetch", async () => {
    // exc-009 is a YELLOW DUPLICATE_PO PENDING_REVIEW — eligible for
    // disposition without prior cosign infrastructure.
    await assertUpdatedAtAdvances("exc-009", () =>
      exceptionsApi.disposition(
        "exc-009",
        { action: "BLOCK_AND_NOTIFY", notes: "approving", reason_tag: "OTHER" },
      ),
    );
  });

  it("disposition (reject / NO_ACTION) advances updated_at and persists to refetch", async () => {
    // exc-014 is YELLOW PALLET_CONFIG PENDING_REVIEW.
    await assertUpdatedAtAdvances("exc-014", () =>
      exceptionsApi.disposition(
        "exc-014",
        { action: "NO_ACTION", notes: "rejecting", reason_tag: "other" },
      ),
    );
  });

  it("escalate advances updated_at and persists to refetch", async () => {
    // exc-010 is YELLOW BACK_ORDER PENDING_REVIEW — escalate-eligible.
    await assertUpdatedAtAdvances("exc-010", () =>
      exceptionsApi.escalate("exc-010", { reason: "needs senior review" }),
    );
  });

  it("challenge advances updated_at and persists to refetch", async () => {
    // exc-016 is YELLOW DELIVERY_DELAY PENDING_REVIEW — challenge has
    // no eligibility gate in the mock, but use a fresh id for hygiene.
    await assertUpdatedAtAdvances("exc-016", () =>
      exceptionsApi.challenge("exc-016", { challenge_reason: "evidence in dispute" }),
    );
  });

  it("adminRelease advances updated_at and persists to refetch", async () => {
    // exc-019 is RED EDI_MISMATCH BLOCKED — admin-release-eligible.
    await assertUpdatedAtAdvances("exc-019", () =>
      exceptionsApi.adminRelease("exc-019", { release_reason: "false positive", risk_acknowledgment: true }),
    );
  });
});
