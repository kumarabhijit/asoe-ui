/**
 * casesApi.list case_type filter — the Customer Inbox EMAIL_ENTRY lens
 * (ADR-042). Mirrors the backend filter added in asoe2 (GET /cases?case_type=).
 * Mock-mode behaviour; the real-API path forwards the query param.
 */

import { describe, it, expect } from "vitest";

import { casesApi } from "@/lib/api";

describe("casesApi.list case_type filter (EMAIL_ENTRY lens)", () => {
  it("EMAIL_ENTRY returns only EMAIL_ENTRY cases", async () => {
    const res = await casesApi.list({ case_type: "EMAIL_ENTRY", limit: 500 });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((c) => c.case_type === "EMAIL_ENTRY")).toBe(true);
  });

  it("BLOCK returns only BLOCK cases", async () => {
    const res = await casesApi.list({ case_type: "BLOCK", limit: 500 });
    expect(res.items.every((c) => c.case_type === "BLOCK")).toBe(true);
  });

  it("the two case_types partition the unfiltered list", async () => {
    const [all, email, block] = await Promise.all([
      casesApi.list({ limit: 500 }),
      casesApi.list({ case_type: "EMAIL_ENTRY", limit: 500 }),
      casesApi.list({ case_type: "BLOCK", limit: 500 }),
    ]);
    expect(email.total + block.total).toBe(all.total);
  });
});
