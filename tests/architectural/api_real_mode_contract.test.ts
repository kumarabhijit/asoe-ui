/**
 * Architectural contract: when USE_REAL_API is on, the api client must
 * call asoe2 with the exact path/method/query the server expects.
 *
 * Regression #1: list() previously sent ?lifecycle_state=, but the server
 * (api/routes/exceptions.py) reads the query param as `status`. Filter-by-
 * state silently no-op'd against the live API.
 *
 * Regression #2: NextAuth authorize() previously read `user.id` from the
 * login response; the server's UserProfile (api/schemas.py) only carries
 * `sub`. The session would receive id=undefined and degrade.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// USE_REAL_API is read at module init time, so env must be set before
// the module is imported (vi.resetModules + dynamic import in each test).
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_USE_REAL_API", "1");
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test.example");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

interface RoutedFetchCall {
  url: string;
  method: string;
}

/** Returns a fetch mock that routes by URL. Records every call for assertions. */
function makeRoutedFetch(routes: Record<string, () => Response>) {
  const calls: RoutedFetchCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method });
    for (const [pathFragment, build] of Object.entries(routes)) {
      if (url.includes(pathFragment)) return build();
    }
    return new Response(JSON.stringify({ error: { code: "404", message: "no route" } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  });
  return { fn, calls };
}

describe("exceptionsApi.list (real-API mode)", () => {
  it("sends the filter as ?status=, not ?lifecycle_state=", async () => {
    const { fn: fetchMock, calls } = makeRoutedFetch({
      "/api/v1/exceptions": () =>
        new Response(JSON.stringify({ data: [], has_more: false }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      // Stub NextAuth's session probe so getAuthToken() doesn't blow up.
      "/api/auth/session": () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const api = await import("../../src/lib/api");
    await api.exceptionsApi.list({ status: "PENDING_REVIEW" });

    const exceptionCalls = calls.filter((c) => c.url.includes("/api/v1/exceptions"));
    expect(exceptionCalls).toHaveLength(1);
    const url = new URL(exceptionCalls[0].url);
    expect(url.pathname).toBe("/api/v1/exceptions");
    expect(url.searchParams.get("status")).toBe("PENDING_REVIEW");
    expect(url.searchParams.get("lifecycle_state")).toBeNull();
  });
});

describe("NextAuth authorize() returns id mapped from sub (source check)", () => {
  // Behavioural test of authorize() itself is brittle in jsdom because
  // NextAuth's getSession() probes from inside http() before our
  // mock can intervene cleanly. The fix is a one-line mapping in
  // src/lib/auth.ts; we lock it via a static source-string check here
  // so a future contributor can't silently revert to user.id (which
  // does not exist on the server's UserProfile contract).
  it("uses user.sub, not user.id, as the NextAuth user id", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../src/lib/auth.ts"),
      "utf-8",
    );
    expect(src).toMatch(/id:\s*user\.sub/);
    // Also assert the broken form isn't reintroduced.
    expect(src).not.toMatch(/return\s*\{\s*\n\s*id:\s*user\.id/);
  });
});
