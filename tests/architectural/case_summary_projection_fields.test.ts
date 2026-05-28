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
});
