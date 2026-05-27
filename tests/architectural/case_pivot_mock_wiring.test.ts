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
    // Multi-issue cases mean exceptions can outnumber cases (one case
    // with N attached records), so we don't lock cases.length >= excs.length.
    // The invariant that matters: every exception's parent_case_id
    // resolves to a case in the list — otherwise the queue→case link
    // 404s on click.
    const [{ data: excs }, { items: cases }] = await Promise.all([
      exceptionsApi.list(),
      casesApi.list(),
    ]);
    expect(cases.length).toBeGreaterThan(0);
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

  it("every mock case carries an origin and a supergroup_code", async () => {
    // Post Case & Intent Super-Group pivot the EMAIL/API axis is
    // gone; the mock layer must mirror the backend's orthogonal
    // `origin` (CUSTOMER | API) + `supergroup_code` shape. The
    // asserted-field-set is the lock — adding a backend field on
    // OrderCase that the mock layer silently doesn't surface
    // should fail here.
    const { items: cases } = await casesApi.list();
    for (const c of cases) {
      expect(c.origin, `case ${c.case_id} missing origin`).toBeTruthy();
      expect(["CUSTOMER", "API"]).toContain(c.origin);
      expect(
        c.supergroup_code,
        `case ${c.case_id} missing supergroup_code`,
      ).toBeTruthy();
      expect(c.supergroup_code).toMatch(/^SG_/);
      // Phase 2 §8.4 — every case carries the projected RDD-miss
      // flag (defaults to false on rows the projector hasn't
      // stamped). Field-set lock; the value itself is not asserted.
      expect(typeof c.will_miss_rdd).toBe("boolean");
      // The retired legacy axes MUST NOT leak back into mock rows.
      expect(
        (c as unknown as Record<string, unknown>).source,
        `case ${c.case_id} carries retired field 'source'`,
      ).toBeUndefined();
      expect(
        (c as unknown as Record<string, unknown>).case_type,
        `case ${c.case_id} carries retired field 'case_type'`,
      ).toBeUndefined();
      expect(
        (c as unknown as Record<string, unknown>).email_classification,
        `case ${c.case_id} carries retired field 'email_classification'`,
      ).toBeUndefined();
    }
  });

  it("auto-mount path works for single-record cases (records[0] is fetchable)", async () => {
    // Single-record cases are the CSA's one-task happy path —
    // CaseDetailPanel auto-fires onSelectRecord(records[0].id) and the
    // page replaces the URL with ?record=<id>. The fetched record id
    // must resolve through exceptionsApi.get to load the analysis.
    //
    // Multi-issue cases mean we can't assume cases[0] is single-record;
    // pick the first case whose getRecords returns exactly one item.
    const { items: cases } = await casesApi.list();
    let single: { case_id: string; record_id: string } | null = null;
    for (const c of cases) {
      const { items } = await casesApi.getRecords(c.case_id);
      if (items.length === 1) {
        single = { case_id: c.case_id, record_id: items[0].id };
        break;
      }
    }
    expect(
      single,
      "no single-record case found — auto-mount path is no longer " +
        "exercised by the mock data layer",
    ).not.toBeNull();
    const detail = await exceptionsApi.get(single!.record_id);
    expect(detail.id).toBe(single!.record_id);
  });

  it("multi-issue cases surface N>1 records to the picker", async () => {
    // Companion to the single-record auto-mount lock above. The
    // RecordListPane is the case-detail picker the operator uses
    // when one PO carries several coincident exceptions
    // (e.g. price hold + back-order + duplicate retry on the same
    // Walmart Q1 reset PO). If the mock data layer ever collapses
    // back to a 1:1 record-per-case mapping, this lock starts failing
    // — preview-mode operators would lose coverage of the
    // multi-record disposition workflow.
    const { items: cases } = await casesApi.list();
    const recordSets = await Promise.all(
      cases.map((c) =>
        casesApi.getRecords(c.case_id).then((r) => ({
          case_id: c.case_id,
          record_ids: r.items.map((i) => i.id),
        })),
      ),
    );
    const multiCases = recordSets.filter((m) => m.record_ids.length > 1);
    expect(
      multiCases.length,
      "mock data layer has no multi-record cases — RecordListPane's " +
        "picker, the case-status aggregation, and the operator's " +
        "'choose a record to act on' workflow are uncovered in preview",
    ).toBeGreaterThanOrEqual(1);
    // Every record on a multi-issue case must be independently
    // fetchable — the picker is useless if the operator clicks a row
    // and the detail panel can't load.
    const allMultiRecordIds = multiCases.flatMap((m) =>
      m.record_ids.map((id) => ({ case_id: m.case_id, record_id: id })),
    );
    const details = await Promise.all(
      allMultiRecordIds.map(({ record_id }) => exceptionsApi.get(record_id)),
    );
    details.forEach((detail, i) => {
      const { case_id, record_id } = allMultiRecordIds[i];
      expect(detail.id).toBe(record_id);
      expect(detail.parent_case_id).toBe(case_id);
    });
  }, 30000);
});
