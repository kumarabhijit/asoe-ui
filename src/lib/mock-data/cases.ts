// Mock OrderCase fixtures + the helper that derives them from
// MOCK_EXCEPTIONS.
//
// Extracted from `src/lib/api.ts` in ADR-041 P5. Pre-S15a this
// list held three standalone demo cases with no attached records;
// that left the case detail surface rendering only the header.
// Post-S15a (PR #155) every case is derived 1:1 from a mock
// exception, mirroring the asoe2 backend's "materialise every
// record" invariant.
//
// Post Case & Intent Super-Group pivot (Phase 2 §6) the case
// shape uses the orthogonal `origin` + `supergroup_code` axes
// instead of the retired `source` / `case_type` /
// `email_classification` triple.
//
// `tests/architectural/case_pivot_mock_wiring.test.ts` locks the
// invariants this file's wiring encodes.

import type { ExceptionSummary } from "@/types/exceptions";
import type {
  CaseStatus,
  Origin,
  OrderCase,
} from "@/types/cases";
import { SG_BLOCK_UNMAPPED, SG_NEEDS_TRIAGE } from "@/generated/taxonomy";

import { MOCK_EXCEPTIONS } from "./exceptions";


// Coarse intent→supergroup projection for the mock layer. The live
// classifier resolves this against `INTENTS_BY_SUPERGROUP`; the
// mock keeps a small switch so the fixture surface mirrors the
// live shape without pulling in the full taxonomy.
//
// CUSTOMER-origin cases project off `event_type` first because the
// seed exception fixtures reuse `intent: MANUAL_ORDER_INTAKE` for
// every email shape (entry / change / inquiry / complaint /
// general) — projecting off intent alone collapses the whole
// Customer Inbox to SG_NEW_ORDER, which hides the supergroup
// variety the classification-history strip is meant to show.
function supergroupFor(exc: ExceptionSummary, origin: Origin): string {
  if (origin === "CUSTOMER") {
    const et = exc.event_type ?? "";
    if (et === "EMAIL_ORDER_CHANGE_REQUEST") return "SG_ORDER_CHANGE";
    if (et === "EMAIL_INQUIRY") return "SG_ORDER_STATUS_INQUIRY";
    if (et === "EMAIL_COMPLAINT") return "SG_COMPLAINT_SERVICE";
    if (et === "EMAIL_GENERAL") return "SG_DOCUMENTATION";
    if (et === "EMAIL_ORDER_ENTRY_REQUEST") return "SG_NEW_ORDER";
    // ORDER_RECEIVED falls through to the intent switch — these
    // are full-text-arrived orders that may carry pricing /
    // logistics / availability concerns regardless of channel.
  }
  const intent = exc.intent ?? "";
  switch (intent) {
    case "CREDIT_BLOCK":
      return "SG_BLOCK_CREDIT";
    case "PRICE_MISMATCH":
    case "MASS_PRICING_ERROR":
    case "PRICE_HOLD_RELEASE":
    case "CONTRACTUAL_CORRECTION":
      return "SG_BLOCK_PRICING";
    case "DUPLICATE_PO":
    case "EDI_MISMATCH":
      return "SG_BLOCK_ORDER_INTEGRITY";
    case "BACK_ORDER":
    case "MIN_ORDER_QTY":
    case "OVER_MAX":
      return "SG_BLOCK_AVAILABILITY";
    case "BROKEN_PALLET":
    case "DELIVERY_DELAY":
    case "PALLET_CONFIG":
      return "SG_BLOCK_LOGISTICS";
    case "MANUAL_ORDER_INTAKE":
      return "SG_NEW_ORDER";
    default:
      return origin === "CUSTOMER" ? SG_NEEDS_TRIAGE : SG_BLOCK_UNMAPPED;
  }
}


/**
 * Derive an OrderCase for a given mock exception. The asoe2 backend's
 * S15a invariant materialises a case for every record; the mock layer
 * mirrors that here so `/cases/[id]?record=<id>` resolves to a real
 * case for every exception the queue can link to.
 *
 * Field derivations:
 *   * `origin` / `source_channel` — inferred from `event_type`. Email-
 *     origin events land on CUSTOMER + channel=email; EDI events on
 *     API + channel=edi_x12_850; everything else on API + api channel.
 *     This is a UI-side default — the live backend reads `origin` off
 *     the case row directly.
 *   * `supergroup_code` — projected from the record's intent via the
 *     `supergroupFor` switch above; unmapped intents land on the
 *     reserved sentinels (`SG_NEEDS_TRIAGE` for CUSTOMER,
 *     `SG_BLOCK_UNMAPPED` for API).
 *   * `customer_po_number` / `sales_order_id` — the exception's
 *     `order_id` is the operator-visible PO; we mirror it into both
 *     slots so the slim context strip + case-list rows both render.
 *   * `status` — projected from the exception's `lifecycle_state`.
 *     The case status enum is a 7-state pivot of the per-record
 *     lifecycle; mapping below is deterministic.
 *   * `opened_at` / `sla_deadline` — opened mirrors the exception's
 *     `created_at`; SLA is +24h, matching the asoe2 sandbox default.
 */
