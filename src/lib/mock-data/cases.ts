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
    ? "NEW_ORDER"
    : null;
  const status: CaseStatus = (() => {
    switch (exc.lifecycle_state) {
      case "RESOLVED":
      case "CLOSED":
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
 * Mock cases — one per MOCK_EXCEPTIONS entry, derived deterministically
 * so `casesApi.get(case-for-<excId>)` resolves and `casesApi.getRecords`
 * returns a populated `items` array. Pre-S15a this list held three
 * standalone demo cases with no attached records; that left the case
 * detail surface rendering only the header (Verdict 2026-04-22
 * Guardrail #6 — no "no records" placeholder, so the inline ribbon
 * silently never mounted).
 */
export const MOCK_CASES: OrderCase[] = MOCK_EXCEPTIONS.map(caseFromMockException);
