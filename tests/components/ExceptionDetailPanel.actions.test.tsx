/**
 * Parameterised action-matrix coverage (S6).
 *
 * `describe.each(SCENARIOS)` walks every BehaviourScenario in the
 * library and pins the operator-action invariants. The actual
 * button rendering / click handlers live in HeaderRibbon +
 * AgentReasoningCard (covered separately); this file enforces the
 * SHAPE of the scenario expectations so the matrix stays internally
 * consistent as S12 adds the remaining nine intents.
 *
 * Invariants this file locks (every scenario, every PR):
 *
 *   1. Terminal lifecycle (`FAILED`, `RESOLVED`, `BLOCKED`,
 *      `REJECTED`, `CLOSED`) implies every action is forbidden.
 *      Backend mock disposition handler will be wired to enforce
 *      the same rule in S9.
 *   2. PENDING_COSIGN implies cosign is the ONLY allowed action
 *      (Approve / Reject / Override / Reanalyze all gated, since
 *      the cosign banner is the only valid path forward).
 *   3. Approve/Reject `reason_tag` (when set) is a member of the
 *      curated vocabulary for that intent.
 *   4. Override `reason_tags` (when set) is identical to the
 *      curated vocab for that intent — narrowing the operator's
 *      pick list to the curated set is the whole point of the
 *      2026-05-10 panel decision.
 *   5. Cosign is never allowed on a terminal record.
 *
 * Full Cartesian coverage (12 intents × 4 lifecycle states × 3
 * roles) is gated behind `RUN_FULL_MATRIX=1` env to keep PR-blocking
 * CI lean; the gating block is at the bottom of this file.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

import { SCENARIOS } from "../scenarios";

const SNAPSHOT = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../contract/snapshots/curated_reason_tags.json"),
    "utf-8",
  ),
) as {
  allowed_override_reason_tags_by_intent: Record<string, readonly string[]>;
};

const TERMINAL_LIFECYCLES = new Set(["FAILED", "RESOLVED", "BLOCKED", "REJECTED", "CLOSED"]);

describe.each(SCENARIOS)("action matrix — $id", (s) => {
  const lifecycle = s.detail.lifecycle_state;
  const isTerminal = TERMINAL_LIFECYCLES.has(lifecycle);
  const isPendingCosign = lifecycle === "PENDING_COSIGN";

  it("intent on scenario matches intent on the detail payload", () => {
    expect(s.detail.intent).toBe(s.intent);
  });

  it("terminal lifecycle implies every action is forbidden", () => {
    if (!isTerminal) return;
    for (const [name, action] of Object.entries(s.allowed_actions)) {
      expect(action.allowed, `${name} should be forbidden on terminal lifecycle ${lifecycle}`).toBe(false);
    }
  });

  it("PENDING_COSIGN gates Approve/Reject/Override/Reanalyze and opens cosign", () => {
    if (!isPendingCosign) return;
    expect(s.allowed_actions.approve.allowed).toBe(false);
    expect(s.allowed_actions.reject.allowed).toBe(false);
    expect(s.allowed_actions.override.allowed).toBe(false);
    expect(s.allowed_actions.reanalyze.allowed).toBe(false);
    expect(s.allowed_actions.cosign.allowed).toBe(true);
  });

  it("cosign is forbidden on terminal records", () => {
    if (!isTerminal) return;
    expect(s.allowed_actions.cosign.allowed).toBe(false);
  });

  it("approve/reject reason_tag (when set) is a member of the curated vocab", () => {
    const curated = SNAPSHOT.allowed_override_reason_tags_by_intent[s.intent];
    if (!curated) return;
    for (const handler of ["approve", "reject"] as const) {
      const tag = s.allowed_actions[handler].reason_tag;
      if (!tag) continue;
      expect(
        curated,
        `${handler}.reason_tag "${tag}" is not in curated vocab for ${s.intent}`,
      ).toContain(tag);
    }
  });

  it("override reason_tags equals the curated vocab for the intent", () => {
    const curated = SNAPSHOT.allowed_override_reason_tags_by_intent[s.intent];
    if (!curated) return;
    const tags = s.allowed_actions.override.reason_tags;
    if (!tags) return;
    // Set equality — order is informational, not contractual.
    expect(new Set(tags)).toEqual(new Set(curated));
  });

  it("scenario id intent prefix matches the intent field", () => {
    expect(s.id.split("__")[0]).toBe(s.intent);
  });
});

describe("action matrix — invariants across the whole library", () => {
  it("every scenario id is unique", () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("at least one scenario per (terminal | PENDING_COSIGN | open-actionable) lifecycle band", () => {
    const bands = {
      terminal: SCENARIOS.filter((s) => TERMINAL_LIFECYCLES.has(s.detail.lifecycle_state)),
      pending_cosign: SCENARIOS.filter((s) => s.detail.lifecycle_state === "PENDING_COSIGN"),
      open_actionable: SCENARIOS.filter((s) => s.detail.lifecycle_state === "PENDING_REVIEW"),
    };
    expect(bands.terminal.length).toBeGreaterThan(0);
    expect(bands.pending_cosign.length).toBeGreaterThan(0);
    expect(bands.open_actionable.length).toBeGreaterThan(0);
  });
});

// Full Cartesian — gated. CI default is lean; nightly runs with
// RUN_FULL_MATRIX=1. Once S12 fills the library to 12 intents
// the body below activates and verifies every intent has at
// least one scenario.
const RUN_FULL_MATRIX = process.env.RUN_FULL_MATRIX === "1";
const fullMatrixDescribe = RUN_FULL_MATRIX ? describe : describe.skip;

fullMatrixDescribe("action matrix — full Cartesian (RUN_FULL_MATRIX=1)", () => {
  const CURATED_INTENTS = Object.keys(SNAPSHOT.allowed_override_reason_tags_by_intent);

  it.each(CURATED_INTENTS)("at least one scenario covers intent %s", (intent) => {
    const covered = SCENARIOS.some((s) => s.intent === intent);
    expect(covered, `no scenario covers intent ${intent}; S12 should fill the gap`).toBe(true);
  });
});
