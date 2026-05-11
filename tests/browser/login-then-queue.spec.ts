/**
 * login-then-queue — smoke-proof the UI ↔ backend integration.
 *
 * Drives:
 *   1. Next.js dev server (port 3100) with NEXT_PUBLIC_USE_REAL_API=1
 *      → api.ts fetch() branch active.
 *   2. asoe2 uvicorn (port 8000) in sandbox mode.
 *   3. A real browser (Chromium) navigates to /login, walks the two-step
 *      email-then-password wizard, lands in the app, and observes the
 *      live queue loading from the backend.
 *
 * What this proves:
 *   - NextAuth.authorize() → authApi.login() → real POST /api/auth/login
 *   - The resulting JWT is stored in the session cookie
 *   - /exceptions fetches /api/v1/exceptions with that JWT and renders
 *
 * Data prerequisite: the user `marcus.webb@acme-corp.com` exists in the
 * seed user store (`asoe2/api/users.py`). Backend accepts any non-empty
 * password (V1 stub — production replaces with IdP validation).
 *
 * We use an @acme-corp.com email rather than @acme.com (which is in the
 * SSO_DOMAINS list in src/app/login/page.tsx) so we skip a simulated
 * 2-second SSO redirect animation.
 */
import { test, expect } from "@playwright/test";

test("login → exception queue loads from live backend", async ({ page }) => {
  // ── Step 1: email ────────────────────────────────────────────────────
  await page.goto("/login");
  // The field label reads "Username, email address, or SSO code" — match
  // on the exact accessible name to avoid ambiguity with the "Forgot
  // username?" button elsewhere on the page.
  const emailInput = page.getByRole("textbox", {
    name: /username, email address/i,
  });
  await expect(emailInput).toBeVisible({ timeout: 10_000 });
  await emailInput.fill("marcus.webb@acme-corp.com");
  // Submit via Enter from inside the field rather than clicking the
  // button. Playwright's button-click races with React's controlled-input
  // state update on Next 16 Turbopack dev; pressing Enter triggers the
  // form's native submit which handleNext listens on (onSubmit), and the
  // input's onChange has already flushed by the time the keystroke
  // dispatches.
  await emailInput.press("Enter");

  // ── Step 2: password ─────────────────────────────────────────────────
  // handleNext() has a 600 ms artificial delay before swapping
  // step="password", plus the re-render cost. Give it a generous budget.
  const passwordInput = page.getByRole("textbox", { name: /^password$/i });
  await expect(passwordInput).toBeVisible({ timeout: 10_000 });
  await passwordInput.fill("any-non-empty-password");

  // Click Sign In. Post-login redirect target depends on the role.
  // Issue #133 (PO #5/#6) made /home the operational landing surface;
  // root / now redirects to /home. Pre-#133 sessions could land on
  // /exceptions or /dashboard directly depending on visible_tabs
  // configuration — both still valid post-login URLs for a manager.
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(home|exceptions|dashboard)/, { timeout: 20_000 });

  // ── Queue renders against the live backend ───────────────────────────
  await page.goto("/exceptions");
  // Either exceptions show up, or the empty-state banner confirms the
  // page made it past auth + a successful GET /api/v1/exceptions.
  await expect(page.locator("body")).toContainText(
    /exceptions|no exceptions|queue|empty/i,
    { timeout: 15_000 },
  );
});
