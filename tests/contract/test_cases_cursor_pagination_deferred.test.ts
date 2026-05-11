/**
 * Cursor pagination on /api/v1/cases — deferred ADR tracker.
 *
 * The May-7 /exceptions page used a do-while cursor loop against
 * /api/v1/exceptions. The case-projected post-pivot UI talks to
 * /api/v1/cases instead, which has no cursor in its response shape
 * (CaseListResponse: `{ items, total }`). Porting the cursor loop
 * needs a backend ADR amendment — see
 * docs/test-strategy/cases-cursor-pagination-tracking.md.
 *
 * Until the ADR lands the test below stays skip-marked but its body
 * documents the expected un-skip shape so the future change is a
 * one-line marker flip.
 *
 * Searchable handle: cases-cursor-pagination
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../..");
const OPENAPI_PATH = path.resolve(REPO_ROOT, "..", "asoe2", "openapi", "asoe2.openapi.json");
const HOOK_PATH = path.resolve(REPO_ROOT, "src/hooks/useManualOrderCases.ts");

describe("cases cursor pagination — deferred ADR tracker", () => {
  // cases-cursor-pagination: flip to `it(...)` once asoe2's
  // CaseListResponse grows `cursor` + `has_more` fields and
  // useCases adopts the do-while loop. Body below is the lock.
  it.skip("useCases accumulates across cursor pages until has_more=false", () => {
    const src = readFileSync(HOOK_PATH, "utf-8");
    // Strict shape lock per the asoe2 ExceptionsApi convention
    // (mirrors May-7 /exceptions/page.tsx loop).
    expect(src).toMatch(/do\s*\{[\s\S]+has_more[\s\S]+\}\s*while\s*\(\s*cursor/);
  });

  // Active companion: confirms the gap is still real. If asoe2
  // adds cursor to CaseListResponse without the UI catching up,
  // this test fails — which is the cue to flip the skip above.
  if (!existsSync(OPENAPI_PATH)) {
    it.skip("sibling OpenAPI missing — skipping deferral guard", () => {});
    return;
  }

  it("regression guard — backend CaseListResponse remains cursor-free", () => {
    const openapi = JSON.parse(readFileSync(OPENAPI_PATH, "utf-8"));
    const schema = openapi.components?.schemas?.CaseListResponse;
    expect(
      schema,
      "CaseListResponse schema missing from OpenAPI",
    ).toBeDefined();
    const properties = (schema?.properties ?? {}) as Record<string, unknown>;
    // The day either of these appears, flip the skip above and
    // promote `useCases` to a cursor loop. Update the tracking
    // doc in the same PR.
    expect(
      "cursor" in properties || "has_more" in properties,
      "CaseListResponse grew cursor / has_more — flip the it.skip above " +
      "and update docs/test-strategy/cases-cursor-pagination-tracking.md",
    ).toBe(false);
  });
});
