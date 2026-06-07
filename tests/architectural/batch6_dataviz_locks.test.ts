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

describe("Batch 6 — PipelineDAG audit-path + focus a11y wiring", () => {
  const dag = read("src/components/ui/PipelineDAG.tsx");

  it("gives un-taken edges a non-colour (dashed) differentiator", () => {
    expect(dag).toMatch(/strokeDasharray=\{isTaken \? undefined : /);
  });

  it("restores focus to the originating edge when the panel closes", () => {
    expect(dag).toMatch(
      /from\s+["']@\/hooks\/useFocusRestoreOnClose["']/,
    );
    expect(dag).toMatch(/useFocusRestoreOnClose\(!!selectedEdge\)/);
  });
});

describe("Batch 6 — WaterfallStepper reduced-motion gate is reactive", () => {
  const stepper = read("src/components/ui/WaterfallStepper.tsx");
  it("uses the reactive usePrefersReducedMotion hook, not a one-shot read", () => {
    expect(stepper).toMatch(/from\s+["']@\/hooks\/usePrefersReducedMotion["']/);
    expect(stepper).not.toMatch(/function\s+prefersReducedMotion\b/);
  });
});

describe("Batch 6 — ClassificationHistoryPanel formats the audit timestamp", () => {
  const panel = read("src/components/cases/ClassificationHistoryPanel.tsx");
  it("renders formatTimestamp(classified_at), keeping ISO in dateTime", () => {
    expect(panel).toMatch(/formatTimestamp\(e\.classified_at\)/);
    expect(panel).toMatch(/dateTime=\{e\.classified_at\}/);
    // The raw ISO is no longer the visible label.
    expect(panel).not.toMatch(/>\{e\.classified_at\}</);
  });
});
