/**
 * DoR #11 — exceptionsApi.reportReviewerActivity is best-effort telemetry.
 * In mock mode (the test default) it is a no-op that never throws and never
 * calls fetch, so a telemetry failure can never break an operator's decision.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

import { exceptionsApi } from "@/lib/api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("exceptionsApi.reportReviewerActivity", () => {
  it("is a no-op in mock mode (no fetch, no throw)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      exceptionsApi.reportReviewerActivity({ dwell_ms: 1234, layer2_opened: true }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
