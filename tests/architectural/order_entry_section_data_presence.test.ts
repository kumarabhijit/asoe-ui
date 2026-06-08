/**
 * Deliverable lock (Pattern A) — OrderEntrySection mounts via data-presence
 * dispatch (ADR-042 Phase 3). Mounts when `OrderAnalysis.order_entry_extraction`
 * is populated — no per-intent dispatch (Guardrail #1). Verify by removing the
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

describe("OrderEntrySection deliverable", () => {
  it("the section component file exists", () => {
    expect(
      existsSync(join(ROOT, "src", "app", "exceptions", "OrderEntrySection.tsx")),
    ).toBe(true);
  });

  it("ExceptionDetailPanel imports and mounts OrderEntrySection", () => {
    expect(PANEL).toContain('import { OrderEntrySection }');
    expect(PANEL).toContain(
      "<OrderEntrySection data={analysis.order_entry_extraction}",
    );
  });

  it("mounts behind the order_entry_extraction data-presence guard", () => {
    expect(PANEL).toContain("if (analysis.order_entry_extraction)");
  });
});
