// Drift test: the journey matrix in JOURNEYS.md must match what
// the generator (e2e/journey-matrix.ts) would produce from the
// current set of flow YAMLs.
//
// Phase 0e of the BDD test plan. Closes JOURNEYS.md gap G2 (the
// matrix used to be hand-maintained; reviewers had to keep it
// in sync with new flow YAMLs by eye). With this test, drift
// fails CI and the regen CLI is one command.
//
// Update path:
//   1. Author or edit a flow YAML.
//   2. Run: npx tsx e2e/journey-matrix.ts
//      (or rely on the pre-commit hook in Phase 7).
//   3. Commit the resulting JOURNEYS.md diff alongside the flow.
//
// Self-check: the test also runs the spliceMatrix function on a
// synthetic input so a refactor of the splice logic can't pass
// silently by walking an empty matrix.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadFlows,
  regenerateJourneysMd,
  renderMatrix,
  renderPerArchetypeBlock,
  spliceMatrix,
} from "../journey-matrix";
import { ENFORCED_JOURNEYS } from "../flow-schema";

const REPO_ROOT = join(__dirname, "..", "..");
const FLOWS_ROOT = join(REPO_ROOT, "e2e", "flows");
const JOURNEYS_PATH = join(FLOWS_ROOT, "JOURNEYS.md");

describe("journey-matrix generator", () => {
  it("JOURNEYS.md matrix block matches generator output", () => {
    const current = readFileSync(JOURNEYS_PATH, "utf-8");
    const expected = regenerateJourneysMd(current, FLOWS_ROOT);
    if (current !== expected) {
      throw new Error(
        "JOURNEYS.md matrix is stale.\n" +
          "Run `npx tsx e2e/journey-matrix.ts` and commit the diff.\n" +
          "Marker block (<!-- BEGIN MATRIX --> ... <!-- END MATRIX -->) " +
          "must contain the regenerated table.",
      );
    }
  });

  it("renderMatrix emits a row for every flow", () => {
    const flows = loadFlows(FLOWS_ROOT);
    expect(flows.length).toBeGreaterThan(0);
    const body = renderMatrix(flows);
    // Header + separator + one row per flow + trailing newline.
    const rowCount = body.trim().split("\n").length - 2;
    expect(rowCount).toBe(flows.length);
  });

  it("renderMatrix output is deterministic (sorted, single-flow stability)", () => {
    const flows = loadFlows(FLOWS_ROOT);
    const a = renderMatrix(flows);
    const b = renderMatrix([...flows].reverse());
    // Even if the input list order changes, the rendered output
    // sorts by rel path so the output is identical.
    expect(a).toBe(b);
  });

  it("spliceMatrix self-check: replaces only the content between markers", () => {
    const synthetic = [
      "# Heading",
      "",
      "Body before.",
      "",
      "<!-- BEGIN MATRIX -->",
      "stale content",
      "<!-- END MATRIX -->",
      "",
      "Body after.",
    ].join("\n");
    const newBody = "| Flow | Journey | Arc |\n";
    const result = spliceMatrix(synthetic, newBody);
    expect(result).toContain("Body before.");
    expect(result).toContain("Body after.");
    expect(result).toContain(newBody);
    expect(result).not.toContain("stale content");
  });

  it("spliceMatrix throws if markers are missing", () => {
    expect(() => spliceMatrix("no markers here", "")).toThrow(
      /missing matrix markers/,
    );
  });

  // ─── per-archetype block ───────────────────────────────────

  it("renderPerArchetypeBlock emits one section per enforced journey", () => {
    const flows = loadFlows(FLOWS_ROOT);
    const block = renderPerArchetypeBlock(flows);
    for (const journey of ENFORCED_JOURNEYS) {
      expect(block).toContain(`#### Flows owned by ${journey}`);
    }
  });

  it("renderPerArchetypeBlock emits a placeholder for empty journeys", () => {
    const block = renderPerArchetypeBlock([]);
    // Every archetype is empty when no flows are loaded.
    for (const journey of ENFORCED_JOURNEYS) {
      const sectionStart = block.indexOf(`#### Flows owned by ${journey}`);
      expect(sectionStart).toBeGreaterThan(-1);
      // The "(no flows yet)" placeholder must follow within the section.
      const placeholderIdx = block.indexOf("_(no flows yet)_", sectionStart);
      expect(placeholderIdx).toBeGreaterThan(sectionStart);
    }
  });

  it("renderPerArchetypeBlock is deterministic under input reordering", () => {
    const flows = loadFlows(FLOWS_ROOT);
    const a = renderPerArchetypeBlock(flows);
    const b = renderPerArchetypeBlock([...flows].reverse());
    expect(a).toBe(b);
  });

  it("regenerateJourneysMd writes the per-archetype block when markers are present", () => {
    const flows = loadFlows(FLOWS_ROOT);
    const synthetic = [
      "<!-- BEGIN MATRIX -->",
      "stale",
      "<!-- END MATRIX -->",
      "",
      "<!-- BEGIN PER-ARCHETYPE FLOWS -->",
      "stale",
      "<!-- END PER-ARCHETYPE FLOWS -->",
    ].join("\n");
    const result = regenerateJourneysMd(synthetic, FLOWS_ROOT);
    // Matrix block updated.
    expect(result).toContain(renderMatrix(flows).trim());
    // Per-archetype block updated too.
    expect(result).toContain(renderPerArchetypeBlock(flows).trim());
    expect(result).not.toContain("stale");
  });

  it("regenerateJourneysMd tolerates missing per-archetype markers (matrix-only)", () => {
    const synthetic = [
      "<!-- BEGIN MATRIX -->",
      "stale",
      "<!-- END MATRIX -->",
    ].join("\n");
    // Should not throw even though PER-ARCHETYPE markers are absent.
    expect(() => regenerateJourneysMd(synthetic, FLOWS_ROOT)).not.toThrow();
  });
});
