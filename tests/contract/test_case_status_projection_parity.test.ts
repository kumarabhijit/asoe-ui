/**
 * Cross-repo parity: the `lifecycle_state` -> `CaseStatus` projection.
 *
 * Two implementations project a record's `lifecycle_state` onto a
 * parent `CaseStatus`:
 *   - asoe2 `api/case_resolver.py::_case_status_from_lifecycle`
 *   - asoe-ui `caseFromMockException` (`src/lib/mock-data/cases.ts`)
 *
 * They must agree value-for-value. They silently diverged once — the
 * `REJECTED` bug fixed in asoe2 PR #161 / asoe-ui PR #171 — because
 * nothing structurally compared them. This test closes that gap: it
 * reads the asoe2 function and asserts `caseFromMockException`
 * produces the same `CaseStatus` for every `LifecycleState` value.
 *
 * When the asoe2 sibling checkout is absent (CI that clones only
 * asoe-ui), the test skips with a warning — the cross-repo gate runs
 * in jobs that have both checkouts.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { caseFromMockException } from "@/lib/mock-data/cases";
import type { ExceptionSummary } from "@/types/exceptions";

import { GREEN_EXCEPTION } from "../fixtures";

const ASOE2 = join(__dirname, "..", "..", "..", "asoe2");
const MODELS_PATH = join(ASOE2, "contracts", "models.py");
const RESOLVER_PATH = join(ASOE2, "api", "case_resolver.py");

/** Every member of asoe2's `LifecycleState(str, Enum)`. */
function lifecycleStates(modelsSrc: string): string[] {
  const header = modelsSrc.match(/class LifecycleState\(str, Enum\):/);
  if (!header || header.index === undefined) return [];
  const after = modelsSrc.slice(header.index);
  const stop = after.slice(1).search(/\nclass |\n[A-Z_]+[: ]/);
  const body = stop >= 0 ? after.slice(0, stop + 1) : after;
  return [...body.matchAll(/^\s+[A-Z_]+ = "([A-Z_]+)"/gm)].map((m) => m[1]);
}

/**
 * Parse `_case_status_from_lifecycle` into a `{lifecycle: CaseStatus}`
 * map. Lifecycle values not present in the map fall through to the
 * function's default branch (`OPEN_AWAITING_HUMAN`).
 */
function asoe2Projection(resolverSrc: string): Record<string, string> {
  const fn = resolverSrc.match(
    /def _case_status_from_lifecycle[\s\S]*?\n\n\ndef /,
  );
  const body = fn ? fn[0] : "";
  const map: Record<string, string> = {};
  // Grouped branch:  if lifecycle_state in ("A", "B"): ... return "X"
  for (const m of body.matchAll(/in \(([^)]*)\):[\s\S]*?return "([A-Z_]+)"/g)) {
    for (const s of m[1].matchAll(/"([A-Z_]+)"/g)) map[s[1]] = m[2];
  }
  // Single branch:   if lifecycle_state == "A": return "X"
  for (const m of body.matchAll(/== "([A-Z_]+)":\s*\n\s*return "([A-Z_]+)"/g)) {
    map[m[1]] = m[2];
  }
  return map;
}

function withLifecycle(lifecycle_state: string): ExceptionSummary {
  return { ...GREEN_EXCEPTION, lifecycle_state } as ExceptionSummary;
}

describe("case-status projection parity (asoe-ui <-> asoe2)", () => {
  it("caseFromMockException matches asoe2 _case_status_from_lifecycle for every LifecycleState", () => {
    if (!existsSync(MODELS_PATH) || !existsSync(RESOLVER_PATH)) {
      console.warn(`skipping projection parity — asoe2 not found at ${ASOE2}`);
      return;
    }
    const states = lifecycleStates(readFileSync(MODELS_PATH, "utf-8"));
    const projection = asoe2Projection(readFileSync(RESOLVER_PATH, "utf-8"));

    // Guard the parsers — an empty result means the regexes drifted,
    // not that the two repos agree.
    expect(
      states.length,
      "failed to parse LifecycleState from asoe2/contracts/models.py",
    ).toBe(12);
    expect(
      Object.keys(projection).length,
      "failed to parse _case_status_from_lifecycle from asoe2",
    ).toBeGreaterThan(0);

    for (const state of states) {
      const expected = projection[state] ?? "OPEN_AWAITING_HUMAN";
      expect(
        caseFromMockException(withLifecycle(state)).status,
        `lifecycle ${state}: asoe-ui caseFromMockException disagrees with ` +
          `asoe2 _case_status_from_lifecycle (expected ${expected})`,
      ).toBe(expected);
    }
  });
});
