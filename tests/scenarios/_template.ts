// Factory for S12's nine fill-in scenarios. Keeps the per-intent
// files thin (intent + curated vocab + minimal customisations) so
// adding a new intent or amending a curated vocab is a one-line
// touch per file. Each generated scenario is in PENDING_REVIEW
// lifecycle — the most common operator-actionable shape, and the
// one the action matrix covers densely.
import type { BehaviourScenario, ScenarioActions } from "./_types";
import type { Origin } from "@/types/cases";

interface TemplateInput {
  /** "<INTENT>__<operator_situation>" — used as scenario.id. */
  id: string;
  intent: string;
  curatedVocab: readonly string[];
  caseOrigin?: Origin;
  caseChannel?: string;
  customerPo?: string;
  recipeName?: string;
  recordEventType?: string;
  recordOrderId?: string;
  accountId?: string;
  accountName?: string;
}

/**
 * Builds a minimal-but-valid BehaviourScenario in PENDING_REVIEW
 * shape. All HITL actions open, no cosign required. Override
 * reason_tags come straight from the curated vocab so the
 * parameterised tests pass without per-file curation.
 */
export function buildOpenActionableScenario(
  input: TemplateInput,
): BehaviourScenario {
  const intent = input.intent;
  const caseId = `case-${intent.toLowerCase()}-001`;
  const recordId = `exc-${intent.toLowerCase()}-001`;
  const orderId = input.recordOrderId ?? `PO-2026-${intent.slice(0, 4)}-001`;
  const opened = "2026-05-10T09:00:00Z";
  const allowedActions: ScenarioActions = {
    approve:   { allowed: true, reason_tag: "OTHER" },
    reject:    { allowed: true, reason_tag: "OTHER" },
    override:  { allowed: true, reason_tags: input.curatedVocab },
    escalate:  { allowed: true },
    reanalyze: { allowed: true },
    cosign:    { allowed: false },
  };

  return {
    id: input.id,
    slo_category: "p95_blocker",
    customer_visible_urgency: "same_business_day",
    intent,
    case: {
      case_id: caseId,
      tenant_id: "acme-corp",
      origin: input.caseOrigin ?? "API",
      source_channel: input.caseChannel ?? "edi_x12_850",
      supergroup_code:
        input.caseOrigin === "CUSTOMER" ? "SG_NEW_ORDER" : "SG_BLOCK_UNMAPPED",
      customer_po_number: input.customerPo ?? orderId,
      opened_at: opened,
      updated_at: opened,
      status: "OPEN_AWAITING_HUMAN",
      sla_deadline: "2026-05-10T20:00:00Z",
      will_miss_rdd: false,
      tier: 2,
      child_intents: [intent],
      // ADR-041 P3e §3.1 — CaseSummary projection. Scenarios drive
      // the test-suite path; live backend computes these via
      // `build_case_summary`. Null is the legal mock state per the
      // EvidenceBlock Structurally Omitted contract.
      customer_name: null,
      top_line_sku_code: null,
      top_line_sku_title: null,
      problem_one_liner: null,
      intent,
      dollar_impact: null,
      audit_verdict_color: null,
    },
    records: [
      {
        id: recordId,
        tenant_id: "acme-corp",
        order_id: orderId,
        event_type: input.recordEventType ?? `EDI_850_${intent}`,
        intent,
        lifecycle_state: "PENDING_REVIEW",
        shadow_verdict: "YELLOW",
        selected_recipe: input.recipeName,
        final_status: "MANUAL_REVIEW_REQUIRED",
        created_at: opened,
        updated_at: opened,
        account_id: input.accountId ?? "acct-walmart-na",
        account_name: input.accountName ?? "Walmart North America",
        parent_case_id: caseId,
      },
    ],
    detail: {
      id: recordId,
      tenant_id: "acme-corp",
      order_id: orderId,
      event_type: input.recordEventType ?? `EDI_850_${intent}`,
      intent,
      lifecycle_state: "PENDING_REVIEW",
      shadow_verdict: "YELLOW",
      selected_recipe: input.recipeName,
      final_status: "MANUAL_REVIEW_REQUIRED",
      created_at: opened,
      updated_at: opened,
      account_id: input.accountId ?? "acct-walmart-na",
      account_name: input.accountName ?? "Walmart North America",
      parent_case_id: caseId,
      resolution_data: {},
    },
    allowed_actions: allowedActions,
    expected_ws_events: [],
    tier: 2,
  };
}
