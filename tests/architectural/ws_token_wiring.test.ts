/**
 * useWebSocket token-wiring lock.
 *
 * Regression context (Phase 2 UX audit, 2026-06-11): `connect()` no-ops
 * without a token, and three call sites (/cases workspace, legacy
 * /dashboard, ControlTower) mounted the hook without passing one — so
 * those surfaces silently never connected. Worse, the Section 8.4
 * polling fallback never armed either, because it only counts failed
 * reconnects of a socket that was actually attempted. Net effect: the
 * exact "static screen requiring manual refresh" Guardrail #4 forbids,
 * invisible in dev because nothing errored.
 *
 * The fix makes the hook self-sufficient: it derives the session token
 * via useAuth() when the caller doesn't pass one, so no current or
 * future call site can repeat the bug. This lock pins that wiring at
 * the source level (same style as ws_polling_fallback.test.ts).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const HOOK_PATH = path.resolve(__dirname, "../../src/hooks/useWebSocket.ts");

describe("useWebSocket: session-token fallback wiring", () => {
  const src = readFileSync(HOOK_PATH, "utf-8");

  it("imports useAuth for the session-token fallback", () => {
    expect(src).toMatch(/import \{ useAuth \} from "@\/hooks\/useAuth"/);
  });

  it("derives an effective token from the option with session fallback", () => {
    expect(src).toMatch(/const \{ accessToken \} = useAuth\(\)/);
    expect(src).toMatch(/const effectiveToken = token \?\? accessToken/);
  });

  it("gates connect() on the effective token, not the raw option", () => {
    expect(src).toMatch(/if \(!effectiveToken \|\| !enabled\) return/);
    expect(src).not.toMatch(/if \(!token \|\| !enabled\) return/);
  });

  it("authenticates the socket with the effective token", () => {
    expect(src).toMatch(/token: effectiveToken/);
  });

  it("re-runs connect when the session token materialises", () => {
    // The connect callback must depend on effectiveToken so a session
    // that finishes loading after mount still triggers a connect.
    expect(src).toMatch(/\}, \[effectiveToken, enabled, url\]\)/);
  });
});
