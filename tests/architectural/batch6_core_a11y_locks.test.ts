/**
 * UX remediation Batch 6 — source locks for the core-section a11y fixes
 * (report 04). Anchored to real audit findings; each fails on the parent.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

function read(rel: string): string {
  return readFileSync(path.resolve(__dirname, "../../", rel), "utf-8");
}

describe("Batch 6 — Diagnostics Trace-Evidence tabs carry tab semantics", () => {
  const src = read("src/app/exceptions/DiagnosticsSection.tsx");
  it("uses role=tablist / role=tab / aria-selected (was bare buttons)", () => {
    expect(src).toMatch(/role="tablist"/);
    expect(src).toMatch(/role="tab"/);
    expect(src).toMatch(/aria-selected=\{detailTab === tab\.id\}/);
  });
  it("associates each tab with its tabpanel via aria-controls", () => {
    expect(src).toMatch(/aria-controls=\{`trace-panel-\$\{tab\.id\}`\}/);
    expect(src).toMatch(/role="tabpanel"/);
  });
});

describe("Batch 6 — CollapsibleHeader exposes aria-controls", () => {
  const src = read("src/app/exceptions/shared.tsx");
  it("the header wires aria-controls to the region id", () => {
    expect(src).toMatch(/aria-controls=\{controlsId\}/);
    expect(src).toMatch(/controlsId=\{regionId\}/);
  });
});
