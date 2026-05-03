/**
 * Unit tests for `src/app/exceptions/searchParser.ts`.
 *
 * Covers:
 *   - Tokeniser: bare terms, `key:value`, quoted values, unknown keys
 *   - Each operator's predicate: account / state / intent / verdict /
 *     since / before — including the duration vs ISO-date branches and
 *     the bare-yyyy-mm-dd local-timezone fix
 *   - End-to-end `matchExceptions`: operators + fuzzy free-term
 *     matching combined; warnings surfaced for unparseable input
 */
import { describe, it, expect } from "vitest";
import {
  parseQuery,
  operatorToPredicate,
  matchExceptions,
} from "@/app/exceptions/searchParser";
import type { ExceptionSummary } from "@/types/exceptions";

const fixedNow = new Date("2026-05-03T12:00:00Z");

function exc(over: Partial<ExceptionSummary> = {}): ExceptionSummary {
  return {
    id: "exc-1",
    tenant_id: "acme-corp",
    order_id: "SO-1001",
    event_type: "EDI_850_PRICE_MISMATCH",
    intent: "CONTRACTUAL_CORRECTION",
    lifecycle_state: "PENDING_REVIEW",
    shadow_verdict: "YELLOW",
    selected_recipe: "PriceAdjustmentRecipe.py",
    final_status: "MANUAL_REVIEW_REQUIRED",
    created_at: "2026-05-01T08:00:00Z",
    updated_at: "2026-05-02T09:00:00Z",
    account_id: "acct-walmart",
    account_name: "Walmart",
    ...over,
  };
}

describe("parseQuery — tokeniser", () => {
  it("returns empty halves for empty input", () => {
    expect(parseQuery("")).toEqual({ operators: [], freeText: "", warnings: [] });
    expect(parseQuery("   ")).toEqual({ operators: [], freeText: "", warnings: [] });
  });

  it("treats bare terms as free text", () => {
    const r = parseQuery("walmart credit");
    expect(r.operators).toEqual([]);
    expect(r.freeText).toBe("walmart credit");
    expect(r.warnings).toEqual([]);
  });

  it("recognises key:value operators", () => {
    const r = parseQuery("account:walmart state:pending_review");
    expect(r.operators).toEqual([
      { key: "account", rawValue: "walmart" },
      { key: "state", rawValue: "pending_review" },
    ]);
    expect(r.freeText).toBe("");
  });

  it("respects quoted values", () => {
    const r = parseQuery('account:"Acme Corp" walmart');
    expect(r.operators).toEqual([{ key: "account", rawValue: "Acme Corp" }]);
    expect(r.freeText).toBe("walmart");
  });

  it("flags unknown operators as warnings and keeps the token in free text", () => {
    const r = parseQuery("foo:bar walmart");
    expect(r.operators).toEqual([]);
    expect(r.freeText).toBe("foo:bar walmart");
    expect(r.warnings[0]).toMatch(/Unknown operator 'foo:bar'/);
  });

  it("flags empty operator values as warnings", () => {
    const r = parseQuery("account: walmart");
    // Tokeniser splits on whitespace, so 'account:' is one token,
    // 'walmart' is another. The empty-value path warns and falls
    // through to free text.
    expect(r.warnings[0]).toMatch(/Unknown operator 'account:'/);
    expect(r.freeText).toContain("walmart");
  });

  it("strips quotes from bare terms too", () => {
    const r = parseQuery('"PO-DUP-001"');
    expect(r.freeText).toBe("PO-DUP-001");
  });
});

