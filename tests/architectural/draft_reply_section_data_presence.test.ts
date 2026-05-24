/**
 * Deliverable lock (Pattern A) — DraftReplySection mounts via data-presence
 * dispatch (ADR-042 Phase 7). Mounts when `OrderAnalysis.draft_reply` is
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

describe("DraftReplySection deliverable", () => {
  it("the section component file exists", () => {
    expect(
      existsSync(join(ROOT, "src", "app", "exceptions", "DraftReplySection.tsx")),
    ).toBe(true);
  });

  it("ExceptionDetailPanel imports and mounts DraftReplySection", () => {
    expect(PANEL).toContain("import { DraftReplySection }");
    expect(PANEL).toContain("<DraftReplySection data={analysis.draft_reply}");
  });

  it("mounts behind the draft_reply data-presence guard", () => {
    expect(PANEL).toContain("analysis?.draft_reply &&");
  });
});
