import { describe, it, expect } from "vitest";

import { autonomyLevelLabel, autonomyLevelsByRank } from "@/lib/cases";
import type { HealthResponse } from "@/types/exceptions";

// ADR-042 §5/§8 — the v2 (prototype-ordering) vocabulary the backend serves:
// L1 most autonomous (highest rank) … L4 human (lowest).
const health = {
  allowed_autonomy_levels: [
    { level: "L4", label: "Escalate to human", rank: 0 },
    { level: "L1", label: "Auto — no human review", rank: 3 },
    { level: "L2", label: "Execute & notify", rank: 2 },
    { level: "L3", label: "Prepare & await approval", rank: 1 },
  ],
} as Pick<HealthResponse, "allowed_autonomy_levels">;

describe("autonomyLevelsByRank", () => {
  it("orders most-autonomous first, driven by health rank (Guardrail #1)", () => {
    expect(autonomyLevelsByRank(health).map((l) => l.level)).toEqual([
      "L1",
      "L2",
      "L3",
      "L4",
    ]);
  });

  it("returns [] when health carries no levels (transition window)", () => {
    expect(autonomyLevelsByRank(null)).toEqual([]);
    expect(autonomyLevelsByRank({})).toEqual([]);
  });
});

describe("autonomyLevelLabel", () => {
  it("sources the label from health when present", () => {
    expect(autonomyLevelLabel("L1", health)).toBe("L1 — Auto — no human review");
  });

  it("falls back to the transition map when health is absent", () => {
    expect(autonomyLevelLabel("L1")).toContain("L1 — ");
  });

  it("handles empty and unknown levels", () => {
    expect(autonomyLevelLabel(null)).toBe("Unknown autonomy");
    expect(autonomyLevelLabel("L9", health)).toBe("L9");
  });
});
