/**
 * Case-chrome consolidation lock (Phase 3, 2026-06-11).
 *
 * ORIGIN_LABEL / origin icon / SLA_BAND_VARIANT were copy-pasted in
 * FOUR files (cases/page.tsx, CasesQueueRow.tsx, CasesQueueRowV2.tsx,
 * CaseDetailPanel.tsx) — a new Origin value meant four edits, and the
 * copies had already drifted (icon sizes). The single source is now
 * src/app/cases/caseChrome.tsx; this lock fails if a consumer
 * re-introduces a local copy.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const read = (rel: string) =>
  readFileSync(join(__dirname, "..", "..", rel), "utf-8");

const CONSUMERS = [
  "src/app/cases/page.tsx",
  "src/app/cases/CasesQueueRow.tsx",
  "src/app/cases/CasesQueueRowV2.tsx",
  "src/app/cases/CaseDetailPanel.tsx",
];

describe("case chrome — single source in caseChrome.tsx", () => {
  it("caseChrome.tsx exports the shared maps and icon helper", () => {
    const src = read("src/app/cases/caseChrome.tsx");
    expect(src).toMatch(/export const ORIGIN_LABEL/);
    expect(src).toMatch(/export const SLA_BAND_VARIANT/);
    expect(src).toMatch(/export function originIcon/);
  });

  for (const file of CONSUMERS) {
    it(`${file} does not redefine the shared maps locally`, () => {
      const src = read(file);
      expect(src).not.toMatch(/const ORIGIN_LABEL\s*[:=]/);
      expect(src).not.toMatch(/const ORIGIN_ICON\s*[:=]/);
      expect(src).not.toMatch(/const SLA_BAND_VARIANT\s*[:=]/);
      expect(src).toMatch(/from "\.\/caseChrome"/);
    });
  }
});

describe("case chrome — unknown-origin fallback (Guardrail #1 default)", () => {
  // A new backend Origin value must render the `default` glyph/label,
  // never undefined/blank chrome. (Review finding 2026-06-11: the
  // structural lock above can't catch a deleted `default` entry.)
  it("originIcon returns the default glyph for unknown origins", async () => {
    const { originIcon } = await import("@/app/cases/caseChrome");
    expect(originIcon("SOME_FUTURE_ORIGIN")).toBeTruthy();
    expect(originIcon(undefined)).toBeTruthy();
  });

  it("ORIGIN_LABEL carries a default entry for unknown origins", async () => {
    const { ORIGIN_LABEL } = await import("@/app/cases/caseChrome");
    expect(ORIGIN_LABEL.default).toBeTruthy();
  });
});
