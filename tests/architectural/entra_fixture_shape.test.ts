/**
 * PARITY-3a follow-up — entra Playwright fixture contract.
 *
 * The fixture in tests/browser/_entra-fixture.ts mints a NextAuth
 * session-token cookie that the dev server decodes into the same
 * session shape src/lib/auth.ts produces for an azure-ad sign-in.
 * The TWO shapes must agree on:
 *
 *   * `authMode === "entra"` — the assertion specs use to verify
 *     the entra path ran end-to-end.
 *   * `accessToken` present — src/lib/api.ts attaches it as
 *     Authorization: Bearer; without it every authenticated request
 *     goes unauthenticated.
 *   * `roles` array — the middleware's no-role-for-tenant branch is
 *     reachable by passing an empty array.
 *
 * This source-level lock catches drift between the cookie shape and
 * the prod-time session callback shape without spinning up a
 * browser.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const FIXTURE = readFileSync(
  path.resolve(__dirname, "../browser/_entra-fixture.ts"), "utf-8",
);

const AUTH = readFileSync(
  path.resolve(__dirname, "../../src/lib/auth.ts"), "utf-8",
);

describe("entra fixture: shape parity with src/lib/auth.ts", () => {
  it("mints authMode='entra' so specs can assert the right branch ran", () => {
    expect(FIXTURE).toContain('authMode: "entra"');
  });

  it("stashes an accessToken so src/lib/api.ts can attach the bearer", () => {
    // The azure-ad branch stashes the id_token as accessToken; the
    // fixture must mirror that field name so the api client picks
    // it up unchanged.
    expect(FIXTURE).toContain("accessToken:");
    expect(AUTH).toContain("token.accessToken = a.id_token");
  });

  it("uses the canonical NextAuth session-token cookie name", () => {
    // Without https the cookie name is bare next-auth.session-token;
    // production (https) would prepend __Secure- but the Playwright
    // base URL is http://localhost:3100.
    expect(FIXTURE).toContain('next-auth.session-token');
  });

  it("declares a configurable roles array (default ['analyst'])", () => {
    // The middleware branches on token.roles; tests must be able to
    // pass an empty array to exercise the /403 branch.
    expect(FIXTURE).toMatch(/roles\?:\s*string\[\]/);
    expect(FIXTURE).toContain('roles: options.roles ?? ["analyst"]');
  });

  it("documents why we don't spin up a stub Microsoft OAuth server", () => {
    // The rationale matters — a future contributor might be tempted
    // to swap the cookie-injection path for a full OAuth stub.
    expect(FIXTURE).toMatch(/server-side/i);
    expect(FIXTURE).toMatch(/page\.route/i);
  });
});
