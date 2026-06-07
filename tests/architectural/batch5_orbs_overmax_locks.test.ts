/**
 * UX remediation Batch 5 — source locks for GravitationalOrbs (motion/tokens/
 * dark-mode/aria) and OverMaxSection (Guardrail #6: backend totals, no ad-hoc
 * "—"). Canvas + dense-table behaviour is awkward to assert in jsdom, so these
 * grep the anti-patterns the audit cited; each fails on the parent commit.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

function read(rel: string): string {
  return readFileSync(path.resolve(__dirname, "../../", rel), "utf-8");
}

describe("Batch 5 — GravitationalOrbs respects motion, tokens, dark mode, a11y", () => {
  const src = read("src/components/ui/GravitationalOrbs.tsx");
  it("marks the decorative canvas aria-hidden", () => {
    expect(src).toMatch(/aria-hidden="true"/);
  });
  it("guards the animation behind prefers-reduced-motion", () => {
    expect(src).toMatch(/prefers-reduced-motion/);
  });
  it("drops the hardcoded light background and reads the surface-page token", () => {
    expect(src).not.toContain("#F8FAFC");
    expect(src).toMatch(/--color-surface-page/);
  });
  it("resolves orb colours from design tokens", () => {
    expect(src).toMatch(/--color-brand/);
    expect(src).toMatch(/--color-cat-(purple|teal)/);
  });
});

describe("Batch 5 — OverMaxSection uses backend totals + EvidenceBlock (Guardrail #6)", () => {
  const src = read("src/app/exceptions/OverMaxSection.tsx");
  it("does not reduce trim_plan to derive audit totals in the projector", () => {
    expect(src).not.toMatch(/trim_plan\.reduce/);
  });
  it("renders the server-computed totals", () => {
    expect(src).toMatch(/data\.trimmed_total/);
    expect(src).toMatch(/data\.delta_total/);
  });
  it("routes max_line_qty absence through EvidenceBlock, not an ad-hoc dash", () => {
    // The per-line cap + layer cells used `: <span>—</span>` fallbacks.
    expect(src).not.toMatch(/>—<\/span>/);
  });
});
