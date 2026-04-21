/**
 * Smoke test — verifies test infrastructure is working.
 */

import { MOCK_HEALTH, GREEN_EXCEPTION, ANALYST_USER } from "./fixtures";

describe("Test Infrastructure", () => {
  it("fixtures load correctly", () => {
    expect(MOCK_HEALTH.allowed_intents.length).toBeGreaterThanOrEqual(4);
    expect(GREEN_EXCEPTION.shadow_verdict).toBe("GREEN");
    expect(ANALYST_USER.roles).toContain("analyst");
  });

  it("TypeScript types compile", () => {
    const intent: string = GREEN_EXCEPTION.intent!;
    expect(intent).toBe("CONTRACTUAL_CORRECTION");
  });
});
