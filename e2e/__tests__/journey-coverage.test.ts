// Journey × arc coverage meta-test.
//
// Phase 0d of the BDD test plan. Closes JOURNEYS.md gaps G1-G3:
//   G1 — "doc declares 'orientation arc' but no test answers it"
//   G2 — "matrix is hand-maintained, no test asserts YAML matches"
//   G3 — "no `arc:` field on flow YAMLs, can't compute coverage"
//
// The meta-test walks every flow YAML, indexes them by journey ID
// and arc, and asserts every (archetype × arc) cell that should
// be covered HAS at least one flow.
//
// Today (Phase 0 only) the gap is large — J3/J4/J5 have zero
// flows and J1/J2 have orientation only. That is the desired
// red-state until Phase 2/3 flows land. The test produces a
// structured gap report so each missing flow is a concrete
// action item, not a generic "coverage low" complaint.
//
// To gate CI without blocking incremental progress, the test is
// split into:
//   - HARD assertions: schema-side properties that ALL flows
//     must satisfy (every flow has journey + arc; every declared
//     journey is in the enforced set; no flow tags trust/5y).
//   - SOFT report: archetype × arc cells that are missing.
//     Emitted via console + a snapshot file so reviewers can see
//     the gap shrink commit-by-commit without the build going
//     red for declared-incomplete work.
//
// When the v1.2 plan's 8 initial flows ship, flip
// SOFT_GAP_THRESHOLD to 0 and the meta-test becomes hard.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import YAML from "yaml";
import {
  ENFORCED_ARCS,
  ENFORCED_JOURNEYS,
  flowSchema,
  journeysOf,
  type Arc,
  type Flow,
  type JourneyId,
} from "../flow-schema";

const REPO_ROOT = join(__dirname, "..", "..");
const FLOWS_ROOT = join(REPO_ROOT, "e2e", "flows");

// Until Phase 2/3 lands the matrix is intentionally sparse. Flip
// to 0 when the v1.2 plan's flow set is fully authored.
// Ratchet:
//   - Phase 0 baseline: 8 cells uncovered
//   - Phase 2 (V1+V2+V3 regression flows): 6 cells uncovered
//   - Phase 3 (golden paths): 4 cells uncovered (J4 + J5)
//   - Phase 4 (chrome-invariant CMT-2/CMT-3 owns J4): 2 cells
//     uncovered (J5 only; deferred to V1.1)
// S15a — the case ↔ exception-detail round-trip flow was retired
// alongside the /exceptions/[id] route it exercised. Until an
// equivalent flow on the case-centric surface lands, J3 ×
// task-completion is uncovered again (5 gaps, up from 4).
const SOFT_GAP_THRESHOLD = 5;

interface IndexedFlow {
  path: string;
  rel: string;
  flow: Flow;
}

function listFlowFiles(): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      // Skip dotfiles and the underscore-prefixed registry file.
      if (entry.startsWith(".") || entry.startsWith("_")) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith(".yaml") || entry.endsWith(".yml")) out.push(full);
    }
  }
  walk(FLOWS_ROOT);
  return out;
}

function indexFlows(): IndexedFlow[] {
  const out: IndexedFlow[] = [];
  for (const path of listFlowFiles()) {
    const text = readFileSync(path, "utf-8");
    const raw = YAML.parse(text);
    const flow = flowSchema.parse(raw);
    out.push({ path, rel: relative(REPO_ROOT, path), flow });
  }
  return out;
}

// Build a (journey × arc) -> [flow rel paths] map.
function buildMatrix(flows: IndexedFlow[]): Map<string, string[]> {
  const matrix = new Map<string, string[]>();
  for (const f of flows) {
    for (const j of journeysOf(f.flow)) {
      const key = `${j}|${f.flow.arc}`;
      const existing = matrix.get(key) ?? [];
      existing.push(f.rel);
      matrix.set(key, existing);
    }
  }
  return matrix;
}

