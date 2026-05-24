/**
 * Deliverable lock (Pattern A) — KnowledgeGraphSection mounts via data-presence
 * dispatch (ADR-042 Phase 7). Mounts when `OrderAnalysis.knowledge_graph` is
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

describe("KnowledgeGraphSection deliverable", () => {
  it("the section component file exists", () => {
    expect(
      existsSync(
        join(ROOT, "src", "app", "exceptions", "KnowledgeGraphSection.tsx"),
      ),
    ).toBe(true);
  });

  it("ExceptionDetailPanel imports and mounts KnowledgeGraphSection", () => {
    expect(PANEL).toContain("import { KnowledgeGraphSection }");
    expect(PANEL).toContain(
      "<KnowledgeGraphSection data={analysis.knowledge_graph}",
    );
  });

  it("mounts behind the knowledge_graph data-presence guard", () => {
    expect(PANEL).toContain("analysis?.knowledge_graph &&");
  });
});
