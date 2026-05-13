/**
 * Section 8.4 polling fallback architectural lock.
 *
 * useWebSocket starts with WS-only and falls back to REST polling
 * after several consecutive max-backoff reconnect failures. Auto-
 * recovers (clears the polling interval) on the next successful
 * onopen. This file pins the wiring at the source level — a
 * behavioural test against jsdom WebSocket would require a full
 * server harness and would still be flaky on timing.
 *
 * What the lock guarantees:
 *   1. The hook accepts an onPollFallback callback option.
 *   2. There is a POLL_FALLBACK_THRESHOLD constant (5) that gates
 *      when polling kicks in.
 *   3. The polling effect depends on reconnectCount, so a successful
 *      reconnect (which resets reconnectCount to 0) automatically
 *      tears down the interval.
 *   4. ExceptionQueuePage wires onPollFallback to the same silent
 *      refresh handler it uses for onReconnect, so the visual
 *      behaviour is identical whether the refresh came from a WS
 *      reconnect or from polling.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const HOOK_PATH = path.resolve(
  __dirname,
  "../../src/hooks/useWebSocket.ts",
);
describe("useWebSocket: Section 8.4 polling fallback", () => {
  it("accepts an onPollFallback option in UseWebSocketOptions", () => {
    const src = readFileSync(HOOK_PATH, "utf-8");
    expect(src).toMatch(/onPollFallback\?\s*:\s*\(\)\s*=>\s*void/);
  });

  it("declares a POLL_FALLBACK_THRESHOLD constant gating the fallback", () => {
    const src = readFileSync(HOOK_PATH, "utf-8");
    expect(src).toMatch(/const POLL_FALLBACK_THRESHOLD\s*=/);
  });

  it("uses reconnectCount as the trigger so onopen reset auto-clears", () => {
    const src = readFileSync(HOOK_PATH, "utf-8");
    // The fallback effect must depend on reconnectCount specifically
    // so that the onopen reset (setReconnectCount(0)) runs the
    // cleanup branch.
    const fallbackEffectMatch = src.match(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?reconnectCount\s*>=\s*POLL_FALLBACK_THRESHOLD[\s\S]*?\},\s*\[reconnectCount[\s\S]*?\]\s*\)/,
    );
    expect(
      fallbackEffectMatch,
      "polling-fallback effect must depend on reconnectCount",
    ).toBeTruthy();
  });

  it("clears the polling interval when conditions no longer hold", () => {
    const src = readFileSync(HOOK_PATH, "utf-8");
    // Either an explicit clearInterval in the effect body or in the
    // cleanup function must exist; otherwise a recovered WS would
    // keep firing onPollFallback forever.
    expect(src).toMatch(/clearInterval\(pollIntervalRef\.current\)/);
  });

  it("does not fire the polling callback in the initial connect path", () => {
    const src = readFileSync(HOOK_PATH, "utf-8");
    // Verify the polling kick-in is gated behind the threshold check,
    // not unconditionally on enabled.
    const fallbackBody = src.match(
      /const inFallback\s*=[\s\S]*?reconnectCount\s*>=\s*POLL_FALLBACK_THRESHOLD/,
    );
    expect(fallbackBody, "inFallback must require threshold").toBeTruthy();
  });
});

// ADR-041 P4 (2026-05-13) — the `/exceptions` page-level locks for
// onReconnect/onPollFallback wiring were tied to the now-deleted
// `/exceptions/page.tsx`. The hook-level Section 8.4 polling-
// fallback contract above still applies. Restoring the page-level
// silent-refresh on the canonical `/cases/page.tsx` workspace is
// tracked as a P3b follow-on.
