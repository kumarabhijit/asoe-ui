/**
 * Deliverable lock (Pattern A) — SapDataSection mounts via data-presence
 * dispatch (ADR-042 Phase 2). The section mounts when
 * `OrderAnalysis.sap_data_analysis` is populated — no per-intent dispatch
 * (Guardrail #1). Verify by removing the mount locally — this must fail.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..");
const PANEL = readFileSync(
  join(ROOT, "src", "app", "exceptions", "ExceptionDetailPanel.tsx"),
  "utf-8",
);

describe("SapDataSection deliverable", () => {
  it("the section component file exists", () => {
    expect(
      existsSync(join(ROOT, "src", "app", "exceptions", "SapDataSection.tsx")),
    ).toBe(true);
  });

  it("ExceptionDetailPanel imports and mounts SapDataSection", () => {
    expect(PANEL).toContain('import { SapDataSection }');
    expect(PANEL).toContain("<SapDataSection data={analysis.sap_data_analysis}");
  });

  it("mounts behind the sap_data_analysis data-presence guard", () => {
    expect(PANEL).toContain("analysis?.sap_data_analysis &&");
  });
});
