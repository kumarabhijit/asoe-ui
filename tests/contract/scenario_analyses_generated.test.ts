// Deliverable-completeness lock for the scenario-analysis generated artifact
// (docs/test-strategy/README.md Gap 7 — Pattern A source-grep + Pattern B
// behavioural/runtime completeness).
//
// The MOCK_* -> scenario-catalog migration moves per-record OrderAnalysis
// evidence out of the hand-authored src/lib/mock-data/order-analyses.ts into
// the asoe2 sibling fixture (fixtures/scenarios/analyses.yaml), vendored to
//   tests/contract/snapshots/scenario_analyses.yaml
// and projected by scripts/gen-scenario-analyses.ts into
//   src/lib/mock-data/__generated__/scenario_analyses.ts
// which order-analyses.ts spreads into MOCK_ORDER_ANALYSES.
//
// Behavioural tests can't catch "the migrated record silently stopped being
// sourced from the fixture" — the app still renders because some other path
// could repopulate it. These locks assert the EXPECTED STRUCTURE so feature
// absence (the fixture pipeline regressing, or a record falling back to a
// hand-authored inline literal) is visible to the suite.
//
// Slice 1 deliverable: PRICE_HOLD_RELEASE (exc-017 auto-release, exc-018
// escalate). Extend MIGRATED_IDS as later intent families migrate.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";
import { parse } from "yaml";

import {
  SCENARIO_ANALYSES,
  SCENARIO_ANALYSIS_COUNT,
} from "@/lib/mock-data/__generated__/scenario_analyses";
import { MOCK_ORDER_ANALYSES } from "@/lib/mock-data/order-analyses";

const SNAPSHOT = resolve(__dirname, "snapshots/scenario_analyses.yaml");
const ORDER_ANALYSES_SRC = resolve(
  __dirname,
  "../../src/lib/mock-data/order-analyses.ts",
);

// The intent families migrated to the fixture pipeline so far.
const MIGRATED_IDS = ["exc-017", "exc-018"] as const;

interface AnalysesFile {
  analyses: Record<string, Record<string, unknown>>;
}

function snapshotIds(): string[] {
  const file = parse(readFileSync(SNAPSHOT, "utf-8")) as AnalysesFile;
  return Object.keys(file.analyses ?? {}).sort();
}

// ── Pattern A: source-level structural lock (the cheap canary) ───────────
describe("scenario-analysis pipeline — source structure (Pattern A)", () => {
  it("order-analyses.ts imports and spreads the generated SCENARIO_ANALYSES", () => {
    const src = readFileSync(ORDER_ANALYSES_SRC, "utf-8");
    expect(src).toMatch(
      /import\s+\{\s*SCENARIO_ANALYSES\s*\}\s+from\s+["']\.\/__generated__\/scenario_analyses["']/,
    );
    // Spread into MOCK_ORDER_ANALYSES; deep-cloned so the generated seed
    // stays immutable under the runtime stamp + api.ts in-place mutation.
    expect(src).toMatch(/\.\.\.structuredClone\(SCENARIO_ANALYSES\)/);
  });

  it("the migrated records are NOT also hand-authored inline (single source)", () => {
    const src = readFileSync(ORDER_ANALYSES_SRC, "utf-8");
    for (const id of MIGRATED_IDS) {
      // A migrated record must not reappear as its own object-literal key in
      // the hand-authored map — that would be a double source / drift hazard.
      expect(src).not.toMatch(new RegExp(`["']${id}["']\\s*:\\s*\\{`));
    }
  });

  it("the generated module exports the SCENARIO_ANALYSES map + count", () => {
    expect(SCENARIO_ANALYSIS_COUNT).toBe(Object.keys(SCENARIO_ANALYSES).length);
    expect(SCENARIO_ANALYSIS_COUNT).toBeGreaterThan(0);
  });
});

// ── Pattern B: behavioural / runtime completeness ────────────────────────
describe("scenario-analysis pipeline — runtime completeness (Pattern B)", () => {
  it("the generated map covers exactly the snapshot fixture entries", () => {
    expect(Object.keys(SCENARIO_ANALYSES).sort()).toEqual(snapshotIds());
  });

  it("every migrated id is present and sourced from the generated fixture", () => {
    for (const id of MIGRATED_IDS) {
      expect(SCENARIO_ANALYSES[id]).toBeDefined();
      expect(MOCK_ORDER_ANALYSES[id]).toBeDefined();
      // The runtime record carries every field the fixture projected — i.e.
      // it really is the generated object (plus the runtime presentation
      // stamp), not a divergent inline literal.
      const generated = SCENARIO_ANALYSES[id] as unknown as Record<string, unknown>;
      const runtime = MOCK_ORDER_ANALYSES[id] as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(generated)) {
        expect(runtime[key]).toEqual(value);
      }
    }
  });

  it("PRICE_HOLD_RELEASE records carry the price_hold_analysis evidence", () => {
    // Slice-1 shape lock: the migrated records keep their recipe projection.
    const auto = MOCK_ORDER_ANALYSES["exc-017"].price_hold_analysis;
    const escalate = MOCK_ORDER_ANALYSES["exc-018"].price_hold_analysis;
    expect(auto?.action).toBe("AUTO_RELEASE");
    expect(auto?.hold_status).toBe("RELEASED");
    expect(escalate?.action).toBe("ESCALATE");
    expect(escalate?.hold_status).toBe("HELD");
  });

  it("the runtime presentation hint is stamped on the migrated records", () => {
    // primary_section is intentionally absent from the fixture (it is a
    // deterministic read-path stamp); order-analyses.ts must re-derive it.
    for (const id of MIGRATED_IDS) {
      expect(MOCK_ORDER_ANALYSES[id].primary_section).toBe("price_hold_analysis");
      expect(
        (SCENARIO_ANALYSES[id] as unknown as Record<string, unknown>).primary_section,
      ).toBeUndefined();
    }
  });
});
