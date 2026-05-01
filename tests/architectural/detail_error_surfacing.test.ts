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

describe("ExceptionQueuePage: WS reconnect refreshes both list and detail", () => {
  const PAGE_PATH = path.resolve(
    __dirname,
    "../../src/app/exceptions/page.tsx",
  );

  it("passes onReconnect to useWebSocket", () => {
    const src = readFileSync(PAGE_PATH, "utf-8");
    expect(src).toMatch(/onReconnect:\s*handleWsReconnect/);
  });

  it("handleWsReconnect refreshes both list (silent) and detail", () => {
    const src = readFileSync(PAGE_PATH, "utf-8");
    const reconnectFnMatch = src.match(
      /const handleWsReconnect = useCallback[\s\S]*?\}, \[fetchData\]\)/,
    );
    expect(reconnectFnMatch, "handleWsReconnect block not found").toBeTruthy();
    expect(reconnectFnMatch![0]).toMatch(/fetchData\(\{\s*silent:\s*true\s*\}\)/);
    expect(reconnectFnMatch![0]).toMatch(/detailRefreshRef\.current\?\.\(\)/);
  });
});

describe("ExceptionQueuePage: list pagination follows cursor", () => {
  const PAGE_PATH = path.resolve(
    __dirname,
    "../../src/app/exceptions/page.tsx",
  );

  it("loops on cursor until has_more=false", () => {
    const src = readFileSync(PAGE_PATH, "utf-8");
    // The cursor-loop pattern: do ... while(cursor) with has_more guarding
    // the next-cursor assignment.
    expect(src).toMatch(/do\s*\{[\s\S]*has_more[\s\S]*\}\s*while\s*\(cursor\)/);
  });

  it("WS event handlers use silent refresh, not the loading-flicker path", () => {
    const src = readFileSync(PAGE_PATH, "utf-8");
    // exception_update + task_complete paths must pass silent: true.
    const exceptionUpdateBlock = src.match(
      /event\.type === "exception_update"[\s\S]*?(?=\}\s*else if)/,
    );
    expect(exceptionUpdateBlock, "exception_update branch not found").toBeTruthy();
    expect(exceptionUpdateBlock![0]).toMatch(/silent:\s*true/);
    const taskCompleteBlock = src.match(
      /event\.type === "task_complete"[\s\S]*?(?=\}\s*else if)/,
    );
    expect(taskCompleteBlock, "task_complete branch not found").toBeTruthy();
    expect(taskCompleteBlock![0]).toMatch(/silent:\s*true/);
  });
});
