/**
 * Entra-mode Playwright fixture (PARITY-3a follow-up).
 *
 * Mints a NextAuth JWT session cookie with the same shape the
 * `azure-ad` provider's jwt() callback produces in src/lib/auth.ts,
 * so a browser spec can run against entra-mode without actually
 * driving the OAuth redirect chain through Microsoft.
 *
 * Why direct-cookie injection vs a full OAuth stub server:
 *
 *   * NextAuth executes the token/userinfo fetches *server-side*
 *     inside Next.js — `page.route` only intercepts browser-side
 *     traffic, so the full code-flow mock would require running an
 *     additional stub Microsoft HTTP server and rewriting
 *     ASOE_TENANT_ID at process start to point at it. That's an
 *     order of magnitude more setup for tests that are exercising
 *     the UI state given an entra session — not the OAuth flow
 *     itself (NextAuth's own tests cover that).
 *
 *   * The session-cookie-injection pattern is the standard Playwright
 *     + NextAuth approach. Both auth-mode paths (seed and entra)
 *     converge on the same `useSession()` shape; the spec asserting
 *     `session.authMode === "entra"` proves the right branch ran.
 *
 * A separate stub-Microsoft module
 * (`tests/browser/_entra-stub-server.ts`) is documented as the
 * extension point if a future spec needs to exercise the OAuth
 * redirect chain end-to-end.
 */

import type { BrowserContext, Page } from "@playwright/test";
import { encode } from "next-auth/jwt";

/**
 * Defaults match the docs/testing/auth-modes.md matrix. The
 * NEXTAUTH_SECRET MUST agree with the dev server's so the cookie
 * decodes server-side.
 *
 * playwright.config.ts sets NEXTAUTH_SECRET on the dev server via
 * `webServer.env` — but `webServer.env` does NOT propagate to the
 * Playwright test-runner process. So `process.env.NEXTAUTH_SECRET`
 * read here would fall through to the literal default and the cookie
 * would silently fail to decode (server sees a different secret → no
 * session → tests pass by accident with an empty session).
 *
 * To prevent the mismatch we hard-pin the same secret on both sides.
 * If you change this string, change `playwright.config.ts`'s
 * `webServer.env.NEXTAUTH_SECRET` together; the architectural lock
 * in tests/architectural/entra_fixture_shape.test.ts asserts they
 * stay in sync.
 */
export const PLAYWRIGHT_NEXTAUTH_SECRET = "test-secret-browser-e2e-only";

const NEXTAUTH_SECRET =
  process.env.NEXTAUTH_SECRET ?? PLAYWRIGHT_NEXTAUTH_SECRET;

const COOKIE_NAME = "next-auth.session-token";

export interface EntraSessionOptions {
  /** Operator email. Surfaces in the PreprodIdentityBanner. */
  email?: string;
  /** Display name (NextAuth user.name). */
  name?: string;
  /** ASOE role set. The middleware's no-role-for-tenant branch is
   *  triggered by an empty array, which is the way to test /403. */
  roles?: string[];
  /** Tenant org identifier. */
  org?: string;
  /** Maximum age of the issued cookie, in seconds. Matches the prod
   *  default of 7 days unless overridden. */
  maxAgeSeconds?: number;
  /** Override the cookie domain (default localhost — the Playwright
   *  default base URL is http://localhost:3100). */
  domain?: string;
}

/**
 * Build the JWT payload mirroring what the azure-ad branch of
 * authOptions.callbacks.jwt() produces. Locked to `authMode: "entra"`
 * — that's the assertion specs use to prove the right path ran.
 */
function buildEntraToken(opts: Required<EntraSessionOptions>) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return {
    name: opts.name,
    email: opts.email,
    sub: `entra-oid-${opts.email}`,
    roles: opts.roles,
    org: opts.org,
    // The azure-ad branch stashes the id_token as accessToken so the
    // api client sends it as Authorization: Bearer ... — the backend
    // (PARITY-3b) JWKS-validates it.
    accessToken: "stub-entra-id-token",
    authMode: "entra" as const,
    iat: issuedAt,
    exp: issuedAt + opts.maxAgeSeconds,
    jti: `entra-jti-${issuedAt}`,
  };
}

/**
 * Inject an entra-mode NextAuth session cookie onto the given
 * Playwright browser context. Subsequent ``page.goto`` calls within
 * that context render as if the operator completed the Entra OAuth
 * flow.
 *
 * The `dev` server reads NEXTAUTH_SECRET to decode the cookie — make
 * sure playwright.config.ts's webServer config sets the same secret.
 *
 * No-op for tests that don't need an authenticated state — the seed
 * fixture remains the default for legacy specs.
 */
export async function createEntraSession(
  context: BrowserContext,
  options: EntraSessionOptions = {},
): Promise<void> {
  const filled: Required<EntraSessionOptions> = {
    email: options.email ?? "preprod-operator@stub-customer.example",
    name: options.name ?? "Preprod Operator",
    roles: options.roles ?? ["analyst"],
    org: options.org ?? "tenant-a",
    maxAgeSeconds: options.maxAgeSeconds ?? 7 * 24 * 60 * 60,
    domain: options.domain ?? "localhost",
  };

  const token = buildEntraToken(filled);
  const cookieValue = await encode({
    token,
    secret: NEXTAUTH_SECRET,
    maxAge: filled.maxAgeSeconds,
  });

  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: cookieValue,
      domain: filled.domain,
      path: "/",
      httpOnly: true,
      secure: false, // Playwright base URL is http://localhost:3100
      sameSite: "Lax",
      // Playwright's cookie expiry is a unix timestamp; -1 = session.
      expires: Math.floor(Date.now() / 1000) + filled.maxAgeSeconds,
    },
  ]);
}

/**
 * Convenience wrapper that creates the session and navigates the
 * page to the operational landing surface, mirroring `loginAs` from
 * `_helpers.ts`. Use for specs that just need "an authenticated
 * entra session lands on /home".
 */
export async function loginAsEntra(
  page: Page,
  options: EntraSessionOptions = {},
): Promise<void> {
  await createEntraSession(page.context(), options);
  await page.goto("/home");
}