export function caseFromMockException(exc: ExceptionSummary): OrderCase {
  const isEmail =
    exc.event_type?.startsWith("EMAIL_") || exc.event_type === "ORDER_RECEIVED";
  const isEdi = exc.event_type?.startsWith("EDI_");
  const origin: Origin = isEmail ? "CUSTOMER" : "API";
  const source_channel = isEdi ? "edi_x12_850" : isEmail ? "email" : "api";
  const supergroup_code = supergroupFor(exc, origin);
  const status: CaseStatus = (() => {
    switch (exc.lifecycle_state) {
      case "RESOLVED":
      case "CLOSED":
      case "REJECTED":
        // REJECTED is a settled child — a NO_ACTION disposition is a
        // completed human decision (resolved_by stamped, audited as
        // EXCEPTION_RESOLVED). Terminal-closed for the case roll-up,
        // so it must not hold an otherwise-resolved case open.
        return "RESOLVED";
      case "BLOCKED":
        return "BLOCKED";
      case "FAILED":
        return "FAILED";
      default:
        // PENDING_REVIEW / ESCALATED / PENDING_COSIGN all mean a human
        // owes a decision — projected to OPEN_AWAITING_HUMAN.
        return "OPEN_AWAITING_HUMAN";
    }
  })();
  const opened = new Date(exc.created_at);
  const sla = new Date(opened.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const isClosed = status === "RESOLVED" || status === "BLOCKED";
  return {
    case_id: `case-for-${exc.id}`,
    tenant_id: exc.tenant_id,
    customer_id: exc.account_id ?? null,
    origin,
    source_channel,
    supergroup_code,
    predecessor_case_id: null,
    customer_po_number: exc.order_id ?? null,
    sales_order_id: origin === "API" ? exc.order_id ?? null : null,
    edi_transaction_id: null,
    source_email_id: isEmail ? `msg-${exc.id}` : null,
    opened_at: exc.created_at,
    closed_at: isClosed ? exc.updated_at : null,
    status,
    sla_deadline: sla,
    sla_due_at: sla,
    will_miss_rdd: false,
    tier: 2,
    working_memory_summary: null,
    last_compaction_at: null,
    bundle_version_at_open: null,
  };
}

/**
 * Aggregate per-record `CaseStatus` values into a single case-level
 * status. The case detail surface treats the case as still active if
 * ANY attached record is still awaiting a human; only when every
 * record has reached a terminal state does the case close. Order:
 *   OPEN_AWAITING_HUMAN  >  BLOCKED  >  FAILED  >  RESOLVED
 *
 * Multi-record cases (e.g. one PO with a price hold + a back-order +
 * a duplicate retry) thus stay OPEN_AWAITING_HUMAN until every
 * sibling record is dispositioned, matching the asoe2 backend's
 * case-state aggregation pattern.
 */
const CASE_STATUS_PRIORITY: Record<CaseStatus, number> = {
  OPEN_AGENT_PROCESSING: 5,
  OPEN_AWAITING_BUYER: 4,
  OPEN_AWAITING_ERP: 4,
  OPEN_AWAITING_HUMAN: 3,
  BLOCKED: 2,
  FAILED: 1,
  RESOLVED: 0,
};

function aggregateCaseStatus(records: readonly ExceptionSummary[]): CaseStatus {
  let dominant: CaseStatus = "RESOLVED";
  for (const r of records) {
    const s = caseFromMockException(r).status;
    if (CASE_STATUS_PRIORITY[s] > CASE_STATUS_PRIORITY[dominant]) {
      dominant = s;
    }
  }
  return dominant;
}

/**
 * Mock cases — one per distinct `parent_case_id` across MOCK_EXCEPTIONS.
 * Pre-multi-issue this list was a 1:1 map (`MOCK_EXCEPTIONS.map(...)`);
 * post-multi-issue we group by `parent_case_id` so a single PO with
 * several coincident exception records collapses onto ONE OrderCase
 * with N attached records. `casesApi.getRecords(case_id).items` then
 * returns all sibling records, which the RecordListPane renders as a
 * picker.
 *
 * Pre-S15a this list held three standalone demo cases with no attached
 * records; that left the case detail surface rendering only the header
 * (Verdict 2026-04-22 Guardrail #6 — no "no records" placeholder, so
 * the inline ribbon silently never mounted).
 */
/**
 * Re-derive `OrderCase[]` from the live `MOCK_EXCEPTIONS` array.
 *
 * Called on every `casesApi.list` / `casesApi.get` in mock mode so
 * the queue + case header reflect mutations made by mock action
 * paths (`disposition` / `escalate` / `cosign`). Pre-2026-05-21
 * this lived in an IIFE evaluated once at module load, which left
 * the case projection frozen at the seed state — the operator
 * clicked Approve, the underlying row's lifecycle moved to
 * RESOLVED, but the queue still read `MOCK_CASES` (snapshotted at
 * boot) and rendered "Awaiting review" forever.
 *
 * Cost is O(records) = O(33) for the seed fixture; the work is
 * trivial compared to the artificial `MOCK_DELAY` callers already
 * wait on.
 */
export function deriveMockCases(): OrderCase[] {
  const byCaseId = new Map<string, ExceptionSummary[]>();
  for (const exc of MOCK_EXCEPTIONS) {
    const cid = exc.parent_case_id;
    if (!cid) continue;
    const bucket = byCaseId.get(cid);
    if (bucket) bucket.push(exc);
    else byCaseId.set(cid, [exc]);
  }
  return Array.from(byCaseId.entries()).map(([caseId, records]) => {
    // The lead record seeds the case shape (origin, source_channel,
    // supergroup_code, customer_po_number, etc.). Sibling records carry the
    // same PO + tenant by construction; the only field that needs
    // cross-record aggregation is `status` (and the derived
    // `closed_at`). The case_id comes from the grouping key
    // (`parent_case_id`) rather than `caseFromMockException`'s
    // default `case-for-<lead-id>` so multi-record cases land on
    // their declared shared id (e.g. `case-multi-WMT-Q1RESET`).
    const lead = records[0];
    const base = caseFromMockException(lead);
    const status = aggregateCaseStatus(records);
    const isClosed = status === "RESOLVED" || status === "BLOCKED";
    return {
      ...base,
      case_id: caseId,
      status,
      closed_at: isClosed ? base.closed_at : null,
    };
  });
}

/**
 * Backwards-compatibility re-export. Existing call sites read
 * `MOCK_CASES` as an immutable boot-time snapshot — they get the
 * seed-state cases. Mock action paths must NOT consume this; they
 * call `deriveMockCases()` directly.
 */
export const MOCK_CASES: OrderCase[] = deriveMockCases();


/* ── CaseSummary mock projection (ADR-041 P3e §3.1) ────────────────
 *
 * Production fills these seven fields from the asoe2
 * `build_case_summary` graph node + `api/case_summary.py` projection.
 * Mock mode has to invent plausible values per intent so the V2
 * row + audit rail + count chip surfaces actually demo against
 * realistic-looking data when `NEXT_PUBLIC_CASES_ROW_V2=1` is set.
 *
 * `INTENT_SUMMARY_TEMPLATES` is the canonical source of mock
 * projection per intent. `deriveMockCaseSummaries()` joins it
 * against `MOCK_EXCEPTIONS` so every grouped case carries:
 *
 *   * customer_name        — from the lead record's `account_name`
 *   * intent               — from the primary child
 *   * audit_verdict_color  — severity-wins rollup of child verdicts
 *   * dollar_impact        — per-intent fixed value (USD cents)
 *   * top_line_sku_code/title + problem_one_liner — per-intent
 *     fixed strings (in production the recipe templates fill these;
 *     here we inline plausible mock data so preview environments
 *     showcase the row anatomy)
 *
 * Intents without a template entry ship null for the per-intent
 * fields — matches the backend's grandfather-clause behaviour for
 * recipe-gap intents (PRICE_HOLD, EMAIL_COMPLAINT-intake).
 */

interface MockSummaryTemplate {
  sku_code: string | null;
  sku_title: string | null;
  one_liner: string | null;
  /** Dollar amount in cents. Null when the intent has no honest
   *  single-number impact (EDI_MISMATCH, PALLET, EMAIL_COMPLAINT
   *  intake — matches the Recipe SME panel's hide-the-column list). */
  impact_cents: number | null;
}

const INTENT_SUMMARY_TEMPLATES: Record<string, MockSummaryTemplate> = {
  CONTRACTUAL_CORRECTION: {
    sku_code: "BEV-COLA-12PK",
    sku_title: "Cola 12-pack",
    one_liner: "Contract price $9.80 vs PO $10.50 — 6.7% variance",
    impact_cents: 85000,
  },
  DUPLICATE_PO: {
    sku_code: null,
    sku_title: null,
    one_liner: "Duplicate of PO-2025-1042 (3d apart, 92% match)",
    impact_cents: 414720,
  },
  CREDIT_BLOCK: {
    sku_code: null,
    sku_title: null,
    one_liner: "Credit limit breached: $48,200 exposure over $40,000 limit",
    impact_cents: 4820000,
  },
  MASS_PRICING_ERROR: {
    sku_code: "BEV-COLA-12PK",
    sku_title: "Cola 12-pack",
    one_liner: "Bulk price drift across 12 lines (avg 8.2% variance)",
    impact_cents: 1240000,
  },
  PRICE_DISCREPANCY: {
    sku_code: "SNK-CHIPS-FAM",
    sku_title: "Family-size chips (24ct)",
    one_liner: "ERP $14.20 vs PO $12.80 — 9.9% delta, $2,840 at risk",
    impact_cents: 284000,
  },
  BACK_ORDER: {
    sku_code: "BEV-COLA-12PK",
    sku_title: "Cola 12-pack",
    one_liner: "Short stock: 380/480 12pk (20.8% gap, ATP 2026-06-04)",
    impact_cents: 195000,
  },
  OVER_MAX: {
    sku_code: "BEV-COLA-12PK",
    sku_title: "Cola 12-pack",
    one_liner: "Over max by 240 cases (8.3% over allocation)",
    impact_cents: 408000,
  },
  MOQ_UPLIFT: {
    sku_code: "BEV-COLA-12PK",
    sku_title: "Cola 12-pack",
    one_liner: "Below MOQ by 36 cases (ordered 64 vs 100 required)",
    impact_cents: 61200,
  },
  EMAIL_COMPLAINT: {
    sku_code: "BEV-COLA-12PK",
    sku_title: "Cola 12-pack",
    one_liner: "Short shipment: received 380 of 480",
    impact_cents: 414720,
  },
  MANUAL_ORDER_INTAKE: {
    sku_code: null,
    sku_title: null,
    one_liner: "New email order — buyer requested $9.80 contract price",
    impact_cents: 156000,
  },
  // Intents intentionally without templates (grandfather-clause
  // parity with the backend recipe gaps):
  //   PRICE_HOLD       — missing sku + qty on PriceHoldAnalysisData
  //   EDI_MISMATCH     — no honest dollar number
  //   PALLET           — labor/freight, not revenue
};

function verdictRollup(
  records: readonly ExceptionSummary[],
): "R" | "A" | "G" | null {
  let hasR = false;
  let hasA = false;
  let hasG = false;
  for (const r of records) {
    const v = r.shadow_verdict;
    if (v === "RED") hasR = true;
    else if (v === "YELLOW") hasA = true;
    else if (v === "GREEN") hasG = true;
  }
  if (hasR) return "R";
  if (hasA) return "A";
  if (hasG) return "G";
  return null;
}

export interface MockCaseSummary {
  customer_name: string | null;
  top_line_sku_code: string | null;
  top_line_sku_title: string | null;
  problem_one_liner: string | null;
  intent: string | null;
  dollar_impact: { amount_cents: number; currency: string } | null;
  audit_verdict_color: "R" | "A" | "G" | null;
}

/**
 * Project every grouped case onto its CaseSummary mock fields.
 * Returns a Map keyed on case_id so the api.ts list serialiser can
 * splice the result into each `CaseListItem` row.
 *
 * Production fills these via the backend's `compute_case_summary`;
 * the live API path in `casesApi.list` skips this function entirely.
 */
export function deriveMockCaseSummaries(): Map<string, MockCaseSummary> {
  const byCaseId = new Map<string, ExceptionSummary[]>();
  for (const exc of MOCK_EXCEPTIONS) {
    const cid = exc.parent_case_id;
    if (!cid) continue;
    const bucket = byCaseId.get(cid);
    if (bucket) bucket.push(exc);
    else byCaseId.set(cid, [exc]);
  }
  const out = new Map<string, MockCaseSummary>();
  for (const [caseId, records] of byCaseId.entries()) {
    const lead = records[0];
    const intent = lead.intent ?? null;
    const template = intent ? INTENT_SUMMARY_TEMPLATES[intent] : null;
    const customerName = lead.account_name ?? null;
    out.set(caseId, {
      customer_name: customerName,
      top_line_sku_code: template?.sku_code ?? null,
      top_line_sku_title: template?.sku_title ?? null,
      problem_one_liner: template?.one_liner ?? null,
      intent,
      dollar_impact: template?.impact_cents != null
        ? { amount_cents: template.impact_cents, currency: "USD" }
        : null,
      audit_verdict_color: verdictRollup(records),
    });
  }
  return out;
}
