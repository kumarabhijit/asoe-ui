/**
 * Regression — every queue/detail record gets a per-record Situation headline,
 * and customer-inbox rows carry no fabricated dollar impact.
 *
 * Two prior gaps:
 *   1. Intents with no per-intent template (PALLET_CONFIG, PRICE_HOLD_RELEASE,
 *      EDI_MISMATCH) rendered a BLANK one-liner. They now fall back to the
 *      record's own diagnosis (first sentence). MIN_ORDER_QTY was also blank
 *      because the mock template was keyed by the stale `MOQ_UPLIFT` name
 *      instead of the Intent enum value.
 *   2. MANUAL_ORDER_INTAKE carried a static `impact_cents` (identical $1,560 on
 *      every inbox row). The backend recipe emits no financial_impact, so the
 *      honest value is null (cell collapsed).
 */
import { describe, it, expect } from "vitest";

import { MOCK_EXCEPTIONS } from "@/lib/mock-data/exceptions";
import { deriveMockCaseSummaries } from "@/lib/mock-data/cases";
import { MOCK_ORDER_ANALYSES } from "@/lib/mock-data/order-analyses";

const summaries = deriveMockCaseSummaries();
const lineFor = (id: string) =>
  summaries.get(MOCK_EXCEPTIONS.find((e) => e.id === id)?.parent_case_id ?? "")
    ?.problem_one_liner ?? null;

describe("case headlines never blank when a diagnosis exists", () => {
  it("every record that has a diagnosis renders a non-blank one-liner", () => {
    const blank = MOCK_EXCEPTIONS.filter((e) => {
      const hasDiagnosis = !!MOCK_ORDER_ANALYSES[e.id]?.diagnosis;
      const oneLiner = e.parent_case_id
        ? summaries.get(e.parent_case_id)?.problem_one_liner
        : null;
      return hasDiagnosis && !oneLiner;
    }).map((e) => `${e.id} (${e.intent})`);
    expect(blank).toEqual([]);
  });

  it("falls back to the record's own diagnosis for template-less intents", () => {
    // PALLET_CONFIG / EDI_MISMATCH have no template → diagnosis first-sentence.
    for (const id of ["exc-014", "exc-019"]) {
      const diag = MOCK_ORDER_ANALYSES[id]?.diagnosis ?? "";
      const line = lineFor(id);
      expect(line, id).toBeTruthy();
      expect(diag.startsWith(line!.replace(/…$/, "")), id).toBe(true);
    }
  });

  it("renders the MIN_ORDER_QTY template (keyed by the enum value, not MOQ_UPLIFT)", () => {
    expect(lineFor("exc-013")).toBeTruthy();
    expect(lineFor("exc-013")).not.toMatch(/below moq.*\.$/i); // template, not a diagnosis sentence
  });
});

describe("customer-inbox rows carry no fabricated dollar impact", () => {
  it("dollar_impact is null for every MANUAL_ORDER_INTAKE case", () => {
    const inbox = MOCK_EXCEPTIONS.filter((e) => e.intent === "MANUAL_ORDER_INTAKE");
    expect(inbox.length).toBeGreaterThan(1);
    const impacts = inbox.map(
      (e) => summaries.get(e.parent_case_id ?? "")?.dollar_impact ?? null,
    );
    expect(impacts.every((d) => d === null)).toBe(true);
  });
});
