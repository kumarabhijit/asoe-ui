/**
 * Case-summary projection fields lock — ADR-041 P3e §3.1.
 *
 * Locks the seven `CaseSummary` fields on `CaseListItem` against
 * the backend contract in `asoe2/api/schemas.py::CaseListItem`. If
 * a backend rename / removal ships without updating the UI mirror,
 * this test fails — the same drift mechanism case_pivot_mock_wiring
 * catches for the S15a invariant.
 *
 * The mock implementation of `casesApi.list()` must populate every
 * field on every row (null is acceptable; absent is not). This
 * makes the Structurally Omitted EvidenceBlock branch the explicit
 * mock state, not an accidental shape mismatch.
 */
import { describe, expect, it } from "vitest";

import { casesApi } from "@/lib/api";

const REQUIRED_KEYS = [
  "customer_name",
  "top_line_sku_code",
  "top_line_sku_title",
  "problem_one_liner",
  "intent",
  "dollar_impact",
  "audit_verdict_color",
] as const;

describe("case-summary projection fields (ADR-041 P3e §3.1)", () => {
  it("CaseListItem rows carry every projection field", async () => {
    const { items } = await casesApi.list();
    expect(items.length).toBeGreaterThan(0);
    for (const row of items) {
      for (const key of REQUIRED_KEYS) {
        expect(
          key in row,
          `CaseListItem ${row.case_id} missing field "${key}" — ` +
            "ADR-041 P3e §3.1 requires backend to populate (or " +
            "null) every CaseSummary projection field",
        ).toBe(true);
      }
    }
  });

  it("audit_verdict_color is null or R/A/G — no other strings", async () => {
    const { items } = await casesApi.list();
    for (const row of items) {
      const v = row.audit_verdict_color;
      expect(
        v === null || v === "R" || v === "A" || v === "G",
        `row ${row.case_id} audit_verdict_color=${v} — must be null|R|A|G`,
      ).toBe(true);
    }
  });

  it("dollar_impact, when present, carries amount_cents + ISO currency", async () => {
    const { items } = await casesApi.list();
    for (const row of items) {
      const d = row.dollar_impact;
      if (d === null) continue;
      expect(
        typeof d.amount_cents === "number",
        `row ${row.case_id} dollar_impact.amount_cents must be a number`,
      ).toBe(true);
      expect(
        typeof d.currency === "string" && d.currency.length === 3,
        `row ${row.case_id} dollar_impact.currency must be ISO 4217 ` +
          "(3-letter string) — bare amount without currency is a " +
          "partial-truth state (Guardrail #6)",
      ).toBe(true);
    }
  });

  it("mock projection produces realistic non-null values for at least one row", async () => {
    // Before the INTENT_SUMMARY_TEMPLATES mock layer landed, every
    // row's projection fields were null — preview environments
    // showed the V2 row as an empty husk. Lock that the mock
    // produces non-null values for at least a subset of rows so
    // regression to "all null" is caught.
    const { items } = await casesApi.list();
    const withSummary = items.filter(
      (row) =>
        row.customer_name !== null
        || row.audit_verdict_color !== null
        || row.dollar_impact !== null
        || row.problem_one_liner !== null,
    );
    expect(
      withSummary.length,
      "expected at least one mock row with a populated CaseSummary " +
        "projection — `deriveMockCaseSummaries` produces realistic " +
        "values per intent so preview environments showcase the V2 row",
    ).toBeGreaterThan(0);
  });

  it("verdict color is sourced from the lead record's shadow_verdict", async () => {
    // Severity-wins rollup matches the backend `compute_case_summary`
    // semantics. The mock layer just mirrors the lead record's
    // verdict; this test guards against a regression where the mock
    // returns a hardcoded color regardless of data.
    const { items } = await casesApi.list();
    const colours = new Set(items.map((r) => r.audit_verdict_color));
    expect(
      colours.size,
      "mock projection must produce multiple verdict colors across " +
        "the seed fixture — a single-color result means the rollup " +
        "is hardcoded rather than data-driven",
    ).toBeGreaterThan(1);
  });

  // DEFERRED (parity flip, Step 3): the served queue is the
  // catalog-generated CATALOG_EXCEPTIONS (one case per scenario,
  // matching the asoe2 sandbox bootstrap), so the hand-authored
  // multi-intent cases (case-multi-WMT-Q1RESET etc.) no longer exist.
  // The child_intents dedup logic in deriveMockCaseSummaries is
  // unchanged; it simply has no >1-record case to exercise until the
  // catalog expresses multi-record cases (see gen-mock-data follow-up).
  it.skip("at least one mock case carries multiple distinct child_intents (PO #4)", async () => {
    // Multi-intent cases exist in the mock fixture
    // (`case-multi-WMT-Q1RESET` = 3 intents,
    // `case-multi-COST-EOQ` = 2, `case-multi-KR-WK15` = 2). Before
    // PO 2026-05-28 #4 the projection only carried the primary
    // intent in child_intents, so these cases looked single-intent
    // on the queue row. Lock: at least one row must surface > 1
    // distinct intent.
    const { items } = await casesApi.list();
    const multiIntentRows = items.filter(
      (r) => new Set(r.child_intents).size > 1,
    );
    expect(
      multiIntentRows.length,
      "expected at least one mock case with > 1 distinct child " +
        "intent — `deriveMockCaseSummaries` must dedup across child " +
        "records so multi-intent cases (case-multi-WMT-Q1RESET, " +
        "case-multi-COST-EOQ, case-multi-KR-WK15) are visible on " +
        "the queue row",
    ).toBeGreaterThan(0);
  });
});
