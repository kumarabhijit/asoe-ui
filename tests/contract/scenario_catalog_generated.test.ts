// Lock for the catalog-generated mock artifact (RFC §7, Phase 5).
//
// `scripts/gen-mock-data.ts` projects the committed scenario-catalog snapshot
// onto ExceptionSummary rows in
//   src/lib/mock-data/__generated__/scenario_catalog.ts
//
// These assertions lock the generated artifact to the snapshot WITHOUT
// re-running the emitter (the byte-level drift gate is `npm run
// verify:scenario-catalog`). They guard three things:
//   1. coverage  — every dispositioned catalog entry (one with a `lifecycle`)
//                  projects to exactly one generated row, and nothing extra.
//   2. case-pivot wiring — every generated row carries
//                  parent_case_id === `case-for-${id}` (the invariant
//                  tests/architectural/case_pivot_mock_wiring.test.ts locks
//                  for the hand-authored mocks; the generated artifact must
//                  stay adoption-ready).
//   3. shape     — the required ExceptionSummary fields are present.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";
import { parse } from "yaml";

import {
  CATALOG_EXCEPTIONS,
  CATALOG_EXCEPTION_COUNT,
} from "@/lib/mock-data/__generated__/scenario_catalog";

const SNAPSHOT = resolve(__dirname, "snapshots/scenario_catalog.yaml");

interface CatEntry {
  id: string;
  lifecycle?: string;
  fixture?: string;
}
interface Catalog {
  scenarios: CatEntry[];
  email_scenarios?: CatEntry[];
}

function dispositionedIds(): string[] {
  const cat = parse(readFileSync(SNAPSHOT, "utf-8")) as Catalog;
  const all = [...(cat.scenarios ?? []), ...(cat.email_scenarios ?? [])];
  return all
    .filter((e) => e.lifecycle)
    // Mirror gen-mock-data.ts: backend-only test fixtures (fixture:
    // test-*.eml) are not projected into the served demo queue — they
    // have no UI substrate (inbox bundles / line items).
    .filter((e) => !(typeof e.fixture === "string" && e.fixture.startsWith("test-")))
    .map((e) => e.id)
    .sort();
}

describe("catalog-generated mock artifact", () => {
  it("is non-empty and the count constant matches the array", () => {
    expect(CATALOG_EXCEPTIONS.length).toBeGreaterThan(0);
    expect(CATALOG_EXCEPTION_COUNT).toBe(CATALOG_EXCEPTIONS.length);
  });

  it("covers exactly the dispositioned catalog entries", () => {
    const generated = CATALOG_EXCEPTIONS.map((e) => e.id).sort();
    expect(generated).toEqual(dispositionedIds());
  });

  it("carries a parent_case_id on every row; rows on one PO share a case", () => {
    // Case-pivot invariant: every record has a parent case. The backend
    // groups records onto one case by order_id (api/case_resolver.py
    // materialise_for_event), so the projection mirrors it — scenarios
    // sharing an order_id resolve onto a single multi-record case, singletons
    // keep their per-id case.
    const casesByOrder = new Map<string, Set<string>>();
    for (const e of CATALOG_EXCEPTIONS) {
      expect(e.parent_case_id).toBeTruthy();
      const oid = e.order_id as string;
      if (!casesByOrder.has(oid)) casesByOrder.set(oid, new Set());
      casesByOrder.get(oid)!.add(e.parent_case_id as string);
    }
    for (const [, caseIds] of casesByOrder) {
      expect(caseIds.size).toBe(1);
    }
  });

  it("populates the required ExceptionSummary fields", () => {
    for (const e of CATALOG_EXCEPTIONS) {
      expect(e.id).toBeTruthy();
      expect(e.tenant_id).toBeTruthy();
      expect(e.order_id).toBeTruthy();
      expect(e.event_type).toBeTruthy();
      expect(e.lifecycle_state).toBeTruthy();
      expect(e.created_at).toBeTruthy();
      expect(e.updated_at).toBeTruthy();
    }
  });
});
