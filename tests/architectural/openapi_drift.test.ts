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
 * To refresh:
 *     npm run generate-types
 *     git add src/types/generated.ts
 */

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

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
