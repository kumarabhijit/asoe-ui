/**
 * Deliverable lock (Pattern A) — ChangeAnalysisSection mounts via data-presence
 * dispatch (ADR-042 Phase 6). Mounts when `OrderAnalysis.change_analysis` is
 * populated — no per-intent dispatch (Guardrail #1). Verify by removing the
 * mount locally — this must fail.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..");
const PANEL = readFileSync(
  join(ROOT, "src", "app", "exceptions", "ExceptionDetailPanel.tsx"),
  "utf-8",
);

describe("ChangeAnalysisSection deliverable", () => {
  it("the section component file exists", () => {
    expect(
      existsSync(
        join(ROOT, "src", "app", "exceptions", "ChangeAnalysisSection.tsx"),
      ),
    ).toBe(true);
  });

  it("ExceptionDetailPanel imports and mounts ChangeAnalysisSection", () => {
    expect(PANEL).toContain("import { ChangeAnalysisSection }");
    expect(PANEL).toContain(
      "<ChangeAnalysisSection data={analysis.change_analysis}",
    );
  });

  it("mounts behind the change_analysis data-presence guard", () => {
    expect(PANEL).toContain("if (analysis.change_analysis)");
  });
});
