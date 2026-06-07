/**
 * ADR-045 — mock /health carries the display-label authority.
 *
 * The operator-facing label authority is the backend `/health`
 * `display_labels` map (Guardrail #2 — the UI is a pure projector and
 * never hand-authors a label for a taxonomy code). This lock mirrors the
 * asoe2 contract guard (`tests/test_health_display_labels.py`) on the UI
 * mock layer so dev-mode and Vercel-preview operators see the same
 * governed strings the live backend serves — and so the
 * `MANUAL_ORDER_INTAKE` → "Email Order Intake" misnomer can't creep back
 * into the mock.
 *
 * Mock-data-layer change → architectural lock, per asoe-ui/CLAUDE.md
 * "Test strategy".
 */
import { describe, it, expect } from "vitest";

import { healthApi } from "@/lib/api";

describe("mock /health display labels", () => {
  it("exposes display_labels with supergroup + intent maps", async () => {
    const health = await healthApi.get();
    expect(health.display_labels).toBeDefined();
    expect(Object.keys(health.display_labels!.supergroups).length).toBeGreaterThan(0);
    expect(Object.keys(health.display_labels!.intents).length).toBeGreaterThan(0);
  });

  it("labels MANUAL_ORDER_INTAKE correctly — never the email misnomer", async () => {
    const health = await healthApi.get();
    const intents = health.display_labels!.intents;
    expect(intents["INT_MANUAL_ORDER_INTAKE"]).toBe("Manual Order Intake");
    expect(Object.values(intents)).not.toContain("Email Order Intake");
  });

  it("labels SG_NEW_ORDER as 'New Order'", async () => {
    const health = await healthApi.get();
    expect(health.display_labels!.supergroups["SG_NEW_ORDER"]).toBe("New Order");
  });

  it("exposes intents_by_supergroup for the qualifier rule", async () => {
    const health = await healthApi.get();
    const fanout = health.intents_by_supergroup!;
    // SG_NEW_ORDER is a 1:1 bucket — summary shows just "New Order".
    expect(fanout["SG_NEW_ORDER"]).toEqual(["INT_MANUAL_ORDER_INTAKE"]);
    // A block bucket fans out — the intent qualifier must show.
    expect(fanout["SG_BLOCK_AVAILABILITY"].length).toBeGreaterThan(1);
  });
});
