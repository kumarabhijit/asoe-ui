/**
 * Regression — two mock-layer defects the operator hit on the Vercel
 * mock preview after PR #174/#175 wired post-action refetch:
 *
 *  1. APPROVE was a no-op. `useExceptionActions.handleApprove` endorses
 *     `detail.resolution_data.recommended_action`; when it's absent the
 *     handler short-circuits with a "No recipe recommendation — use
 *     Override" warning and never calls disposition. The mock
 *     `exceptionsApi.get` returned an empty (or COMPLETE-only)
 *     `resolution_data`, so EVERY actionable record lacked a
 *     recommendation and Approve did nothing. The live backend always
 *     populates it from build_analysis; the mock now mirrors that by
 *     sourcing the order analysis's top-level `resolution`.
 *
 *  2. Actions did not survive a reload. The mock action paths mutate
 *     the in-memory MOCK_EXCEPTIONS row, but that array re-seeds on
 *     every full page load — so an Approve/Override would "revert" to
 *     Awaiting review when the operator reloaded `/home` or opened it
 *     in a fresh tab. A localStorage overlay now persists the lifecycle
 *     mutation and replays it onto the seed at module load.
 *
 * Both assertions FAIL on the parent commit (recommended_action absent;
 * no localStorage persistence) and PASS with the fix.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { exceptionsApi } from "@/lib/api";
import {
  MOCK_EXCEPTIONS,
  clearMockExceptionOverlay,
} from "@/lib/mock-data/exceptions";

const OVERLAY_KEY = "asoe:mock-exception-overlay:v1";

// exc-002 is a PENDING_REVIEW DUPLICATE_PO whose order analysis
// recommends BLOCK_AND_NOTIFY. The global beforeEach in tests/setup.ts
// restores it to the seed lifecycle before each test here.
const PENDING_ID = "exc-002";

describe("mock recommended_action — Approve has something to endorse", () => {
  it("exceptionsApi.get surfaces resolution_data.recommended_action for an actionable record", async () => {
    const detail = await exceptionsApi.get(PENDING_ID);
    expect(
      detail.resolution_data.recommended_action,
      "the mock detail must carry the recipe's recommended action so " +
        "handleApprove can endorse it instead of short-circuiting with " +
        "'No recipe recommendation — use Override'",
    ).toBe("BLOCK_AND_NOTIFY");
  });

  it("recommended_action is a non-empty string the approve handler can dispatch", async () => {
    const detail = await exceptionsApi.get(PENDING_ID);
    const v = (detail.resolution_data as Record<string, unknown>)
      .recommended_action;
    expect(typeof v).toBe("string");
    expect((v as string).length).toBeGreaterThan(0);
  });
});

describe("mock action overlay — mutations survive a reload", () => {
  beforeEach(() => {
    clearMockExceptionOverlay();
  });

  it("disposition persists the lifecycle mutation to localStorage", async () => {
    await exceptionsApi.disposition(PENDING_ID, {
      action: "ALLOW_BOTH",
      notes: "approved by reviewer",
      reason_tag: "OTHER",
    });

    const raw = window.localStorage.getItem(OVERLAY_KEY);
    expect(raw, "disposition must persist the mutation for reload resilience").toBeTruthy();
    const overlay = JSON.parse(raw as string);
    expect(overlay[PENDING_ID]?.lifecycle_state).toBe("RESOLVED");
    expect(overlay[PENDING_ID]?.final_status).toBe("COMPLETE");
  });

  it("replays a persisted mutation onto the seed on a fresh module load", async () => {
    await exceptionsApi.disposition(PENDING_ID, {
      action: "ALLOW_BOTH",
      notes: "approved by reviewer",
      reason_tag: "OTHER",
    });

    // Simulate a full page reload: a fresh import re-seeds
    // MOCK_EXCEPTIONS from the fixture, then replays the localStorage
    // overlay on top. The persisted RESOLVED must win over the seed's
    // PENDING_REVIEW.
    vi.resetModules();
    const fresh = await import("@/lib/mock-data/exceptions");
    const row = fresh.MOCK_EXCEPTIONS.find((e) => e.id === PENDING_ID);
    expect(
      row?.lifecycle_state,
      "a reload must replay the persisted disposition, not revert to seed",
    ).toBe("RESOLVED");

    fresh.clearMockExceptionOverlay();
  });

  it("escalate is also persisted", async () => {
    await exceptionsApi.escalate(PENDING_ID, { reason: "needs senior review" });
    const overlay = JSON.parse(
      window.localStorage.getItem(OVERLAY_KEY) ?? "{}",
    );
    expect(overlay[PENDING_ID]?.lifecycle_state).toBe("ESCALATED");
  });
});

describe("overlay isolation — reset clears persisted state", () => {
  it("the per-test reset removes the overlay so mutations don't leak", () => {
    // The global beforeEach (tests/setup.ts) calls resetMockExceptions
    // which clears the overlay. By the time this test runs, any overlay
    // written by the prior tests must be gone and the seed restored.
    expect(window.localStorage.getItem(OVERLAY_KEY)).toBeNull();
    expect(
      MOCK_EXCEPTIONS.find((e) => e.id === PENDING_ID)?.lifecycle_state,
    ).toBe("PENDING_REVIEW");
  });
});
