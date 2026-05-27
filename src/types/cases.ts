/**
 * Case-centric types — mirrors asoe2/contracts/models.py per ADR-038 §6.1.
 *
 * Post Case & Intent Super-Group pivot: the legacy EMAIL/API axis
 * (source + case_type + email_classification) has been replaced by
 * the orthogonal pair `origin` (who initiated the case) +
 * `supergroup_code` (which Intent Super-Group the case classifies
 * under, sourced from `src/generated/taxonomy.ts`). See asoe2's
 * `docs/specs/case-intent-supergroup-requirements.md` for the
 * sign-off doc.
 *
 * Per CLAUDE.md Guardrail #3 — types match asoe2's Pydantic
 * field-for-field. When asoe2 adds a field to OrderCase, this file
 * is updated in the same PR (or immediately after).
 */

/**
 * Requirements §3 glossary — who initiated the case.
 *
 * - `CUSTOMER` drives the Customer Inbox lens (emails, portal forms,
 *   phone/fax intakes — anywhere the operator reads buyer prose to
 *   extract intent).
 * - `API` is the SAP-pushed block path (EDI X12 / portal / VMI /
 *   anything where the order arrived as a structured payload that
 *   carried its own block reason).
 *
 * Replaces the legacy `CaseSource` ("manual_order"/"automated_order")
 * + `CaseType` ("EMAIL_ENTRY"/"BLOCK") + `EmailClassification` axes
 * the Case & Intent Super-Group pivot retired.
 */
export type Origin = "CUSTOMER" | "API";

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

/** ADR-038 §7.1 — graduated materialisation tier. Phase 2 §8.4 SLA
 *  bucketing introduced tier 4 (no-SLA / inert) alongside the original
 *  1/2/3 ladder. */
export type CaseTier = 1 | 2 | 3 | 4;

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

  /** Requirements §3 — who initiated this case. */
  origin: Origin;
  /** Orthogonal transport channel (email | edi_x12_850 | api | …). */
  source_channel: string;

  /** Requirements §6 — the Intent Super-Group this case classifies
   *  under (e.g. `SG_BLOCK_PRICING`). Populated by the classifier;
   *  unmapped intakes land on `SG_NEEDS_TRIAGE` or `SG_BLOCK_UNMAPPED`
   *  (Phase 2 §6 sentinel codes). String at the wire level — the
   *  generated `SupergroupCode` union in `src/generated/taxonomy.ts`
   *  is the canonical type for places that branch on the value. */
  supergroup_code?: string;

  /** Phase 5 — reclassification anchor: when a case is split or
   *  rerouted, the new case points back at the case it superseded.
   *  `null` on freshly-opened cases. */
  predecessor_case_id?: string | null;

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

  /** Phase 2 §8.4 — projected SLA deadline derived from the case's
   *  supergroup + tier. Distinct from `sla_deadline` (which carries
   *  the negotiated/honoured deadline once committed). `null` for
   *  tier-4 inert cases. */
  sla_due_at?: string | null;

  /** Phase 2 §8.4 — true when the agent's projection is that the
   *  case will not meet its Requested Delivery Date. Drives the
   *  `breached` / `at_risk` visual bands; defaults to false on
   *  rows the projector has not stamped yet. */
  will_miss_rdd: boolean;

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
