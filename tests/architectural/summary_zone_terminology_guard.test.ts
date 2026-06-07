/**
 * ADR-045 CP2 — summary-zone terminology lock.
 *
 * The summary zone renders governed labels (via TaxonomyLabel /
 * useDisplayLabel); the audit/Diagnostics zone keeps raw machine tokens.
 * This lock pins the rewired leak sites so the raw-token dumps and the
 * "Email Order Intake" misnomer can't creep back into summary surfaces.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("summary-zone terminology guard (ADR-045)", () => {
  it("HeaderRibbon does not dump the raw event_type into the summary", () => {
    const src = read("src/app/exceptions/HeaderRibbon.tsx");
    expect(src).not.toMatch(/event_type\.replace/);
    expect(src).toContain("TaxonomyLabel");
  });

  it("the record list renders intents via the governed authority", () => {
    const src = read("src/app/cases/RecordListPane.tsx");
    expect(src).toContain("TaxonomyLabel");
    expect(src).not.toContain("intentLabelFor");
  });

  it("no summary surface carries the 'Email Order Intake' misnomer", () => {
    for (const p of [
      "src/app/exceptions/EmailOrderEntrySection.tsx",
      "src/app/exceptions/ExceptionDetailPanel.tsx",
      "src/app/cases/RecordListPane.tsx",
      "src/app/exceptions/HeaderRibbon.tsx",
    ]) {
      expect(read(p), `${p} still carries the "Email Order Intake" misnomer`).not.toContain(
        "Email Order Intake",
      );
    }
  });

  it("the Diagnostics audit zone still renders the raw trace tokens", () => {
    // The other half of the zone split: raw tokens are the SOX evidence
    // and must NOT be humanised here.
    const src = read("src/app/exceptions/DiagnosticsSection.tsx");
    expect(src).toContain("trace.intent_selected");
    expect(src).toContain("trace.recipe_name");
  });
});
