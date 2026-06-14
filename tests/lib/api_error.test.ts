/**
 * Phase 2 — structured ApiError contract.
 *
 * The api client now throws `ApiError` (code + HTTP status + detail)
 * instead of a bare `Error("<CODE>: <message>")`, so consumers can
 * branch on a stable code/status. These tests lock the shape and the
 * backward-compatible `.message` format, plus the mock-mode 404 path
 * that drives ExceptionDetailPanel's not_found UX.
 */
import { describe, it, expect } from "vitest";

import { ApiError, isApiError, exceptionsApi } from "@/lib/api";

describe("ApiError", () => {
  it("carries code, status, and detail", () => {
    const err = new ApiError("NOT_FOUND", "Exception not found", 404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.status).toBe(404);
    expect(err.detail).toBe("Exception not found");
  });

  it("is an Error with the legacy '<CODE>: <message>' message", () => {
    const err = new ApiError("LIFECYCLE_LOCKED", "record is terminal", 409);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    // Backward compat: existing `err.message` consumers keep working.
    expect(err.message).toBe("LIFECYCLE_LOCKED: record is terminal");
  });

  it("isApiError narrows correctly", () => {
    expect(isApiError(new ApiError("X", "y", 400))).toBe(true);
    expect(isApiError(new Error("plain"))).toBe(false);
    expect(isApiError("nope")).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});

describe("exceptionsApi.get (mock mode) — not found", () => {
  it("rejects with a structured 404 ApiError for an unknown id", async () => {
    await expect(exceptionsApi.get("exc-does-not-exist")).rejects.toMatchObject({
      name: "ApiError",
      code: "NOT_FOUND",
      status: 404,
    });
  });
});
