/**
 * Deliverable lock (Pattern A) — Edi850Section mounts via data-presence
 * dispatch (ADR-042 Phase 5). Mounts when `OrderAnalysis.edi_850_audit` is
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

describe("Edi850Section deliverable", () => {
  it("the section component file exists", () => {
    expect(
      existsSync(join(ROOT, "src", "app", "exceptions", "Edi850Section.tsx")),
    ).toBe(true);
  });

  it("ExceptionDetailPanel imports and mounts Edi850Section", () => {
    expect(PANEL).toContain("import { Edi850Section }");
    expect(PANEL).toContain("<Edi850Section data={analysis.edi_850_audit}");
  });

  it("mounts behind the edi_850_audit data-presence guard", () => {
    expect(PANEL).toContain("analysis?.edi_850_audit &&");
  });
});
