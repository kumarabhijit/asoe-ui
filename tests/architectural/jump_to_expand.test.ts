/**
 * Deliverable lock (Pattern A) — "Jump to" links expand the section they
 * target (#4) and the bar is data-presence-driven incl. Knowledge Graph (#5).
 *
 * The expand-on-jump behaviour is owned by the shared `useHashOpen` hook in
 * shared.tsx; CollapsibleSection, EvidenceGrid, and DiagnosticsSection all wire
 * it so a hash anchor reveals (not just scrolls to) its collapsed section.
 * Removing any of these wirings, or dropping the Knowledge Graph / Source
 * Email entries from the anchor bar, must fail.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..", "src", "app", "exceptions");
const read = (f: string) => readFileSync(join(ROOT, f), "utf-8");

describe("Jump-to expand mechanism", () => {
  it("shared.tsx exports the useHashOpen hook", () => {
    expect(read("shared.tsx")).toContain("export function useHashOpen");
  });

  it("CollapsibleSection wires useHashOpen against its id", () => {
    const src = read("shared.tsx");
    expect(src).toContain("useHashOpen(id, sectionRef");
  });

  it("EvidenceGrid + DiagnosticsSection wire useHashOpen for expand-on-jump", () => {
    expect(read("EvidenceGrid.tsx")).toContain("useHashOpen(anchorId");
    expect(read("DiagnosticsSection.tsx")).toContain("useHashOpen(anchorId");
  });

  it("anchor bar is data-presence-driven and includes Knowledge Graph + Source Email", () => {
    const src = read("ExceptionDetailPanel.tsx");
    expect(src).toContain("hasKnowledgeGraph");
    expect(src).toContain("#section-knowledge-graph");
    expect(src).toContain("#section-source-email");
  });

  it("CollapsibleSection gives Source Email + Knowledge Graph stable anchor ids", () => {
    const src = read("ExceptionDetailPanel.tsx");
    expect(src).toContain('id="section-source-email"');
    expect(src).toContain('id="section-knowledge-graph"');
    expect(src).toContain('id="section-draft-reply"');
  });
});
