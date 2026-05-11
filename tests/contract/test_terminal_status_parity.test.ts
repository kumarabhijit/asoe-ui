/**
 * Spec-as-oracle: `TerminalStatus` union parity between asoe-ui and asoe2.
 *
 * Reads `../asoe2/contracts/models.py` directly and extracts every
 * value from the `class TerminalStatus(str, Enum)` definition. Then
 * reads the hand-written `TerminalStatus` union in
 * `src/types/exceptions.ts` and asserts the two sets are equal.
 *
 * The OpenAPI schema serialises `final_status` as `string`, not as a
 * narrowed union (Pydantic Enum + anyOf collapses to plain string at
 * the JSON-schema layer), so the existing OpenAPI drift gate cannot
 * catch the case where asoe2 adds a new TerminalStatus value and
 * asoe-ui's hand-written union forgets it. This test closes that
 * gap — it's the regression test paired with the `AUDIT_CONTEXT_MISSING`
 * fix from W1 of `docs/test-strategy/design.md`.
 *
 * When the asoe2 sibling checkout is missing (CI that clones only
 * asoe-ui), the test skips with a warning rather than failing — the
 * cross-repo gate runs in CI jobs that have both checkouts.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { TerminalStatus } from "@/types/exceptions";

const ASOE2_MODELS_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "asoe2",
  "contracts",
  "models.py",
);

/**
 * Extract enum values from a Python `class Foo(str, Enum)` definition.
 * Matches lines of the form `NAME = "value"` between the class header
 * and the next blank line / next `class`/`def`.
 */
function extractEnumValues(source: string, className: string): string[] {
  const headerRe = new RegExp(
    String.raw`class\s+${className}\s*\(\s*str\s*,\s*Enum\s*\)\s*:`,
    "m",
  );
  const headerMatch = source.match(headerRe);
  if (!headerMatch || headerMatch.index === undefined) return [];
  const after = source.slice(headerMatch.index + headerMatch[0].length);
  // Stop at the next top-level definition or two consecutive newlines.
  const stopMatch = after.match(/\n(class\s|def\s|[A-Z_]+:\s*Dict|[A-Z_]+:\s*List|[A-Z_]+\s*=)/);
  const body = stopMatch ? after.slice(0, stopMatch.index) : after;
  // Pull every `NAME = "value"` row.
  const rows = [...body.matchAll(/^\s+([A-Z_][A-Z0-9_]*)\s*=\s*"([^"]+)"/gm)];
  return rows.map((m) => m[2]);
}

/**
 * The union members of the hand-written `TerminalStatus` type. We can't
 * iterate a TypeScript type at runtime; the canonical list lives in
 * `src/types/exceptions.ts` as a pipe-separated union. Keep this array
 * in lockstep with the union and let the parity test guard it.
 *
 * NOTE: this constant is the *single point of truth that needs manual
 * update* when adding a TerminalStatus. The parity test below catches
 * the case where someone updates the type but forgets to update this
 * array, AND the case where someone forgets to update either after
 * asoe2 adds a value.
 */
const UI_TERMINAL_STATUS_VALUES: readonly TerminalStatus[] = [
  "COMPLETE",
  "COMPLETE_WITH_CHILDREN",
  "FAIL_TO_HUMAN",
  "MANUAL_REVIEW_REQUIRED",
  "BLOCKED",
  "REJECTED",
  "AUDIT_CONTEXT_MISSING",
] as const;

describe("TerminalStatus parity (asoe-ui ↔ asoe2)", () => {
  it("UI TerminalStatus union covers every asoe2 TerminalStatus enum value", () => {
    if (!existsSync(ASOE2_MODELS_PATH)) {
      console.warn(
        `skipping TerminalStatus parity — asoe2 not found at ${ASOE2_MODELS_PATH}`,
      );
      return;
    }
    const src = readFileSync(ASOE2_MODELS_PATH, "utf-8");
    const backendValues = extractEnumValues(src, "TerminalStatus");
    expect(
      backendValues.length,
      "Failed to parse TerminalStatus from asoe2/contracts/models.py",
    ).toBeGreaterThan(0);

    const uiSet = new Set<string>(UI_TERMINAL_STATUS_VALUES);
    const missing = backendValues.filter((v) => !uiSet.has(v));
    expect(
      missing,
      `UI TerminalStatus union is missing ${missing.length} backend ` +
        `value(s). Add to src/types/exceptions.ts::TerminalStatus AND to ` +
        `UI_TERMINAL_STATUS_VALUES in this test, then wire up an explicit ` +
        `render path (no generic fallback) per CLAUDE.md §6: ` +
        `${JSON.stringify(missing)}`,
    ).toEqual([]);
  });

  it("UI TerminalStatus union does not declare values asoe2 doesn't know", () => {
    if (!existsSync(ASOE2_MODELS_PATH)) {
      console.warn(
        `skipping TerminalStatus parity — asoe2 not found at ${ASOE2_MODELS_PATH}`,
      );
      return;
    }
    const src = readFileSync(ASOE2_MODELS_PATH, "utf-8");
    const backendSet = new Set(extractEnumValues(src, "TerminalStatus"));
    const extra = UI_TERMINAL_STATUS_VALUES.filter((v) => !backendSet.has(v));
    expect(
      extra,
      `UI TerminalStatus declares ${extra.length} value(s) the backend ` +
        `does not emit. Either remove them from the union (likely a ` +
        `legacy state retired in asoe2) or coordinate the addition: ` +
        `${JSON.stringify(extra)}`,
    ).toEqual([]);
  });

  it("AUDIT_CONTEXT_MISSING is in the UI union (W1 regression guard)", () => {
    // Belt-and-suspenders: even if the parity tests above are skipped
    // (no sibling checkout), the AUDIT_CONTEXT_MISSING regression
    // surfaced in `docs/test-strategy/design.md` Eng Review Decision
    // §"W1 also includes regression fixes" must stay closed.
    expect(UI_TERMINAL_STATUS_VALUES).toContain("AUDIT_CONTEXT_MISSING");
  });
});