function gapList(matrix: Map<string, string[]>): Array<{
  journey: JourneyId;
  arc: Arc;
}> {
  const gaps: Array<{ journey: JourneyId; arc: Arc }> = [];
  for (const journey of ENFORCED_JOURNEYS) {
    for (const arc of ENFORCED_ARCS) {
      if (!matrix.has(`${journey}|${arc}`)) {
        gaps.push({ journey, arc });
      }
    }
  }
  return gaps;
}

describe("journey-coverage meta-test", () => {
  const flows = indexFlows();
  const matrix = buildMatrix(flows);

  it("every flow declares an enforced journey ID", () => {
    const offenders: string[] = [];
    for (const f of flows) {
      for (const j of journeysOf(f.flow)) {
        if (!ENFORCED_JOURNEYS.includes(j)) {
          offenders.push(`${f.rel} -> ${j}`);
        }
      }
    }
    expect(offenders, "flows referencing an unknown journey").toEqual([]);
  });

  it("every flow declares an enforced arc value (no 5y/trust tags)", () => {
    const offenders: string[] = [];
    for (const f of flows) {
      if (!ENFORCED_ARCS.includes(f.flow.arc)) {
        offenders.push(`${f.rel} -> ${f.flow.arc}`);
      }
    }
    expect(offenders, "flows declaring an unsupported arc").toEqual([]);
  });

  it("emits a structured gap report (soft until 8-flow set lands)", () => {
    const gaps = gapList(matrix);
    if (gaps.length > 0) {
      const formatted = gaps
        .map((g) => `  ${g.journey} × ${g.arc}`)
        .join("\n");
      console.log(
        `[journey-coverage] ${gaps.length} (journey × arc) cells uncovered:\n${formatted}`,
      );
    }
    // Hard ceiling: must shrink monotonically. If a refactor
    // accidentally removes coverage that was previously
    // achieved, this fails. Lower SOFT_GAP_THRESHOLD as flows
    // land to ratchet coverage up commit-by-commit.
    expect(
      gaps.length,
      `journey × arc coverage gaps exceed ratchet (current: ${gaps.length}, ceiling: ${SOFT_GAP_THRESHOLD})`,
    ).toBeLessThanOrEqual(SOFT_GAP_THRESHOLD);
  });

  it("ratchet is tight: every covered cell stays covered", () => {
    // Cells we have empirically covered. As a flow lands, add
    // its (journey, arc) here. Removing coverage is a regression
    // that fails this test loudly. Append-only.
    const guaranteedCovered: Array<[JourneyId, Arc]> = [
      ["J1", "orientation"], // inbox-load + V3 catalog + signin-to-home
      ["J2", "orientation"], // inbox-load + V3 catalog + signout
      ["J1", "task-completion"], // V1 + V2 round-trip
      // J3 × task-completion was covered by V2's case ↔ exception
      // round-trip flow. S15a retired that flow with the
      // /exceptions/[id] route; the cell is uncovered until a
      // case-centric equivalent lands. Re-add this row when the
      // replacement flow is committed.
      ["J2", "task-completion"], // resolve/exception-triage-approval
      ["J3", "orientation"], // recover/back-from-misroute
    ];
    const missing: string[] = [];
    for (const [j, a] of guaranteedCovered) {
      if (!matrix.has(`${j}|${a}`)) {
        missing.push(`${j} × ${a}`);
      }
    }
    expect(
      missing,
      "previously-guaranteed coverage regressed — flows removed without updating the ratchet",
    ).toEqual([]);
  });

  it("J6 (accessibility-first) is documented but not enforced yet", () => {
    // Deliberate negative assertion: ENFORCED_JOURNEYS must NOT
    // include J6 until V1.1. Locks the deferral so a contributor
    // can't accidentally make the meta-test fail by adding J6 to
    // the enforced set before the accessibility flow set exists.
    expect(ENFORCED_JOURNEYS).not.toContain("J6");
  });
});
