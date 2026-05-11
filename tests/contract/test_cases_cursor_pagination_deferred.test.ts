/**
 * Cursor pagination on /api/v1/cases (ADR-038 §D7 amendment, landed 2026-05-11).
 *
 * The May-7 /exceptions page used a do-while cursor loop against
 * /api/v1/exceptions. The case-projected post-pivot UI talks to
 * /api/v1/cases, which originally had no cursor in its response
 * shape (CaseListResponse: `{ items, total }`). The ADR-038 §D7
 * amendment added `cursor` + `has_more` to the schema and the
 * route; this file pins the resulting invariants.
 *
 * The previous file held two locks as `it.skip` plus an active
 * regression guard. With the backend amendment landed the
 * structural lock is now active and the regression guard is the
 * inverse (fail if cursor / has_more disappear from
 * CaseListResponse).
 *
 * Searchable handle: cases-cursor-pagination
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../..");
const OPENAPI_PATH = path.resolve(REPO_ROOT, "..", "asoe2", "openapi", "asoe2.openapi.json");
const HOOK_PATH = path.resolve(REPO_ROOT, "src/hooks/useManualOrderCases.ts");

describe("cases cursor pagination — landed invariants", () => {
  it("useCases accumulates across cursor pages until has_more=false", () => {
    const src = readFileSync(HOOK_PATH, "utf-8");
    // Strict shape lock per the May-7 /exceptions/page.tsx
    // convention — the loop walks until `has_more` is false.
    expect(src).toMatch(/has_more/);
    expect(src).toMatch(/cursor\s*=\s*res\.cursor/);
    expect(src).toMatch(/accumulated\.push/);
  });

  if (!existsSync(OPENAPI_PATH)) {
    it.skip("sibling OpenAPI missing — skipping schema guard", () => {});
    return;
  }

  it("CaseListResponse carries cursor + has_more in the OpenAPI document", () => {
    const openapi = JSON.parse(readFileSync(OPENAPI_PATH, "utf-8"));
    const schema = openapi.components?.schemas?.CaseListResponse;
    expect(schema, "CaseListResponse schema missing from OpenAPI").toBeDefined();
    const properties = (schema?.properties ?? {}) as Record<string, unknown>;
    expect(
      "cursor" in properties,
      "CaseListResponse.cursor missing — ADR-038 §D7 amendment regressed",
    ).toBe(true);
    expect(
      "has_more" in properties,
      "CaseListResponse.has_more missing — ADR-038 §D7 amendment regressed",
    ).toBe(true);
  });
});
