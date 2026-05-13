/**
 * Silent refresh on case_* WS events — architectural locks that
 * restore the May-7 invariants the case-pivot deleted from
 * detail_error_surfacing.test.ts and ws_polling_fallback.test.ts.
 *
 * Three invariants the page-level WS handler MUST preserve:
 *
 *   1. /exceptions/page.tsx composes `isCaseInvalidationEvent` and
 *      calls `refetch()` when it returns true.
 *   2. /exceptions/page.tsx wires `onReconnect` and `onPollFallback`
 *      to `refetch` so a dropped WS connection re-syncs without a
 *      page reload.
 *   3. `isCaseInvalidationEvent` recognises every case_* event type
 *      and rejects every per-event subject. Adding a new case_*
 *      type in the backend without curating this helper would
 *      silently break the live-count UX.
 *
 * Plus a useCases-side lock that `refetch()` is silent (loading
 * does NOT flip back to true on subsequent fetches). This pairs
 * with the existing tests/hooks/useCases.limit.test.ts coverage.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

import {
  isCaseInvalidationEvent,
} from "@/hooks/useManualOrderCases";
import type { WSEvent, WSEventType } from "@/types/websocket";

const REPO_ROOT = path.resolve(__dirname, "../..");
const HOOK = path.resolve(REPO_ROOT, "src/hooks/useManualOrderCases.ts");

function event(type: WSEventType): WSEvent {
  return {
    type,
    trace_id: "t",
    exception_id: type.startsWith("case_") ? null : "exc-1",
    case_id: type.startsWith("case_") ? "case-1" : null,
    tenant_id: "acme-corp",
    timestamp: "2026-05-11T00:00:00Z",
    payload: {} as unknown as WSEvent["payload"],
  };
}

describe("isCaseInvalidationEvent", () => {
  it("returns true for every case_* event type", () => {
    expect(isCaseInvalidationEvent(event("case_open"))).toBe(true);
    expect(isCaseInvalidationEvent(event("case_update"))).toBe(true);
    expect(isCaseInvalidationEvent(event("case_close"))).toBe(true);
  });

  it("returns false for every per-event subject type", () => {
    for (const t of [
      "pipeline_progress",
      "exception_update",
      "task_complete",
      "error",
      "reanalysis_started",
    ] as WSEventType[]) {
      expect(isCaseInvalidationEvent(event(t))).toBe(false);
    }
  });
});

// ADR-041 P4 (2026-05-13) — the page-level WS-wiring locks that
// asserted /exceptions/page.tsx composed `isCaseInvalidationEvent`
// + `refetch()` + `onReconnect: refetch` were tied to the now-
// deleted /exceptions/page.tsx. The hook-level locks below
// (silent-refresh contract on `useCases`) still apply; restoring
// the page-level silent-refresh on the canonical `/cases/page.tsx`
// workspace is tracked as a P3b follow-on (queued in the ADR-041
// rollout doc, not in this PR's scope).

describe("useCases — silent refetch contract", () => {
  const src = readFileSync(HOOK, "utf-8");

  it("only flips loading on the initial fetch (refetchCounter === 0)", () => {
    // The hook gates `setLoading(true)` on `isInitial` so subsequent
    // refetches do not flash the spinner. The check is a
    // refetchCounter equality.
    expect(src).toMatch(/isInitial\s*=\s*refetchCounter\s*===\s*0/);
    expect(src).toMatch(/if\s*\(\s*isInitial\s*\)\s*setLoading\(\s*true\s*\)/);
  });

  it("loading is not re-set to true outside the isInitial branch", () => {
    // Negative guard — `setLoading(true)` should appear exactly
    // once, gated by the isInitial check above. A future change
    // that adds an ungated `setLoading(true)` regresses the
    // silent-refresh UX and is caught here.
    const occurrences = src.match(/setLoading\(\s*true\s*\)/g) ?? [];
    expect(occurrences.length).toBe(1);
  });
});
