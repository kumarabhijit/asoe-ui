/**
 * Shared helpers for browser specs.
 *
 * Keeps individual specs focused on the *behavior* under test — the
 * repetitive plumbing (login, seed, backend setup) lives here and is
 * composed via fixtures.
 */
import { type Page, type APIRequestContext, expect } from "@playwright/test";

export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:8000";

/**
 * Drive the UI login wizard for a seed user. Returns nothing — the
 * resulting NextAuth session cookie is attached to the Page's context
 * for subsequent navigation.
 */
export async function loginAs(
  page: Page,
  email: string,
): Promise<void> {
  await page.goto("/login");
  const emailInput = page.getByRole("textbox", {
    name: /username, email address/i,
  });
  await expect(emailInput).toBeVisible({ timeout: 10_000 });
  await emailInput.fill(email);
  await emailInput.press("Enter");

  const passwordInput = page.getByRole("textbox", { name: /^password$/i });
  await expect(passwordInput).toBeVisible({ timeout: 10_000 });
  await passwordInput.fill("any-non-empty-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(exceptions|inbox|dashboard)/, { timeout: 20_000 });
}

/**
 * Create a JWT for direct backend calls, bypassing NextAuth. Used when
 * a spec needs to seed data on the backend faster than clicking through
 * the UI. The JWT is minted by the asoe2 `create_test_token` helper;
 * we can't call that Python function directly, so we go through the
 * real `/api/auth/login` endpoint which accepts any non-empty password
 * for a seed user in V1.
 */
export async function backendToken(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/api/auth/login`, {
    data: { email, password: "any-non-empty-password" },
  });
  if (!res.ok()) throw new Error(`login ${email} failed: ${res.status()}`);
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

/**
 * Create a YELLOW+PENDING_REVIEW exception via /resolve/explain so the
 * spec has a known-state record to drive. Returns the exception_id.
 */
export async function createPendingReviewException(
  request: APIRequestContext,
  token: string,
  orderId = `PO-E2E-${Date.now()}`,
): Promise<string> {
  const res = await request.post(
    `${BACKEND_URL}/api/v1/exceptions/resolve/explain`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        order_id: orderId,
        po_price: 100.0,
        sap_base_price: 120.0,
        event_type: "EDI_850_PRICE_MISMATCH",
      },
    },
  );
  if (!res.ok()) throw new Error(`create pending: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { exception_id: string };
  return body.exception_id;
}

/**
 * Clear in-memory exceptions + audit entries for the tenant so the next
 * spec sees a clean GENESIS audit chain. Uses the sandbox-only admin
 * endpoint added alongside this branch.
 */
export async function resetTenant(
  request: APIRequestContext,
  token: string,
): Promise<void> {
  await request.post(`${BACKEND_URL}/api/v1/_sandbox/tenant/reset`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
}

/**
 * Stamp a financial_impact_usd on an existing exception so a subsequent
 * /disposition call will trip the four-eyes threshold and stage to
 * PENDING_COSIGN. Uses the sandbox-only seed endpoint.
 */
export async function seedFinancialImpact(
  request: APIRequestContext,
  token: string,
  exceptionId: string,
  amountUsd: number,
): Promise<void> {
  const res = await request.post(
    `${BACKEND_URL}/api/v1/_sandbox/seed/financial-impact`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        exception_id: exceptionId,
        financial_impact_usd: amountUsd,
      },
    },
  );
  if (!res.ok()) {
    throw new Error(`seed financial_impact: ${res.status()} ${await res.text()}`);
  }
}

// Seed user logins (backend accepts any non-empty password — V1 stub).
export const USERS = {
  // Admin — full permissions, all tabs visible.
  ADMIN: "jane@acme.com",
  // Manager — has exceptions:override, exceptions:approve, exceptions:escalate.
  // Non-SSO domain so we skip the 2s SSO simulation on the login page.
  MANAGER: "marcus.webb@acme-corp.com",
  // Second manager — used to exercise SoD across two different subs.
  MANAGER_2: "sarah.chen@acme-corp.com",
  // Analyst — only exceptions:approve, exceptions:escalate.
  ANALYST: "james.ortiz@acme-corp.com",
} as const;
