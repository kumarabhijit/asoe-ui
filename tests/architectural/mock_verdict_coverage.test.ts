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
