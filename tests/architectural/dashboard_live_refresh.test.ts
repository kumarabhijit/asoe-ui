/**
 * Architectural lock — Dashboard live-refresh invariant.
 *
 * The bug this guards against: pre-fix the `/dashboard` Performance
 * page fetched stats once on mount (empty-deps `useEffect`) and never
 * again. No `useWebSocket` handler, no polling fallback. An operator
 * who left the page open watched the KPI tiles stay frozen while
 * their colleagues' work flowed through the system — a static screen
 * requiring a manual refresh, which `CLAUDE.md` Guardrail #4 lists
 * as a forbidden pattern. Sibling pages (`/cases`, `/home`) both
 * wire `useWebSocket` + `onReconnect` + `onPollFallback` so the
 * dashboard sticking out was the regression.
 *
 * The fix wires the same pattern: `useWebSocket` invokes a silent
 * refetch on any `isCaseInvalidationEvent`, on socket reconnect,
 * and on the poll-fallback path. Stats roll up `LifecycleState` /
 * `CaseStatus` totals so every `case_*` event mutates them.
 *
 * Source-level lock (vs running the page) because the bug shape is
 * "the hook is gone": deleting the `useWebSocket` call compiles
 * cleanly and the page renders fine on first paint — the regression
 * only shows up minutes later in real use. A grep lock catches the
 * deletion at unit-test speed.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const PAGE_PATH = path.resolve(
  __dirname,
  "../../src/app/dashboard/page.tsx",
);

describe("/dashboard — live refresh invariants", () => {
  const src = readFileSync(PAGE_PATH, "utf-8");

  it("imports useWebSocket + isCaseInvalidationEvent", () => {
    expect(
      src,
      "useWebSocket import missing — page cannot subscribe to live updates",
    ).toMatch(/import\s+\{\s*useWebSocket\s*\}\s+from\s+["']@\/hooks\/useWebSocket["']/);
    expect(
      src,
      "isCaseInvalidationEvent import missing — page cannot filter " +
        "the live event stream to the case_* events that mutate stats",
    ).toMatch(
      /import\s+\{[^}]*isCaseInvalidationEvent[^}]*\}\s+from\s+["']@\/hooks\/useManualOrderCases["']/,
    );
  });

  it("calls useWebSocket with onEvent + onReconnect + onPollFallback", () => {
    const call = src.match(/useWebSocket\(\{[\s\S]*?\}\)/);
    expect(
      call,
      "useWebSocket(...) call missing — dashboard reverts to a static " +
        "snapshot, which Guardrail #4 forbids",
    ).not.toBeNull();
    const body = call![0];
    expect(
      body,
      "useWebSocket call must wire onEvent so case_* events trigger a refetch",
    ).toMatch(/onEvent\s*:/);
    expect(
      body,
      "useWebSocket call must wire onReconnect — without it a socket " +
        "drop leaves the page frozen until the next event arrives",
    ).toMatch(/onReconnect\s*:/);
    expect(
      body,
      "useWebSocket call must wire onPollFallback — without it the " +
        "polling-fallback path that fires after persistent WS failure " +
        "still leaves stats frozen",
    ).toMatch(/onPollFallback\s*:/);
    expect(
      body,
      "onEvent body must gate the refetch on isCaseInvalidationEvent " +
        "so unrelated events (e.g. health pings) don't thrash the " +
        "stats endpoint",
    ).toMatch(/isCaseInvalidationEvent\(/);
  });

  it("the refetch hook is reused across initial-load and live-refresh paths", () => {
    // The same function must back both the initial fetch and the
    // WS-driven refresh — otherwise it's easy for a maintainer to
    // diverge them (e.g. add a new field to the initial fetch and
    // forget the live one). Pattern: a `refetchStats` useCallback
    // invoked from BOTH the mount-time useEffect AND the WS handlers.
    expect(
      src,
      "refetchStats useCallback missing — the WS refresh path must " +
        "share the same fetch implementation as the initial load",
    ).toMatch(/const\s+refetchStats\s*=\s*useCallback/);
  });
});
