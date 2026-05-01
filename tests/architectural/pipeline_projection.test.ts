/**
 * Architectural lock for Verdict 2026-04-22 / Guardrail #6 in the
 * pipeline-progress projection.
 *
 * History: shared.tsx::buildNodeStates() previously hardcoded
 * `confidence: 0.92` for the classify node and generated random
 * `duration_ms` values via Math.random() on every render. That meant:
 *
 *   * The pipeline progress confidence (always 92%) silently
 *     disagreed with the AgentReasoningCard confidence (real LLM
 *     value, e.g. 80%) — two surfaces of the same fact
 *     contradicting each other on a SOX-relevant page.
 *   * Step timings updated continuously without any retry, because
 *     each render rolled new random durations.
 *
 * Both are partial-truth states the compliance engineer holds veto
 * over. This file pins the corrected behaviour: confidence comes
 * from the analysis payload, durations are NEVER synthesised.
 */

import { describe, it, expect } from "vitest";
import { buildNodeStates } from "../../src/app/exceptions/shared";
import type { ExceptionDetail, OrderAnalysis } from "../../src/types/exceptions";

const baseDetail = {
  id: "exc-test-1",
  tenant_id: "acme-corp",
  order_id: "PO-1",
  event_type: "EDI_850_PRICE_MISMATCH",
  intent: "CONTRACTUAL_CORRECTION",
  lifecycle_state: "PENDING_REVIEW",
  shadow_verdict: "YELLOW",
  selected_recipe: "PriceAdjustmentRecipe.py",
  final_status: "MANUAL_REVIEW_REQUIRED",
  trace_id: "trace-1",
  created_at: "2026-04-29T00:00:00Z",
  updated_at: "2026-04-29T00:00:00Z",
} as unknown as ExceptionDetail;

describe("buildNodeStates: confidence projection", () => {
  it("classify node confidence comes from analysis.confidence (normalised to 0-1), not a hardcoded value", () => {
    const analysis = { confidence: 80 } as unknown as OrderAnalysis;
    const states = buildNodeStates(baseDetail, undefined, analysis);
    const classify = states.find((s) => s.node === "classify")!;
    expect(classify.status).toBe("completed");
    expect((classify.data as Record<string, unknown> | undefined)?.confidence).toBe(0.8);
  });

  it("classify node omits confidence entirely when analysis is missing — never falls back to 0.92", () => {
    const states = buildNodeStates(baseDetail, undefined, null);
    const classify = states.find((s) => s.node === "classify")!;
    const data = classify.data as Record<string, unknown> | undefined;
    expect(data).toBeDefined();
    expect(data!.intent).toBe("CONTRACTUAL_CORRECTION");
    expect(data!.confidence).toBeUndefined();
  });

  it("classify node omits confidence when analysis.confidence is missing", () => {
    const analysis = {} as unknown as OrderAnalysis;
    const states = buildNodeStates(baseDetail, undefined, analysis);
    const classify = states.find((s) => s.node === "classify")!;
    const data = classify.data as Record<string, unknown> | undefined;
    expect(data!.confidence).toBeUndefined();
  });
});

describe("buildNodeStates: never synthesises durations", () => {
  it("completed nodes do not carry a duration_ms field (backend doesn't expose per-node timings yet)", () => {
    const analysis = { confidence: 80 } as unknown as OrderAnalysis;
    const states = buildNodeStates(baseDetail, undefined, analysis);
    const completed = states.filter((s) => s.status === "completed");
    expect(completed.length).toBeGreaterThan(0);
    for (const node of completed) {
      expect(node.duration_ms).toBeUndefined();
    }
  });

  it("two consecutive calls produce identical states (proves no Math.random)", () => {
    const analysis = { confidence: 80 } as unknown as OrderAnalysis;
    const a = buildNodeStates(baseDetail, undefined, analysis);
    const b = buildNodeStates(baseDetail, undefined, analysis);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
