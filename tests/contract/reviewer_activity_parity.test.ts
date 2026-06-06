/**
 * Deployment parity lock — the Review-Quality console reads the SAME shape in
 * local/Vercel (mock `metricsApi.getReviewerActivity`) and Azure (the live
 * `GET /api/v1/metrics/reviewer-activity`, now a typed `response_model`).
 *
 * The mock payload is asserted assignable to the OpenAPI-generated backend
 * schema, so the mock cannot drift from the live contract — a drift would make
 * the console render differently (or break) on Azure than in preview. This file
 * is type-checked by vitest, so the conformance is enforced at build time.
 */
import { describe, it, expect } from "vitest";
import type { components } from "@/types/generated";
import { metricsApi } from "@/lib/api";

type BackendSnapshot = components["schemas"]["ReviewerActivitySnapshot"];

describe("reviewer-activity mock ↔ backend contract parity", () => {
  it("the mock payload conforms to the generated backend schema", async () => {
    const snap = await metricsApi.getReviewerActivity(); // mock branch in tests
    // Compile-time conformance: a drift in the mock or hand-written type vs the
    // generated backend schema fails to type-check here.
    const asBackend: BackendSnapshot = snap;
    // Runtime spot-checks on the fields the console renders.
    expect(asBackend.scope).toBe("process_local_since_restart");
    expect(typeof asBackend.layer2_open_rate).toBe("number");
    expect(asBackend.by_highlight.shown).toBeDefined();
    expect(asBackend.by_highlight.not_shown).toBeDefined();
    const hist = asBackend.dwell_seconds_histogram ?? [];
    expect(Array.isArray(hist)).toBe(true);
    // The +Inf overflow bucket carries le_seconds = null.
    expect(hist.at(-1)?.le_seconds ?? null).toBeNull();
  });
});
