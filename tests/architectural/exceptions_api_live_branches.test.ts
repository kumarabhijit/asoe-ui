/**
 * Architectural lock: every mutating exceptionsApi method that has a
 * live REST endpoint must have an `if (USE_REAL_API)` branch in
 * src/lib/api.ts.
 *
 * History: `exceptionsApi.reanalyze` was missing its live branch.
 * Against the real backend the call fell through to the mock body
 * which did `MOCK_EXCEPTIONS.find()` on a live exception id — always
 * returned undefined — and threw "Exception not found" without a
 * network roundtrip. The user reported "Reanalyze option is not
 * working"; the symptom was that the mock-only code path was the
 * only code path.
 *
 * This file pins the wiring at the source level: every method that
 * targets a documented REST endpoint must contain
 * `if (USE_REAL_API)` AND a corresponding `http<...>(` call to the
 * matching path. We assert the pair by static-string regex rather
 * than a behavioural test because the alternative is a full mock
 * fetch+jsdom harness that's flaky and slow.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const API_PATH = path.resolve(__dirname, "../../src/lib/api.ts");
const SRC = readFileSync(API_PATH, "utf-8");

// (method-on-exceptionsApi, http path fragment that must appear in the live branch)
// Order doesn't matter; this is an existence check. Notes:
//   * No standalone `override` method on the client — overrides flow
//     through `cosign` (the four-eyes second-reviewer endpoint) and
//     `disposition` (apply approved action), both listed below.
const LIVE_METHODS: Array<[string, string]> = [
  ["list", "/api/v1/exceptions"],
  ["get", "/api/v1/exceptions/${id}"],
  ["cosign", "/api/v1/exceptions/${id}/override/cosign"],
  ["disposition", "/api/v1/exceptions/${id}/disposition"],
  ["escalate", "/api/v1/exceptions/${id}/escalate"],
  ["reanalyze", "/api/v1/exceptions/${id}/reanalyze"],
];

// Scope the per-method search to the body of `export const exceptionsApi = {`
// so a method name that collides with another API surface (e.g. `get` on
// healthApi / orderCasesApi) doesn't false-match. The exceptionsApi block
// is delimited by the next `export const \w+Api = {` declaration.
const EXCEPTIONS_API_HEADER = /export\s+const\s+exceptionsApi\s*=\s*\{/;
const NEXT_API_HEADER = /export\s+const\s+\w+Api\s*=\s*\{/g;

function exceptionsApiBody(): string {
  const headerMatch = SRC.match(EXCEPTIONS_API_HEADER);
  if (!headerMatch || headerMatch.index === undefined) {
    throw new Error("exceptionsApi declaration not found in src/lib/api.ts");
  }
  const start = headerMatch.index + headerMatch[0].length;
  NEXT_API_HEADER.lastIndex = start;
  const next = NEXT_API_HEADER.exec(SRC);
  const end = next ? next.index : SRC.length;
  return SRC.slice(start, end);
}

describe("exceptionsApi: every documented mutation has a USE_REAL_API branch", () => {
  const BODY = exceptionsApiBody();
  for (const [method, pathFragment] of LIVE_METHODS) {
    it(`${method} sends to ${pathFragment} when USE_REAL_API is set`, () => {
      // Find the method body. Methods are object-shorthand so we look
      // for `async ${method}(` and capture until the next async-method
      // boundary OR end of object.
      const methodHeader = new RegExp(`async\\s+${method}\\s*\\(`);
      const headerMatch = BODY.match(methodHeader);
      expect(headerMatch, `method ${method} not found in exceptionsApi`).toBeTruthy();
      const start = headerMatch!.index!;
      // Cheap upper bound: search the next ~6kb for both `USE_REAL_API`
      // and the path fragment. Each method body fits well within this.
      const window = BODY.slice(start, start + 6000);
      expect(
        window,
        `${method} body must contain "if (USE_REAL_API)"`,
      ).toMatch(/if\s*\(\s*USE_REAL_API\s*\)/);
      expect(
        window,
        `${method} body must call http<...>(\`${pathFragment}\`...)`,
      ).toContain(pathFragment);
    });
  }
});

describe("reanalyze regression: the bug that prompted this lock", () => {
  it("the USE_REAL_API gate appears BEFORE the mock-body MOCK_EXCEPTIONS.find inside reanalyze", () => {
    // The bug shape: mock body unconditionally ran MOCK_EXCEPTIONS.find
    // → throw "Exception not found" without a network roundtrip. The
    // fix is the USE_REAL_API gate that returns BEFORE the mock body
    // runs.
    //
    // Scope the assertion to the reanalyze method body only — other
    // methods (`get`, `lineItems`, etc.) also throw "Exception not
    // found" from their own mock bodies, so a global search would
    // false-positive.
    const headerIdx = SRC.search(/async\s+reanalyze\s*\(/);
    expect(headerIdx, "reanalyze method not found").toBeGreaterThan(-1);
    // Method body fits comfortably in the next 6kb; bound the slice.
    const body = SRC.slice(headerIdx, headerIdx + 6000);
    const useRealApiIdx = body.search(/if\s*\(\s*USE_REAL_API\s*\)/);
    const findIdx = body.search(/MOCK_EXCEPTIONS\.find/);
    expect(useRealApiIdx, "USE_REAL_API gate missing in reanalyze").toBeGreaterThan(-1);
    expect(findIdx, "MOCK_EXCEPTIONS.find missing in reanalyze").toBeGreaterThan(-1);
    // The gate must appear textually before the mock find — i.e. the
    // function returns early on USE_REAL_API and never executes the
    // mock body.
    expect(useRealApiIdx).toBeLessThan(findIdx);
  });
});
