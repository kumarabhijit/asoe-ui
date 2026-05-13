/**
 * Case-centric types — mirrors asoe2/contracts/models.py per ADR-038 §6.1.
 *
 * Phase H.6 introduces OrderCase as the parent surface the CSR works
 * against. Existing ExceptionRecord stays as the per-event child;
 * ExceptionSummary / ExceptionDetail in src/types/exceptions.ts are
 * unchanged. This file extends the type surface; nothing renames.
 *
 * Per CLAUDE.md Guardrail #3 — types match asoe2's Pydantic
 * field-for-field. When asoe2 adds a field to OrderCase, this file
 * is updated in the same PR (or immediately after).
 */

/**
 * ADR-038 §3.1 — case source (immutable at open).
 *
 * Manual = email/phone/fax (CSR reads prose to extract).
 * Automated = EDI X12 / portal / API feed / FTP / VMI (no prose).
 */
export type CaseSource = "manual_order" | "automated_order";

/**
 * ADR-041 §1 — Why ASOE materialised this case. Orthogonal to
 * `CaseSource` (which describes how the order originated). Mirrors
 * `asoe2/contracts/models.py::CaseType` field-for-field.
 *
 * - `EMAIL_ENTRY` — customer email arrived; case carries an
 *   `email_classification` (1:1 with the intake).
 * - `BLOCK` — SAP order carried a block reason; each child
 *   ExceptionRecord carries the raw `sap_block_code` (1:N).
 */
export type CaseType = "EMAIL_ENTRY" | "BLOCK";

/**
 * ADR-041 §2 — Per-intake classification for an EMAIL_ENTRY case.
 * Mirrors `asoe2/contracts/models.py::EmailClassification`. Set once
 * at case open by the email-classification graph node; never mutates.
 * `null` for any case where `case_type !== "EMAIL_ENTRY"`.
 */
export type EmailClassification =
  | "NEW_ORDER"
  | "ORDER_CHANGE"
  | "INQUIRY"
  | "COMPLAINT"
  | "OTHER";

/** ADR-038 §6.1 — 7-state case lifecycle. Distinct from per-exception
 *  LifecycleState. */
export type CaseStatus =
  | "OPEN_AGENT_PROCESSING"
  | "OPEN_AWAITING_HUMAN"
  | "OPEN_AWAITING_BUYER"
  | "OPEN_AWAITING_ERP"
  | "RESOLVED"
  | "FAILED"
  | "BLOCKED";

/** ADR-038 §7.1 — graduated materialisation tier. */
export type CaseTier = 1 | 2 | 3;

/**
 * The OrderCase entity. Mirrors `asoe2/contracts/models.py::OrderCase`
 * field-for-field. The four correlation keys (customer_po_number,
 * sales_order_id, edi_transaction_id, source_email_id) are how
 * inbound events resolve to a case via lookup-or-create.
 */
export interface OrderCase {
  case_id: string;
  tenant_id: string;
  customer_id?: string | null;

  source: CaseSource;
  source_channel: string;

  /** ADR-041 §1 — why ASOE materialised this case. Always present
   *  on records that exist as cases (backend defaults from `source`
   *  if not provided at lookup_or_create). */
  case_type: CaseType;
  /** ADR-041 §2 — present iff `case_type === "EMAIL_ENTRY"`. */
  email_classification?: EmailClassification | null;

  customer_po_number?: string | null;
  sales_order_id?: string | null;
  edi_transaction_id?: string | null;
  source_email_id?: string | null;

  opened_at: string;
  closed_at?: string | null;
  // Issue #133 PO #17 — canonical "last activity" timestamp, bumped
  // by the CaseStore on every mutation (status flip, pending
  // override write, correlation-key append). Mirrors
  // `OrderCase.updated_at` in `asoe2/contracts/models.py`. Always
  // present from V014 onward; the optional marker covers the V014
  // backfill window for tests that fixture old payloads.
  updated_at?: string | null;
  status: CaseStatus;
  sla_deadline?: string | null;

  tier: CaseTier;

  working_memory_summary?: string | null;
  last_compaction_at?: string | null;
  bundle_version_at_open?: string | null;
}

/**
 * One entry in the per-case event log (ADR-038 §7.3 episodic memory).
 * Phase H.6 reads these via `read_case_events`-like APIs to render
 * the case timeline; Phase H.7 promotes them to a typed CaseEvent
 * table on the backend.
 */
export interface CaseEvent {
  event_id: string;
  case_id: string;
  occurred_at: string;
  /** Free-form short title — e.g. "Email arrived from buyer",
   *  "Agent ran check_credit", "Operator approved override". */
  title: string;
  /** Structured payload. Examples: tool_call + tool_result for
   *  agent-step events; review action for human events; ingest
   *  payload digest for inbound events. */
  payload?: Record<string, unknown>;
}

/**
 * SLA visualisation metadata derived client-side from
 * `OrderCase.sla_deadline`. NOT a backend type — purely UI.
 *
 * The `band` mirrors how the CSR thinks about urgency:
 *   - `breached`     — past deadline; dominant red treatment
 *   - `at_risk`      — <2h to deadline; warning-amber
 *   - `today`        — same calendar day; subtle amber
 *   - `comfortable`  — >24h; default neutral
 *   - `none`         — no deadline set yet (T2 just opened)
 */
export type SlaBand =
  | "breached"
  | "at_risk"
  | "today"
  | "comfortable"
  | "none";

export interface SlaSnapshot {
  band: SlaBand;
  deadline?: string | null;
  /** Negative when breached; positive when comfortable. */
  ms_until_deadline?: number;
  /** Human label, e.g. "Breached 2h ago", "Due in 45m". */
  label: string;
}
