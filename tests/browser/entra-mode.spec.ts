/**
 * Sample browser spec demonstrating the entra-mode Playwright
 * fixture (PARITY-3a follow-up).
 *
 * Run as: `npm run test:browser -- entra-mode.spec.ts` once the
 * dev server is started with ASOE_AUTH_MODE=entra +
 * NEXT_PUBLIC_ASOE_AUTH_MODE=entra + the matching NEXTAUTH_SECRET.
 * The fixture decoupling means we don't have to drive Microsoft's
 * OAuth pages — the cookie is the capability.
 *
 * Both auth-mode paths converge on the same `useSession()` shape, so
 * the spec asserting `session.authMode === "entra"` verifies the
 * azure-ad jwt callback ran (or, for tests using the fixture, that
 * the fixture matches its prod-time twin).
 */

import { test, expect } from "@playwright/test";
import { createEntraSession, loginAsEntra } from "./_entra-fixture";

test.describe("entra-mode session fixture", () => {
  test.skip(
    process.env.ASOE_AUTH_MODE !== "entra",
    "entra fixture requires ASOE_AUTH_MODE=entra dev server",
  );

  test("session.authMode is 'entra' under the fixture", async ({ context, page }) => {
    await createEntraSession(context, {
      email: "alice@stub-customer.example",
      roles: ["analyst"],
    });
    // Hit a NextAuth route that returns the session JSON — the
    // canonical place to assert session shape without rendering UI.
    await page.goto("/api/auth/session");
    const body = await page.evaluate(() => document.body.innerText);
    const session = JSON.parse(body);
    expect(session.authMode).toBe("entra");
    expect(session.user.email).toBe("alice@stub-customer.example");
  });

  test("preprod identity banner shows the entra user", async ({ page }) => {
    await loginAsEntra(page, {
      email: "bob@stub-customer.example",
      name: "Bob Operator",
    });
    // The banner is gated on NEXT_PUBLIC_ASOE_AUTH_MODE=entra at
    // build time AND on the session.authMode flag; this test
    // assumes the dev server is started in entra mode.
    const banner = page.getByTestId("preprod-identity-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("bob@stub-customer.example");
  });

  test("no-role-for-tenant redirects to /403 (middleware branch)", async ({
    context, page,
  }) => {
    // Empty roles array exercises the third middleware failure
    // branch — distinct from token-missing (/login) and
    // token-invalid (/login?reason=session_expired).
    await createEntraSession(context, {
      email: "norole@stub-customer.example",
      roles: [],
    });
    await page.goto("/exceptions");
    await page.waitForURL(/\/403/, { timeout: 5_000 });
    // The /403 page surfaces the original path so the operator
    // sees what they were trying to reach.
    expect(page.url()).toContain("from=");
  });
});
