/**
 * casesApi.list origin + supergroup_code filters — replaces the
 * retired `case_type` axis with the orthogonal Origin /
 * Intent Super-Group pair (requirements §3/§6). Mock-mode
 * behaviour; the real-API path forwards the query params.
 */

import { describe, it, expect } from "vitest";

import { casesApi } from "@/lib/api";

describe("casesApi.list origin filter (Customer Inbox lens)", () => {
  it("origin=CUSTOMER returns only CUSTOMER-origin cases", async () => {
    const res = await casesApi.list({ origin: "CUSTOMER", limit: 500 });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((c) => c.origin === "CUSTOMER")).toBe(true);
  });

  it("origin=API returns only API-origin cases", async () => {
    const res = await casesApi.list({ origin: "API", limit: 500 });
    expect(res.items.every((c) => c.origin === "API")).toBe(true);
  });

  it("the two origins partition the unfiltered list", async () => {
    const [all, customer, api] = await Promise.all([
      casesApi.list({ limit: 500 }),
      casesApi.list({ origin: "CUSTOMER", limit: 500 }),
      casesApi.list({ origin: "API", limit: 500 }),
    ]);
    expect(customer.total + api.total).toBe(all.total);
  });
});


describe("casesApi.list supergroup_code filter", () => {
  it("supergroup_code=SG_BLOCK_PRICING returns only that supergroup", async () => {
    const res = await casesApi.list({
      supergroup_code: "SG_BLOCK_PRICING",
      limit: 500,
    });
    // Mock dataset may have zero rows in a given supergroup; the
    // important invariant is that no false positives leak through.
    expect(
      res.items.every((c) => c.supergroup_code === "SG_BLOCK_PRICING"),
    ).toBe(true);
  });
});
