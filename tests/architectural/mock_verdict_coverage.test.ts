/**
 * ADR-027 Phase A.0 verdict-coverage lock.
 *
 * Asserts the mock-mode preview seeds at least one trace per
 * conditional-gate terminal verdict, so Vercel previews exercise
 * every branch of the pipeline rather than just the happy path.
 *
 * If a new gate / verdict is added in
 * `asoe2/orchestration/graph.py::_VERDICT_LABELS`, this test starts
 * failing until a matching mock trace lands. Keeps the demo surface
 * honest as the registry grows.
 */
import { describe, it, expect } from "vitest";
import { exceptionsApi } from "@/lib/api";
import type { ExecutedNode, TraceResponse } from "@/types/api";

/** All verdicts the UI must be able to render. The asoe2 registries
 *  expand from terminal/continue route keys into these human labels;
 *  every entry must appear on at least one mock trace's
 *  ExecutedNode.exit_verdict. */
const REQUIRED_VERDICTS = [
  // shadow_audit terminal split + green continue
  "green",
  "yellow",
  "red",
  // every other conditional gate's `terminal` verdict
  "breach",
  "no_recipe",
  "required_gw_fail",
  "invocation_fail",
  // implicit classify-time gate
  "cross_check_disagreement",
  // every conditional gate's `continue` verdict
  "ok",
];

async function collectVerdicts(): Promise<Set<string>> {
  // Walk every mock exception's trace and collect the union of
  // exit_verdicts across every executed_node entry.
  const list = await exceptionsApi.list();
  const verdicts = new Set<string>();
  for (const summary of list.data) {
    let trace: TraceResponse | null = null;
    try {
      trace = await exceptionsApi.trace(summary.id);
    } catch {
      // Some mock entries deliberately have no trace (e.g. INGESTED-only).
      continue;
    }
    for (const n of trace?.executed_nodes ?? []) {
      if (n.exit_verdict) verdicts.add(n.exit_verdict);
    }
  }
  return verdicts;
}

// The mock api delays each call ~400ms; with 25 exceptions a full
// walk takes ~10s. Bump timeout per test rather than globally so the
// rest of the suite stays snappy.
/**
 * Regression lock for the Verdict 2026-04-22 partial-truth invariant on
 * classifier confidence: the value the AgentReasoningCard renders
 * (`OrderAnalysis.confidence / 100`) and the value the Pipeline
 * timeline renders (`trace.executed_nodes[classify].decision.confidence`)
 * must agree, because they describe the same agent decision on the same
 * record. Before this lock the shared `_yellowHitlTrace` /
 * `_greenAutoResolvedTrace` / `_redBlockedTrace` helpers hardcoded
 * a sample confidence (0.86 / 0.91 / 0.94) regardless of the record,
 * so the AgentReasoningCard reading 90% would sit next to a Pipeline
 * timeline reading 86% on the same exception detail page.
 *
 * Failure mode if this regresses: a SOX-relevant detail surface
 * silently displays two disagreeing confidence values for one decision.
 */
describe("Verdict 2026-04-22 — confidence sync", () => {
  it("trace classify-node confidence matches OrderAnalysis.confidence for every mock record", async () => {
    const list = await exceptionsApi.list();
    const mismatches: string[] = [];
    for (const summary of list.data) {
      const [trace, analysis] = await Promise.all([
        exceptionsApi.trace(summary.id).catch(() => null),
        exceptionsApi.orderAnalysis(summary.id).catch(() => null),
      ]);
      if (!trace || !analysis) continue;
      if (typeof analysis.confidence !== "number") continue;
      const classifyNode = trace.executed_nodes?.find(
        (n) => n.node === "classify",
      );
      const traceConfidence = classifyNode?.decision?.confidence;
      if (typeof traceConfidence !== "number") continue;
      // Allow a small float tolerance — analysis.confidence is integer
      // 0-100 and the trace stores 0-1, so the only legal difference
      // is rounding (analysis 90 → trace 0.90 exactly).
      const expected = analysis.confidence / 100;
      if (Math.abs(traceConfidence - expected) > 0.005) {
        mismatches.push(
          `${summary.id}: analysis=${analysis.confidence}% trace=${(traceConfidence * 100).toFixed(1)}%`,
        );
      }
    }
    expect(
      mismatches,
      "Pipeline timeline and AgentReasoningCard disagree on classifier " +
        "confidence for these records — partial-truth state on a SOX-relevant " +
        "surface (Verdict 2026-04-22):\n" + mismatches.join("\n"),
    ).toEqual([]);
  }, 30000);

  it("trace ingest-node order_id matches the exception order_id for every mock record", async () => {
    // Companion lock — the same hardcoded-template bug also leaked
    // example order ids (SO-1042, PO-EDM-SKU-001) into every record's
    // trace ingest step. Lock the per-record alignment.
    const list = await exceptionsApi.list();
    const mismatches: string[] = [];
    for (const summary of list.data) {
      const trace = await exceptionsApi.trace(summary.id).catch(() => null);
      if (!trace) continue;
      const ingestNode = trace.executed_nodes?.find(
        (n) => n.node === "ingest",
      );
      const traceOrderId = ingestNode?.decision?.order_id;
      if (typeof traceOrderId !== "string") continue;
      if (traceOrderId !== summary.order_id) {
        mismatches.push(
          `${summary.id}: summary=${summary.order_id} trace=${traceOrderId}`,
        );
      }
    }
    expect(
      mismatches,
      "Pipeline timeline shows a different order_id than the record's " +
        "summary for these mocks — same partial-truth class as confidence drift:\n" +
        mismatches.join("\n"),
    ).toEqual([]);
  }, 30000);
});

describe("ADR-027 — mock verdict coverage", () => {
  it("every required verdict appears on at least one mock trace", async () => {
    const seen = await collectVerdicts();
    const missing = REQUIRED_VERDICTS.filter((v) => !seen.has(v));
    expect(missing, `missing verdicts in mocks: ${missing.join(", ")}`).toEqual([]);
  }, 30000);

  it("at least one mock trace halts at each conditional gate", async () => {
    const list = await exceptionsApi.list();
    const haltsByNode = new Map<string, ExecutedNode>();
    for (const summary of list.data) {
      let trace: TraceResponse | null = null;
      try {
        trace = await exceptionsApi.trace(summary.id);
      } catch {
        continue;
      }
      for (const n of trace?.executed_nodes ?? []) {
        if (n.status === "halted" || n.status === "errored") {
          if (!haltsByNode.has(n.node)) haltsByNode.set(n.node, n);
        }
      }
    }
    // Each conditional gate that can halt must have at least one mock
    // trace stopping there. build_analysis is on every halt path
    // (Pillar 2 composer) so it's expected to appear too.
    const expectHalts = [
      "classify", // implicit gate (cross_check_disagreement)
      "validate_circuit_breaker",
      "select_recipe",
      "resolve_dependencies",
      "validate_types",
      "shadow_audit",
    ];
    const missing = expectHalts.filter((g) => !haltsByNode.has(g));
    expect(missing, `gates with no halt mock: ${missing.join(", ")}`).toEqual([]);
  }, 30000);
});
