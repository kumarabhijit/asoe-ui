/**
 * ADR-027 Phases C/D — architectural lock on pipeline-progress projection.
 *
 * History: the legacy `buildNodeStates` projection in
 * `app/exceptions/shared.tsx` hardcoded confidence=0.92 on classify
 * and generated random duration_ms values via Math.random(). Both
 * violations were closed by retiring that projection — the new
 * EventsTimeline + PipelineDAG consume `executed_nodes` from the
 * trace, so per-node timings + decision payloads come from the
 * backend or are absent.
 *
 * This test asserts the legacy drift surface is permanently retired:
 *   - shared.tsx no longer exports buildNodeStates
 *   - PIPELINE_NODES / STATE_PROGRESS arrays are gone
 *   - WaterfallStepper is no longer mounted from app/exceptions/
 *   - DiagnosticsSection consumes EventsTimeline + PipelineDAG +
 *     useTopology (sourced from the compiled-graph topology endpoint,
 *     not a UI mirror — Guardrail #2 extended to pipeline nodes per
 *     ADR-027 §"Backend changes" #4).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SHARED_PATH = resolve(__dirname, "../../src/app/exceptions/shared.tsx");
const DETAIL_PANEL_PATH = resolve(
  __dirname,
  "../../src/app/exceptions/ExceptionDetailPanel.tsx",
);
const DIAGNOSTICS_PATH = resolve(
  __dirname,
  "../../src/app/exceptions/DiagnosticsSection.tsx",
);

describe("ADR-027 — legacy pipeline-progress projection retired", () => {
  it("shared.tsx no longer exports buildNodeStates", () => {
    const src = readFileSync(SHARED_PATH, "utf-8");
    expect(src).not.toMatch(/export\s+function\s+buildNodeStates/);
  });

  it("shared.tsx no longer defines PIPELINE_NODES or STATE_PROGRESS", () => {
    const src = readFileSync(SHARED_PATH, "utf-8");
    expect(src).not.toMatch(/PIPELINE_NODES\s*[:=]/);
    expect(src).not.toMatch(/STATE_PROGRESS\s*[:=]/);
  });

  it("DiagnosticsSection no longer imports WaterfallStepper", () => {
    const src = readFileSync(DIAGNOSTICS_PATH, "utf-8");
    expect(src).not.toMatch(/from\s+["']@\/components\/ui\/WaterfallStepper["']/);
  });

  it("ExceptionDetailPanel no longer imports buildNodeStates", () => {
    const src = readFileSync(DETAIL_PANEL_PATH, "utf-8");
    expect(src).not.toMatch(/buildNodeStates/);
  });

  it("DiagnosticsSection consumes EventsTimeline + PipelineDAG", () => {
    const src = readFileSync(DIAGNOSTICS_PATH, "utf-8");
    expect(src).toMatch(/EventsTimeline/);
    expect(src).toMatch(/PipelineDAG/);
  });

  it("DiagnosticsSection sources topology from useTopology, not a UI mirror", () => {
    const src = readFileSync(DIAGNOSTICS_PATH, "utf-8");
    expect(src).toMatch(/useTopology/);
  });
});
