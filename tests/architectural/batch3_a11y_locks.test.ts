/**
 * UX remediation Batch 3 (T5 accessibility) — source locks for the structural
 * a11y fixes whose behavioural rendering would need heavy harness setup
 * (full-page <main>, SVG focus on the DAG, 44px hit targets in the chrome).
 *
 * Each grep targets the exact anti-pattern the audit cited, so it fails on the
 * parent commit and stays green only while the fix is in place. The behavioural
 * regressions (Button aria-busy, Toast assertive, Attachment catch, Erasure
 * aria-live, ActivityIndicator live region, ConfidenceDisplay tabIndex) live in
 * the matching component test files.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

function read(rel: string): string {
  return readFileSync(path.resolve(__dirname, "../../", rel), "utf-8");
}

describe("Batch 3 — home /main landmark (skip-link target)", () => {
  const src = read("src/app/home/page.tsx");
  it("renders a real <main id=\"main-content\"> landmark", () => {
    expect(src).toMatch(/<main\s+id="main-content"/);
  });
  it("no longer uses the empty <div id=\"main-content\" /> placeholder", () => {
    expect(src).not.toMatch(/<div\s+id="main-content"\s*\/>/);
  });
});

describe("Batch 3 — PipelineDAG focusable edge keeps a visible focus ring", () => {
  it("interactive edge group does not suppress the focus outline", () => {
    const src = read("src/components/ui/PipelineDAG.tsx");
    // The global :focus-visible ring (globals.css) must not be killed by an
    // inline outline:none on the keyboard-focusable <g role="button">.
    expect(src).not.toMatch(/outline:\s*["']none["']/);
  });
});

describe("Batch 3 — 44px hit targets in the chrome", () => {
  it("Sidebar header icon buttons are >=44px", () => {
    const src = read("src/components/ui/Sidebar.tsx");
    const matches = src.match(/min-w-\[44px\]\s+min-h-\[44px\]/g) ?? [];
    // close + (optional) expand button.
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
  it("NavBar user-menu trigger is a >=44px hit target", () => {
    const src = read("src/components/ui/NavBar.tsx");
    expect(src).toMatch(/min-w-\[44px\]\s+min-h-\[44px\]/);
  });
});
