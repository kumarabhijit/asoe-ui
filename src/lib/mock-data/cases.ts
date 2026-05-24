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
// `tests/architectural/case_pivot_mock_wiring.test.ts` locks the
// invariants this file's wiring encodes.

import type { ExceptionSummary } from "@/types/exceptions";
import type {
  CaseStatus,
  CaseType,
  EmailClassification,
  OrderCase,
} from "@/types/cases";

import { MOCK_EXCEPTIONS } from "./exceptions";


/**
 * Derive an OrderCase for a given mock exception. The asoe2 backend's
 * S15a invariant materialises a case for every record; the mock layer
 * mirrors that here so `/cases/[id]?record=<id>` resolves to a real
 * case for every exception the queue can link to.
 *
 * Field derivations:
 *   * `source` / `source_channel` — inferred from `event_type`. Email-
 *     origin events surface as manual_order/email; EDI events as
 *     automated_order/edi_x12_850; everything else as automated_order
 *     with a generic api channel. This is a UI-side default — the
 *     live backend reads this off the case row directly.
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
  const source = isEmail ? "manual_order" : "automated_order";
  const source_channel = isEdi ? "edi_x12_850" : isEmail ? "email" : "api";
  // ADR-041 §1 — case_type is orthogonal to source. EMAIL_ENTRY iff
  // the trigger was an inbound email; BLOCK otherwise.
  const case_type: CaseType = isEmail ? "EMAIL_ENTRY" : "BLOCK";
  // ADR-041 §2 — per-intake classification (1:1 with the email). For
  // mock data the modeller's "default to OTHER, surface real intents
  // when the email-classification node lands" rule applies. The two
  // email-shaped fixtures we have today (EMAIL_ORDER_ENTRY_REQUEST,
  // ORDER_RECEIVED) both map to NEW_ORDER under the recipe registry,
  // so we surface that explicitly.
  const email_classification: EmailClassification | null = isEmail
    ? exc.event_type?.includes("CHANGE")
      ? "ORDER_CHANGE"
      : exc.event_type?.includes("INQUIRY")
        ? "INQUIRY"
        : exc.event_type?.includes("COMPLAINT")
          ? "COMPLAINT"
          : exc.event_type?.includes("GENERAL") || exc.event_type?.includes("OTHER")
            ? "OTHER"
            : "NEW_ORDER"
    : null;
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
    source,
    source_channel,
    case_type,
    email_classification,
    customer_po_number: exc.order_id ?? null,
    sales_order_id: source === "automated_order" ? exc.order_id ?? null : null,
    edi_transaction_id: null,
    source_email_id: isEmail ? `msg-${exc.id}` : null,
    opened_at: exc.created_at,
    closed_at: isClosed ? exc.updated_at : null,
    status,
    sla_deadline: sla,
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
    // The lead record seeds the case shape (source, source_channel,
    // case_type, customer_po_number, etc.). Sibling records carry the
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
