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
  // Issue #133 (PO #5/#6) made /home the operational landing surface;
  // root / now redirects there. Pre-#133 sessions could also land on
  // /exceptions or /dashboard depending on the callbackUrl that
  // the login form was carrying.
  await page.waitForURL(/\/(home|exceptions|dashboard)/, { timeout: 20_000 });
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
 * Create a PENDING_REVIEW exception via /resolve/explain so the spec
 * has a known-state record to drive. Verdict is GREEN under current
 * thresholds — good enough for specs that only need the manager's
 * Override… button (which shows on GREEN). For YELLOW-dependent
 * specs (analyst sees Approve/Reject/Escalate) use
 * createYellowException() instead.
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
 * Create a YELLOW-shadow PENDING_REVIEW exception so the analyst-tier
 * action row (Approve / Reject / Escalate) renders.
 *
 * Implementation: a BACK_ORDER event with a ~25% gap. Under current
 * policy (BACK_ORDER_SEVERE_GAP_PCT = 0.50), this lands as MINOR_GAP
 * → shadow YELLOW → MANUAL_REVIEW_REQUIRED — exactly the lifecycle
 * the analyst is supposed to escalate. The post-2026-04-22 graph
 * reorder (ADR-025) runs gateway READS pre-shadow so the
 * audit-bearing fields populate even on YELLOW, keeping the record
 * out of AUDIT_CONTEXT_MISSING.
 *
 * Note on the previous implementation: it seeded a high-confidence
 * DUPLICATE_PO which actually evaluated GREEN-shadow + AUTO_BLOCK
 * lifecycle — no analyst-tier buttons rendered. The test name was
 * misleading and the spec failed once the deterministic-fallback
 * backend shipped. BACK_ORDER 25% produces the intended YELLOW state
 * deterministically end-to-end against the live backend.
 */
export async function createYellowException(
  request: APIRequestContext,
  token: string,
  orderId = `PO-E2E-${Date.now()}`,
): Promise<string> {
  const res = await request.post(
    `${BACKEND_URL}/api/v1/exceptions/resolve`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        order_id: orderId,
        line_item: 1,
        po_price: 10.0,
        sap_base_price: 10.0,
        event_type: "BACK_ORDER_OOS",
        retailer_id: "R-70",
        line_count: 1,
        sku: "SKU-BO-1",
        metadata: {
          ordered_qty: 100,
          available_qty: 75,
          unit_price: 10.0,
          uom: "CS",
        },
      },
    },
  );
  if (!res.ok()) throw new Error(`create yellow: ${res.status()} ${await res.text()}`);
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

/**
 * Click a collapsible enrichment section header to expand it.
 *
 * Per PO ruling 2026-05-03 the enrichment sections (Price Analysis,
 * Back-Order Analysis, Price Hold, etc.) are collapsed by default —
 * the operator scans the Recommendation card first and only drills
 * in when they need detail. Specs that assert content INSIDE one of
 * those sections must therefore expand it explicitly. Pass the
 * section title exactly as shown on the header (case-insensitive
 * regex matched here for resilience to small copy edits).
 */
export async function expandSection(
  page: Page,
  title: RegExp | string,
): Promise<void> {
  const header = page.getByRole("button", {
    name: title instanceof RegExp ? title : new RegExp(title, "i"),
  });
  await expect(header.first()).toBeVisible({ timeout: 15_000 });
  await header.first().click();
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
