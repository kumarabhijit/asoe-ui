// BehaviourScenario — the single shape that the scenario library, the
// mock stubs, and the parameterised tests all read from.
//
// One scenario per row in the test matrix. S1 ships three; S12 fills to
// twelve (one per curated intent). The shape is intentionally wider than
// what S1 consumes because S4..S11 widen the coverage and need stable
// fields to attach to.
//
// Reviewer panel — encoded directly on the type:
//   * Domain SME — `customer_visible_urgency`, scenario ids of the form
//     `<INTENT>__<operator_situation>`.
//   * SRE        — `slo_category` so the matrix can be filtered for p99
//                  blockers vs nightly background.
//   * Karpathy   — `learning_signals` so anchors-derived scenarios can
//                  declare their provenance.
//   * MAS / Boris — `tool_call_sequence`, `tier` for the case-agent
//                   tool-surface contract (ADR-038 §6 / §7).
import type {
  EmailSourceData,
  ExceptionDetail,
  ExceptionSummary,
} from "@/types/exceptions";
import type { CaseListItem } from "@/lib/api";
import type { WSEvent } from "@/types/websocket";

export type SloCategory = "p99_blocker" | "p95_blocker" | "background";

export type CustomerUrgency = "real_time" | "same_business_day" | "batch";

export interface ScenarioAllowedAction {
  allowed: boolean;
  reason_tag?: string;
}

export interface ScenarioOverrideAction extends ScenarioAllowedAction {
  reason_tags?: readonly string[];
}

export interface ScenarioActions {
  approve: ScenarioAllowedAction;
  reject: ScenarioAllowedAction;
  override: ScenarioOverrideAction;
  escalate: ScenarioAllowedAction;
  reanalyze: ScenarioAllowedAction;
  cosign: ScenarioAllowedAction;
}

export interface ScenarioLearningSignals {
  earned_from_anchor_example?: string;
  l2_shadow_disagreed?: boolean;
  operator_override_confirmed_by_buyer?: boolean;
}

export interface BehaviourScenario {
  id: string;
  slo_category: SloCategory;
  customer_visible_urgency: CustomerUrgency;
  intent: string;
  case: CaseListItem;
  records: readonly ExceptionSummary[];
  detail: ExceptionDetail;
  email_source?: EmailSourceData;
  allowed_actions: ScenarioActions;
  expected_ws_events: readonly WSEvent[];
  learning_signals?: ScenarioLearningSignals;
  tool_call_sequence?: readonly string[];
  tier?: 1 | 2 | 3;
}
