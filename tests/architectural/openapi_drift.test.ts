/**
 * Phase 2 #9 — drift-detect test for the generated OpenAPI types.
 *
 * The source of truth is asoe2/openapi/asoe2.openapi.json (produced by
 * `python scripts/export_openapi.py` on the backend). Every time the
 * backend contract changes, both the schema file AND the generated types
 * must be regenerated and committed. This test re-runs the generator
 * into a temp file and diffs against the committed src/types/generated.ts;
 * a non-empty diff means the committed copy is stale.
 *
 * Also (review M4): the OpenAPI schema does NOT carry enum values for
 * `allowed_intents` / `allowed_recipes` (the `/health` response types
 * as `string[]`), so re-generating doesn't catch a new intent shipped
 * in asoe2 that the UI mock forgot. The "backend vocabulary parity"
 * test below reads asoe2's `constraints/specs.py` Literals directly
 * and diffs them against MOCK_HEALTH — the same drift-detect guarantee
 * that the OpenAPI regen gives us for everything else.
 *
 * To refresh:
 *     npm run generate-types
 *     git add src/types/generated.ts
 */

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import { MOCK_HEALTH } from "../fixtures";

const SCHEMA_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "asoe2",
  "openapi",
  "asoe2.openapi.json",
);
const COMMITTED = join(__dirname, "..", "..", "src", "types", "generated.ts");
const ASOE2_SPECS_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "asoe2",
  "constraints",
  "specs.py",
);

/**
 * Extract the string values from a `Literal[...]` definition in a Python
 * source file. Minimal, string-based; avoids pulling in a Python parser
 * for a single-purpose test.
 *
 * Matches patterns like:
 *   NAME = Literal[
 *       "FOO",
 *       "BAR",
 *   ]
 * Stops at the closing `]`. Strips trailing-comma artefacts; preserves
 * the declared order.
 */
function extractLiteralValues(source: string, name: string): string[] {
  const startRe = new RegExp(
    // Match `NAME = Literal[` across whitespace, with optional leading type decl
    String.raw`${name}\s*=\s*Literal\s*\[`,
    "m",
  );
  const start = source.match(startRe);
  if (!start || start.index === undefined) return [];
  const afterOpen = source.slice(start.index + start[0].length);
  const closeIdx = afterOpen.indexOf("]");
  if (closeIdx === -1) return [];
  const body = afterOpen.slice(0, closeIdx);
  // Pull every double-quoted string literal, in source order.
  const quoted = [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return quoted;
}

describe("OpenAPI generated types drift", () => {
  it("src/types/generated.ts matches a fresh generation from the backend schema", () => {
    if (!existsSync(SCHEMA_PATH)) {
      // Sibling repo not available in this environment (e.g., CI that
      // clones only asoe-ui). Skip rather than fail.
      console.warn(`skipping drift test — schema not found at ${SCHEMA_PATH}`);
      return;
    }
    const out = join(tmpdir(), "asoe-ui.generated.fresh.ts");
    execFileSync(
      "node",
      [
        join(__dirname, "..", "..", "node_modules", "openapi-typescript", "bin", "cli.js"),
        SCHEMA_PATH,
        "-o",
        out,
      ],
      { stdio: "pipe" },
    );
    const fresh = readFileSync(out, "utf-8");
    const committed = readFileSync(COMMITTED, "utf-8");
    expect(fresh, "Run `npm run generate-types` to refresh.").toBe(committed);
  });
});

describe("Backend vocabulary parity (review M4)", () => {
  /**
   * Rationale: asoe2's `AllowedIntent` and `AllowedRecipeName` are
   * Pydantic `Literal` types, not enum fields on a DTO, so the OpenAPI
   * schema serialises `/health.allowed_intents` as a plain `string[]`.
   * A new intent added to the backend doesn't change the schema, and
   * `openapi-typescript` can't produce a narrowed UI type. This gap
   * means a vocabulary drift (UI mock out of sync with backend) is
   * invisible to the drift test above.
   *
   * This pair of tests reads `asoe2/constraints/specs.py` directly and
   * compares the declared Literal values against `MOCK_HEALTH`'s
   * `allowed_intents` / `allowed_recipes` arrays. Runs at the same
   * cadence as the OpenAPI drift test and fails for the same reason
   * (UI stale vs backend) — just catches the specific case OpenAPI
   * can't.
   */
  it("MOCK_HEALTH.allowed_intents covers every AllowedIntent in asoe2", () => {
    if (!existsSync(ASOE2_SPECS_PATH)) {
      console.warn(`skipping parity test — asoe2 not available at ${ASOE2_SPECS_PATH}`);
      return;
    }
    const src = readFileSync(ASOE2_SPECS_PATH, "utf-8");
    const backendIntents = extractLiteralValues(src, "AllowedIntent");
    expect(backendIntents.length, "Failed to parse AllowedIntent from asoe2/constraints/specs.py").toBeGreaterThan(0);

    const uiIntents = new Set(MOCK_HEALTH.allowed_intents);
    const missing = backendIntents.filter((i) => !uiIntents.has(i));
    expect(
      missing,
      `MOCK_HEALTH is missing ${missing.length} backend intent(s). ` +
      `Add to tests/fixtures.ts::MOCK_HEALTH.allowed_intents (and check ` +
      `ERP_LABEL_MAPS coverage): ${JSON.stringify(missing)}`,
    ).toEqual([]);
  });

  it("MOCK_HEALTH.allowed_recipes covers every AllowedRecipeName in asoe2", () => {
    if (!existsSync(ASOE2_SPECS_PATH)) {
      console.warn(`skipping parity test — asoe2 not available at ${ASOE2_SPECS_PATH}`);
      return;
    }
    const src = readFileSync(ASOE2_SPECS_PATH, "utf-8");
    const backendRecipes = extractLiteralValues(src, "AllowedRecipeName");
    expect(backendRecipes.length, "Failed to parse AllowedRecipeName from asoe2/constraints/specs.py").toBeGreaterThan(0);

    const uiRecipes = new Set(MOCK_HEALTH.allowed_recipes);
    const missing = backendRecipes.filter((r) => !uiRecipes.has(r));
    expect(
      missing,
      `MOCK_HEALTH is missing ${missing.length} backend recipe(s). ` +
      `Add to tests/fixtures.ts::MOCK_HEALTH.allowed_recipes: ${JSON.stringify(missing)}`,
    ).toEqual([]);
  });
});
