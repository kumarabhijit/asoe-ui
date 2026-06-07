/**
 * UX remediation Batch 6 — source locks for the shared data-viz fixes
 * (report 06). These guard structural fixes that behavioural tests can't
 * easily reach, each anchored to a real audit finding so the lock fails on
 * the parent commit.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

function read(rel: string): string {
  return readFileSync(path.resolve(__dirname, "../../", rel), "utf-8");
}

describe("Batch 6 — humanizeNode / duration formatters are de-duplicated", () => {
  // Report 06: `humanizeNode` was duplicated verbatim in PipelineDAG and
  // EventsTimeline; duration formatting diverged (1dp vs 2dp) across
  // WaterfallStepper / EventsTimeline / PipelineDAG. The canonical helpers
  // now live in @/lib/format.
  const dag = read("src/components/ui/PipelineDAG.tsx");
  const timeline = read("src/components/ui/EventsTimeline.tsx");
  const stepper = read("src/components/ui/WaterfallStepper.tsx");

  it("PipelineDAG no longer declares a local humanizeNode/duration helper", () => {
    expect(dag).not.toMatch(/function\s+humanizeNode\b/);
    expect(dag).toMatch(/from\s+["']@\/lib\/format["']/);
    // The two inline `< 1000 ? `${ms}ms` : …toFixed` ternaries are gone.
    expect(dag).not.toMatch(/\.toFixed\(2\)\}s`/);
  });

  it("EventsTimeline no longer declares a local humanizeNode/fmtDuration", () => {
    expect(timeline).not.toMatch(/function\s+humanizeNode\b/);
    expect(timeline).not.toMatch(/function\s+fmtDuration\b/);
    expect(timeline).toMatch(/humanizeNodeId|formatDurationMs/);
  });

  it("WaterfallStepper no longer declares a local formatDuration", () => {
    expect(stepper).not.toMatch(/function\s+formatDuration\b/);
    expect(stepper).toMatch(/formatDurationMs/);
  });
});