describe("operatorToPredicate", () => {
  it("account: matches account_name substring (case-insensitive)", () => {
    const p = operatorToPredicate({ key: "account", rawValue: "wal" }, fixedNow)!;
    expect(p.predicate(exc())).toBe(true);
    expect(p.predicate(exc({ account_name: "Kroger", account_id: "acct-kroger" }))).toBe(false);
  });

  it("state: matches normalised lifecycle_state exactly", () => {
    const p = operatorToPredicate({ key: "state", rawValue: "pending review" }, fixedNow)!;
    expect(p.predicate(exc({ lifecycle_state: "PENDING_REVIEW" }))).toBe(true);
    expect(p.predicate(exc({ lifecycle_state: "RESOLVED" }))).toBe(false);
  });

  it("intent: matches normalised intent exactly", () => {
    const p = operatorToPredicate({ key: "intent", rawValue: "duplicate-po" }, fixedNow)!;
    expect(p.predicate(exc({ intent: "DUPLICATE_PO" }))).toBe(true);
    expect(p.predicate(exc({ intent: "CREDIT_BLOCK" }))).toBe(false);
  });

  it("verdict: matches shadow_verdict exactly (case-insensitive)", () => {
    const p = operatorToPredicate({ key: "verdict", rawValue: "red" }, fixedNow)!;
    expect(p.predicate(exc({ shadow_verdict: "RED" }))).toBe(true);
    expect(p.predicate(exc({ shadow_verdict: "GREEN" }))).toBe(false);
  });

  it("since:Nd accepts day duration", () => {
    const p = operatorToPredicate({ key: "since", rawValue: "7d" }, fixedNow)!;
    // updated_at 2026-05-02 ≥ now-7d (2026-04-26) ✓
    expect(p.predicate(exc({ updated_at: "2026-05-02T09:00:00Z" }))).toBe(true);
    // updated_at 2026-04-25 < now-7d ✗
    expect(p.predicate(exc({ updated_at: "2026-04-25T09:00:00Z" }))).toBe(false);
  });

  it("since:Nh accepts hour duration", () => {
    const p = operatorToPredicate({ key: "since", rawValue: "24h" }, fixedNow)!;
    // 12 hours ago ✓
    expect(p.predicate(exc({ updated_at: "2026-05-03T00:00:00Z" }))).toBe(true);
    // 36 hours ago ✗
    expect(p.predicate(exc({ updated_at: "2026-05-02T00:00:00Z" }))).toBe(false);
  });

  it("since:<bare yyyy-mm-dd> uses local midnight", () => {
    const p = operatorToPredicate({ key: "since", rawValue: "2026-05-02" }, fixedNow)!;
    // 2026-05-02T09 (after local midnight on the 2nd) ✓
    expect(p.predicate(exc({ updated_at: "2026-05-02T09:00:00Z" }))).toBe(true);
    // 2026-05-01 ✗
    expect(p.predicate(exc({ updated_at: "2026-05-01T20:00:00Z" }))).toBe(false);
  });

  it("before: is the strict-< inverse of since:", () => {
    const p = operatorToPredicate({ key: "before", rawValue: "7d" }, fixedNow)!;
    // updated_at 2026-04-25 < now-7d ✓
    expect(p.predicate(exc({ updated_at: "2026-04-25T09:00:00Z" }))).toBe(true);
    // updated_at 2026-05-02 ✗
    expect(p.predicate(exc({ updated_at: "2026-05-02T09:00:00Z" }))).toBe(false);
  });

  it("since: with unparseable value emits a warning and matches all", () => {
    const r = operatorToPredicate({ key: "since", rawValue: "yesterday" }, fixedNow)!;
    expect(r.warning).toMatch(/Couldn't parse 'since:yesterday'/);
    // The predicate is permissive so the operator still sees rows;
    // the warning is what surfaces the bad input.
    expect(r.predicate(exc())).toBe(true);
  });
});

describe("matchExceptions — end-to-end", () => {
  const dataset: ExceptionSummary[] = [
    exc({ id: "1", order_id: "SO-1001", account_id: "acct-walmart", account_name: "Walmart", lifecycle_state: "PENDING_REVIEW", intent: "CONTRACTUAL_CORRECTION", updated_at: "2026-05-02T09:00:00Z" }),
    exc({ id: "2", order_id: "SO-2200", account_id: "acct-target", account_name: "Target", lifecycle_state: "BLOCKED", intent: "CREDIT_BLOCK", shadow_verdict: "RED", updated_at: "2026-04-30T09:00:00Z" }),
    exc({ id: "3", order_id: "PO-DUP-001", account_id: "acct-kroger", account_name: "Kroger", lifecycle_state: "PENDING_REVIEW", intent: "DUPLICATE_PO", updated_at: "2026-04-15T09:00:00Z" }),
    exc({ id: "4", order_id: "SO-4455", account_id: "acct-walmart", account_name: "Walmart", lifecycle_state: "RESOLVED", intent: "CONTRACTUAL_CORRECTION", shadow_verdict: "GREEN", updated_at: "2026-05-01T09:00:00Z" }),
  ];

  it("operators alone narrow the list", () => {
    const r = matchExceptions(dataset, parseQuery("account:walmart state:resolved"), fixedNow);
    expect(r.matched.map((e) => e.id)).toEqual(["4"]);
  });

  it("free text fuzzy-matches order_id and account_name", () => {
    // Slight typo on the order id → fuse still hits.
    const r = matchExceptions(dataset, parseQuery("PO-DUP"), fixedNow);
    expect(r.matched.some((e) => e.id === "3")).toBe(true);
  });

  it("operators AND with free text", () => {
    const r = matchExceptions(dataset, parseQuery("account:walmart 1001"), fixedNow);
    expect(r.matched.map((e) => e.id)).toEqual(["1"]);
  });

  it("since: filter restricts to recent updates", () => {
    const r = matchExceptions(dataset, parseQuery("since:7d"), fixedNow);
    // 2026-05-03 minus 7d = 2026-04-26. id 3 (04-15) drops.
    expect(r.matched.map((e) => e.id).sort()).toEqual(["1", "2", "4"]);
  });

  it("returns warnings from the parser and from operator failures", () => {
    const r = matchExceptions(
      dataset,
      parseQuery("foo:bar since:yesterday walmart"),
      fixedNow,
    );
    // The unknown-operator warning AND the unparseable-since warning
    // both surface; matched rows are still narrowed by the salvageable
    // free-text portion.
    expect(r.warnings.length).toBeGreaterThanOrEqual(2);
    expect(r.warnings.join("\n")).toMatch(/Unknown operator/);
    expect(r.warnings.join("\n")).toMatch(/Couldn't parse 'since:yesterday'/);
  });
});
