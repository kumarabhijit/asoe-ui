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

  it("asoe2's LIFECYCLE_STATES does not include EXECUTING (parity backstop)", () => {
    if (!existsSync(ASOE2_MODELS_PATH)) {
      console.warn(
        `skipping EXECUTING-in-backend parity — asoe2 not found at ${ASOE2_MODELS_PATH}`,
      );
      return;
    }
    const src = readFileSync(ASOE2_MODELS_PATH, "utf-8");
    // Match the LIFECYCLE_STATES list literal — between `LIFECYCLE_STATES: List[str] = [` and `]`.
    const match = src.match(/LIFECYCLE_STATES\s*:\s*List\[str\]\s*=\s*\[([\s\S]*?)\]/);
    if (!match) {
      throw new Error(
        "Could not parse LIFECYCLE_STATES from asoe2/contracts/models.py",
      );
    }
    const values = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(values).not.toContain("EXECUTING");
  });

  it("UI lifecycle union matches asoe2's LIFECYCLE_STATES exactly", () => {
    if (!existsSync(ASOE2_MODELS_PATH)) {
      console.warn(
        `skipping LifecycleState parity — asoe2 not found at ${ASOE2_MODELS_PATH}`,
      );
      return;
    }
    const src = readFileSync(ASOE2_MODELS_PATH, "utf-8");
    const match = src.match(/LIFECYCLE_STATES\s*:\s*List\[str\]\s*=\s*\[([\s\S]*?)\]/);
    if (!match) throw new Error("LIFECYCLE_STATES parse failed");
    const backend = new Set([...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
    const ui = new Set<string>(UI_LIFECYCLE_VALUES);
    const onlyBackend = [...backend].filter((v) => !ui.has(v));
    const onlyUi = [...ui].filter((v) => !backend.has(v));
    expect(onlyBackend, `lifecycle states in asoe2 but not UI: ${JSON.stringify(onlyBackend)}`).toEqual([]);
    expect(onlyUi, `lifecycle states in UI but not asoe2: ${JSON.stringify(onlyUi)}`).toEqual([]);
  });
});
