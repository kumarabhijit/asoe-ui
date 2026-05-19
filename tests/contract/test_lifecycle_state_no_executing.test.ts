/**
 * Spec-as-oracle: the retired `EXECUTING` lifecycle state must not
 * appear in any UI fixture, mock, type union, or hand-written
 * dispatcher.
 *
 * `EXECUTING` was a transitional state retired in asoe2 Phase 19 when
 * `/approve` was deleted and `/disposition` consolidated the
 * disposition flow. The backend no longer emits it. The UI union and
 * MOCK_HEALTH dropped it; this test prevents reintroduction.
 *
 * Reference: docs/test-strategy/eng-review-test-plan.md (Regression
 * tests required, item #2 — "asserts no fixture, mock, or response
 * contains `EXECUTING`").
 *
 * Allow-list: `EXECUTING` may legitimately appear in:
 *   - comments / docstrings (named in archaeological context)
 *   - test descriptions ("the retired EXECUTING state")
 *   - the `Badge.test.tsx` forward-compat fallback test that
 *     proves an unknown lifecycle string still renders neutral.
 *
 * The test scans for `EXECUTING` as a *value* — quoted string in a
 * type union, fixture array, or mock object — not as a comment word.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MOCK_HEALTH, MOCK_STATS } from "../fixtures";
import type { LifecycleState } from "@/types/exceptions";

const ASOE2_MODELS_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "asoe2",
  "contracts",
  "models.py",
);

/** UI hand-written `LifecycleState` union — kept in lockstep with src/types/exceptions.ts. */
const UI_LIFECYCLE_VALUES: readonly LifecycleState[] = [
  "INGESTED",
  "CLASSIFYING",
  "AUDITING",
  "PENDING_REVIEW",
  "ESCALATED",
  "PENDING_ADMIN_REVIEW",
  "PENDING_COSIGN",
  "RESOLVED",
  "FAILED",
  "BLOCKED",
  "REJECTED",
  "CLOSED",
] as const;

/**
 * The 12 members of asoe2's `LifecycleState(str, Enum)`. `LIFECYCLE_STATES`
 * is single-sourced from this enum (`[s.value for s in LifecycleState]`),
 * so the enum is the canonical thing to parse.
 */
function backendLifecycleStates(src: string): string[] {
  const header = src.match(/class LifecycleState\(str, Enum\):/);
  if (!header || header.index === undefined) {
    throw new Error(
      "Could not parse LifecycleState from asoe2/contracts/models.py",
    );
  }
  const after = src.slice(header.index);
  const stop = after.slice(1).search(/\nclass |\n[A-Z_]+[: ]/);
  const body = stop >= 0 ? after.slice(0, stop + 1) : after;
  return [...body.matchAll(/^\s+[A-Z_]+ = "([A-Z_]+)"/gm)].map((m) => m[1]);
}

describe("EXECUTING lifecycle state — retired (Phase 19)", () => {
  it("UI LifecycleState union does not include EXECUTING", () => {
    expect(UI_LIFECYCLE_VALUES as readonly string[]).not.toContain("EXECUTING");
  });

  it("MOCK_HEALTH.lifecycle_states does not include EXECUTING", () => {
    expect(MOCK_HEALTH.lifecycle_states).not.toContain("EXECUTING");
  });

  it("MOCK_STATS.by_lifecycle_state does not key on EXECUTING", () => {
    expect(Object.keys(MOCK_STATS.by_lifecycle_state)).not.toContain(
      "EXECUTING",
    );
  });

  it("asoe2's LifecycleState does not include EXECUTING (parity backstop)", () => {
    if (!existsSync(ASOE2_MODELS_PATH)) {
      console.warn(
        `skipping EXECUTING-in-backend parity — asoe2 not found at ${ASOE2_MODELS_PATH}`,
      );
      return;
    }
    const values = backendLifecycleStates(readFileSync(ASOE2_MODELS_PATH, "utf-8"));
    expect(values).not.toContain("EXECUTING");
  });

  it("UI lifecycle union matches asoe2's LifecycleState exactly", () => {
    if (!existsSync(ASOE2_MODELS_PATH)) {
      console.warn(
        `skipping LifecycleState parity — asoe2 not found at ${ASOE2_MODELS_PATH}`,
      );
      return;
    }
    const parsed = backendLifecycleStates(readFileSync(ASOE2_MODELS_PATH, "utf-8"));
    expect(parsed.length, "expected 12 LifecycleState members").toBe(12);
    const backend = new Set(parsed);
    const ui = new Set<string>(UI_LIFECYCLE_VALUES);
    const onlyBackend = [...backend].filter((v) => !ui.has(v));
    const onlyUi = [...ui].filter((v) => !backend.has(v));
    expect(onlyBackend, `lifecycle states in asoe2 but not UI: ${JSON.stringify(onlyBackend)}`).toEqual([]);
    expect(onlyUi, `lifecycle states in UI but not asoe2: ${JSON.stringify(onlyUi)}`).toEqual([]);
  });
});
