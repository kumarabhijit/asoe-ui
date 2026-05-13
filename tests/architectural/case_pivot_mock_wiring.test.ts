/**
 * Case-pivot mock wiring (S15a invariant).
 *
 * The asoe2 backend materialises a case for every record
 * (`api/case_resolver.py::should_materialise() -> True`). The
 * `/cases/[id]?record=<id>` page is the canonical action surface;
 * if a record's `parent_case_id` is null OR if the case has no
 * attached records, the picker is empty, the inline
 * ExceptionDetailPanel never mounts, and the operator sees only
 * the slim case strip with no Agent Recommendation, no HITL
 * action ribbon (Approve / Reject / Override / Escalate /
 * Reanalyze), and no Diagnostics surface.
 *
 * This lock asserts the mock data layer holds the same invariant
 * the backend enforces — so dev-mode and Vercel-preview operators
 * see the rich detail surface, not a half-empty case header.
 */
import { describe, it, expect } from "vitest";

import { casesApi, exceptionsApi } from "@/lib/api";

describe("case-pivot mock wiring", () => {
  it("every exceptionsApi.list() row carries parent_case_id", async () => {
    const { data } = await exceptionsApi.list();
    expect(data.length).toBeGreaterThan(0);
    for (const exc of data) {
      expect(
        exc.parent_case_id,
        `exception ${exc.id} missing parent_case_id — ` +
          `queue→case URL falls through to /cases/undefined`,
      ).toBeTruthy();
    }
  });

  it("every exceptionsApi.get() detail surfaces parent_case_id", async () => {
    const { data } = await exceptionsApi.list();
    // Sample three representative exceptions across verdict bands so
    // a future regression on the detail-path shape is caught quickly.
    const sample = [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]];
    for (const exc of sample) {
      const detail = await exceptionsApi.get(exc.id);
      expect(detail.parent_case_id).toBeTruthy();
    }
  });

  it("casesApi.list() returns a case for every exception", async () => {
    const [{ data: excs }, { items: cases }] = await Promise.all([
      exceptionsApi.list(),
      casesApi.list(),
    ]);
    expect(cases.length).toBeGreaterThanOrEqual(excs.length);
    const caseIds = new Set(cases.map((c) => c.case_id));
    for (const exc of excs) {
      expect(
        caseIds.has(exc.parent_case_id!),
        `case ${exc.parent_case_id} for exception ${exc.id} ` +
          `is missing from casesApi.list() — the queue link will 404`,
      ).toBe(true);
    }
  });

  it("casesApi.getRecords() returns the matching record for every case", async () => {
    const { items: cases } = await casesApi.list();
    expect(cases.length).toBeGreaterThan(0);
    // Each getRecords call has a MOCK_DELAY; iterating in parallel keeps
    // the suite under the vitest default timeout while still proving
    // the invariant across the full case set.
    const records = await Promise.all(
      cases.map((c) => casesApi.getRecords(c.case_id).then((r) => ({ c, r }))),
    );
    for (const { c, r } of records) {
      expect(
        r.total,
        `case ${c.case_id} has zero attached records — the inline ` +
          `ExceptionDetailPanel will never mount and Approve / ` +
          `Reject / Override / Escalate / Re-analyze stay hidden`,
      ).toBeGreaterThan(0);
      for (const item of r.items) {
        expect(item.parent_case_id).toBe(c.case_id);
      }
    }
  });

  it("every mock case carries an ADR-041 case_type", async () => {
    const { items: cases } = await casesApi.list();
    for (const c of cases) {
      expect(c.case_type, `case ${c.case_id} missing case_type`).toBeTruthy();
      expect(["EMAIL_ENTRY", "BLOCK"]).toContain(c.case_type);
      if (c.case_type === "EMAIL_ENTRY") {
        expect(
          c.email_classification,
          `EMAIL_ENTRY case ${c.case_id} missing email_classification`,
        ).toBeTruthy();
      } else {
        expect(
          c.email_classification ?? null,
          `BLOCK case ${c.case_id} must have email_classification=null`,
        ).toBeNull();
      }
    }
  });

  it("auto-mount path works for single-record cases (records[0] is fetchable)", async () => {
    // Single-record cases are the CSA's one-task happy path —
    // CaseDetailPanel auto-fires onSelectRecord(records[0].id) and the
    // page replaces the URL with ?record=<id>. The fetched record id
    // must resolve through exceptionsApi.get to load the analysis.
    const { items: cases } = await casesApi.list();
    const single = cases[0];
    const { items } = await casesApi.getRecords(single.case_id);
    expect(items.length).toBe(1);
    const detail = await exceptionsApi.get(items[0].id);
    expect(detail.id).toBe(items[0].id);
  });
});
