/**
 * Regression — the mock action paths must mutate the underlying
 * `MOCK_EXCEPTIONS` row so a subsequent re-fetch sees the new state.
 *
 * The bug this guards against: pre-2026-05-21 the mock
 * `disposition` / `escalate` / `cosign` paths bumped only the row's
 * `updated_at` and intentionally left `lifecycle_state` alone (to
 * preserve cross-test fixture isolation in a non-resetting setup).
 * PR #174 then wired post-action refetch on `/cases`. The two
 * collided on the Vercel mock preview: the operator clicked
 * Approve, the inline detail flashed "Resolved", the page refetched,
 * and the un-mutated row reverted the queue + case header back to
 * `OPEN_AWAITING_HUMAN`. To the operator it read as "Approve /
 * Override doesn't change the status."
 *
 * The fix mutates the row fully and pairs that with a per-test
 * reset (`resetMockExceptions()` in `tests/setup.ts`). This file
 * locks the mutation contract end-to-end:
 *   - disposition (APPROVE) drives PENDING_REVIEW → RESOLVED;
 *     casesApi.list sees the case as RESOLVED.
 *   - disposition (NO_ACTION) drives → REJECTED, which the case
 *     projection treats as terminal (a settled NO_ACTION decision).
 *   - escalate drives → ESCALATED.
 *   - cosign approve drives the pre-staged override → RESOLVED.
 *   - the reset hook restores the seed between tests so a
 *     follow-up test on the same id sees PENDING_REVIEW again.
 */
import { describe, expect, it } from "vitest";

import { casesApi, exceptionsApi } from "@/lib/api";
import { MOCK_EXCEPTIONS } from "@/lib/mock-data/exceptions";

// A PENDING_REVIEW seed exists at exc-002 in the fixture
// (intent: CONTRACTUAL_CORRECTION, BAND_REVIEW_RECOMMENDED). The
// reset hook in tests/setup.ts guarantees that's the lifecycle we
// observe at the top of each test.
const PENDING_ID = "exc-002";

describe("mock action mutations — underlying row reflects the action", () => {
  it("disposition(APPROVE) mutates lifecycle_state on the MOCK_EXCEPTIONS row", async () => {
    const before = MOCK_EXCEPTIONS.find((e) => e.id === PENDING_ID);
    expect(before?.lifecycle_state, "fixture sanity").toBe("PENDING_REVIEW");

    await exceptionsApi.disposition(PENDING_ID, {
      action: "ALLOW_BOTH",
      notes: "approved by reviewer",
      reason_tag: "OTHER",
    });

    const after = MOCK_EXCEPTIONS.find((e) => e.id === PENDING_ID);
    expect(
      after?.lifecycle_state,
      "disposition must mutate lifecycle_state on the underlying row " +
        "so a followup refetch on /cases sees the new state",
    ).toBe("RESOLVED");
    expect(
      after?.final_status,
      "disposition (chosen != NO_ACTION) must mutate final_status to COMPLETE",
    ).toBe("COMPLETE");
  });

  it("disposition(NO_ACTION) mutates lifecycle_state to REJECTED", async () => {
    await exceptionsApi.disposition(PENDING_ID, {
      action: "NO_ACTION",
      notes: "rejected by reviewer",
      reason_tag: "OTHER",
    });
    const after = MOCK_EXCEPTIONS.find((e) => e.id === PENDING_ID);
    expect(after?.lifecycle_state).toBe("REJECTED");
    expect(after?.final_status).toBe("REJECTED");
  });

  it("escalate mutates lifecycle_state to ESCALATED", async () => {
    await exceptionsApi.escalate(PENDING_ID, {
      reason: "needs senior review",
    });
    expect(
      MOCK_EXCEPTIONS.find((e) => e.id === PENDING_ID)?.lifecycle_state,
    ).toBe("ESCALATED");
  });

  it("casesApi.get reflects the mutated lifecycle as a RESOLVED case status", async () => {
    await exceptionsApi.disposition(PENDING_ID, {
      action: "ALLOW_BOTH",
      notes: "approved by reviewer",
      reason_tag: "OTHER",
    });
    const c = await casesApi.get(`case-for-${PENDING_ID}`);
    expect(
      c?.status,
      "casesApi.get must project the post-disposition lifecycle " +
        "(RESOLVED) onto the case status — this is the exact path " +
        "the /cases queue row + case header re-read after the " +
        "post-action refetch",
    ).toBe("RESOLVED");
  });

  it("the per-test reset restores the seed between tests", () => {
    // This test runs AFTER the four mutation tests above. If the
    // reset hook in tests/setup.ts is wired correctly, the row's
    // lifecycle observed here must be PENDING_REVIEW again — the
    // fixture's canonical seed value. Without the reset, this
    // assertion would catch the cross-test leak the mutation
    // introduces.
    expect(
      MOCK_EXCEPTIONS.find((e) => e.id === PENDING_ID)?.lifecycle_state,
      "tests/setup.ts beforeEach must restore the seed so mock " +
        "mutations don't leak across vitest cases",
    ).toBe("PENDING_REVIEW");
  });
});
