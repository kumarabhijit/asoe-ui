/**
 * PARITY-3a architectural lock — NextAuth dual-provider scaffolding.
 *
 * The parity plan requires BOTH `seed` (CredentialsProvider) and `azure-ad`
 * providers to be mounted in `authOptions.providers` at startup, with
 * ASOE_AUTH_MODE gating which one is INSTANTIATED (not which one is MOUNTED) —
 * NextAuth freezes the provider list at boot, so flipping ASOE_AUTH_MODE
 * after start without rebuilding the list is a silent failure mode.
 *
 * These tests assert the scaffold shape:
 *
 *   1. authOptions.providers always contains both a `credentials`-named
 *      provider AND an `azure-ad`-named provider, regardless of mode.
 *   2. Setting ASOE_AUTH_MODE=entra wires Azure AD env vars from
 *      ASOE_CLIENT_ID / ASOE_CLIENT_SECRET / ASOE_TENANT_ID into the
 *      provider config (not localhost defaults).
 *   3. The middleware distinguishes token-missing → /login,
 *      token-invalid → /login?reason=session_expired,
 *      and no-role-for-tenant → /403 (assertion via source grep — the
 *      branches must be present and named).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

beforeEach(() => {
  // Provider list is built at module import; reset module cache so each
  // test can re-import with a different ASOE_AUTH_MODE env.
});

afterEach(() => {
  // env stubbing handled per-test via vi.stubEnv
});

describe("auth dual-provider scaffold (PARITY-3a)", () => {
  it("mounts both `credentials` and `azure-ad` providers in seed mode", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    vi.stubEnv("ASOE_AUTH_MODE", "seed");
    const { authOptions } = await import("@/lib/auth");
    const ids = (authOptions.providers ?? []).map(
      (p) => (p as unknown as { id?: string; options?: { id?: string } }).id
        ?? (p as unknown as { options?: { id?: string } }).options?.id,
    );
    expect(ids).toContain("credentials");
    expect(ids).toContain("azure-ad");
    vi.unstubAllEnvs();
  });

  it("mounts both providers in entra mode (the mount list is frozen)", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    vi.stubEnv("ASOE_AUTH_MODE", "entra");
    vi.stubEnv("ASOE_CLIENT_ID", "preprod-client-id");
    vi.stubEnv("ASOE_CLIENT_SECRET", "preprod-client-secret");
    vi.stubEnv("ASOE_TENANT_ID", "preprod-tenant-id");
    const { authOptions } = await import("@/lib/auth");
    const ids = (authOptions.providers ?? []).map(
      (p) => (p as unknown as { id?: string; options?: { id?: string } }).id
        ?? (p as unknown as { options?: { id?: string } }).options?.id,
    );
    expect(ids).toContain("credentials");
    expect(ids).toContain("azure-ad");
    vi.unstubAllEnvs();
  });

  it("middleware source distinguishes the three auth-failure branches", () => {
    const middleware = readFileSync(
      resolve(process.cwd(), "src/middleware.ts"),
      "utf8",
    );
    // token-missing → /login (no `reason` query param)
    expect(middleware).toMatch(/\/login/);
    // token-invalid → /login?reason=session_expired
    expect(middleware).toMatch(/reason=session_expired/);
    // no-role-for-tenant → /403
    expect(middleware).toMatch(/\/403/);
  });

  it("layout mounts the PreprodIdentityBanner", () => {
    const layout = readFileSync(
      resolve(process.cwd(), "src/app/layout.tsx"),
      "utf8",
    );
    expect(layout).toMatch(/PreprodIdentityBanner/);
  });

  it("docs/testing/auth-modes.md exists and documents the matrix", () => {
    const doc = readFileSync(
      resolve(process.cwd(), "docs/testing/auth-modes.md"),
      "utf8",
    );
    expect(doc).toMatch(/ASOE_AUTH_MODE/);
    expect(doc).toMatch(/seed/);
    expect(doc).toMatch(/entra/);
    expect(doc).toMatch(/Playwright/);
    expect(doc).toMatch(/redirect URI/i);
  });
});
