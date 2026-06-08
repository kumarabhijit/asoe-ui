/**
 * Deliverable lock (Pattern A) — EntitiesSection mounts via data-presence
 * dispatch (ADR-042 Phase 2). Mirrors the email-order-entry section lock:
 * the section mounts when `OrderAnalysis.entities_analysis` is populated, the
 * same way every enrichment section mounts — no per-intent page dispatch
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

describe("EntitiesSection deliverable", () => {
  it("the section component file exists", () => {
    expect(
      existsSync(join(ROOT, "src", "app", "exceptions", "EntitiesSection.tsx")),
    ).toBe(true);
  });

  it("ExceptionDetailPanel imports and mounts EntitiesSection", () => {
    expect(PANEL).toContain('import { EntitiesSection }');
    expect(PANEL).toContain("<EntitiesSection data={analysis.entities_analysis}");
  });

  it("mounts behind the entities_analysis data-presence guard (no intent dispatch)", () => {
    expect(PANEL).toContain("if (analysis.entities_analysis)");
  });
});
