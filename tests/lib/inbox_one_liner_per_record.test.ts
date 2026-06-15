/**
 * Regression — customer-inbox headlines must be per-record, not one shared
 * MANUAL_ORDER_INTAKE template string.
 *
 * `INTENT_SUMMARY_TEMPLATES` is keyed by intent. Every inbox record shares
 * `intent: MANUAL_ORDER_INTAKE`, so deriving the headline straight from the
 * template collapsed all of them onto one identical string ("New email order
 * — buyer requested $9.80 contract price") in both the queue row
 * (`problem_one_liner`) and the detail pane (`situation_headline`). The
 * backend renders the per-record email subject (`_email_order_template`);
 * `mockProblemOneLiner` mirrors that. Both surfaces consume that one helper.
 */
import { describe, it, expect } from "vitest";

import { MOCK_EXCEPTIONS } from "@/lib/mock-data/exceptions";
import { deriveMockCaseSummaries, mockProblemOneLiner } from "@/lib/mock-data/cases";
import { MOCK_ORDER_ANALYSES } from "@/lib/mock-data/order-analyses";

describe("inbox headlines are per-record", () => {
  const summaries = deriveMockCaseSummaries();
  const inbox = MOCK_EXCEPTIONS.filter((e) => e.intent === "MANUAL_ORDER_INTAKE");

  it("has more than one inbox record (else the lock is vacuous)", () => {
    expect(inbox.length).toBeGreaterThan(1);
  });

  it("renders a distinct, non-null queue headline per inbox record", () => {
    const liners = inbox.map(
      (e) => summaries.get(e.parent_case_id ?? "")?.problem_one_liner ?? null,
    );
    expect(liners.every((l) => !!l)).toBe(true);
    // The bug collapsed all of these onto one string.
    expect(new Set(liners).size).toBe(inbox.length);
  });

  it("derives the headline from the record's own email subject (both panes share this helper)", () => {
    for (const e of inbox) {
      const subject = MOCK_ORDER_ANALYSES[e.id]?.email_source?.subject;
      if (!subject) continue; // structurally absent — falls back to the template
      expect(mockProblemOneLiner(e.id, e.intent)).toBe(subject);
      expect(summaries.get(e.parent_case_id ?? "")?.problem_one_liner).toBe(subject);
    }
  });
});
