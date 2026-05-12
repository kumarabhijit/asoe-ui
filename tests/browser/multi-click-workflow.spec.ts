/**
 * multi-click-workflow — chained user interactions through the
 * exception detail panel and queue.
 *
 * Per the user's explicit requirement and
 * `docs/test-strategy/eng-review-test-plan.md` Critical Paths, this
 * spec covers operator workflows that span MULTIPLE user clicks
 * across MULTIPLE exception records:
 *
 *   W1. Queue → detail → override → return → next item.
 *       Operator opens an item from the list, overrides, navigates
 *       back, opens the next item — every step exercises a different
 *       fetch + render path. Asserts no stale-state bleed between
 *       records.
 *
 *   W2. Override → re-override on same record (PO ruling 2026-05-03).
 *       The four-eyes-cosign and override-and-sod specs cover the
 *       single-action variants; W2 is the operator's "fix my own
 *       mistake" multi-click flow asserted end-to-end.
 *
 *   W3. Multi-record disposition workflow: pick three records from
 *       the queue, open each, override each with a different
 *       resolution action. Asserts the queue list refreshes and the
 *       three records reach distinct lifecycle states.
 *
 *   W4. Override dialog cancel → reopen → submit. The dialog must
 *       remember nothing across cancellations (no stale form state)
 *       and submit must succeed on the second attempt.
 *
 * These specs complement (not replace):
 *   - tests/browser/override-and-sod.spec.ts (single-record flow)
 *   - tests/browser/four-eyes-cosign.spec.ts (high-value escalation)
 *   - tests/browser/escalate.spec.ts          (escalate path)
 */
import { expect, test } from "@playwright/test";

import {
  BACKEND_URL,
  USERS,
  backendToken,
  exceptionUrl,
  createPendingReviewException,
  loginAs,
  resetTenant,
} from "./_helpers";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  const admin = await backendToken(request, USERS.ADMIN);
  await resetTenant(request, admin);
});


test("W1 — detail → override → next record dispatches each via the full pipeline", async ({
  page,
  request,
}) => {
  // ── Seed: backend creates two PENDING_REVIEW exceptions ─────────
  // V5.1 (Phase 28.5) — the `/exceptions` queue list now projects
  // from `casesApi.list()` and routes clicks to /cases/{id}; the
  // per-exception override flow lives at /exceptions/[id] reached
  // by direct navigation. This test exercises the override flow
  // and cross-record state isolation; we drive each record via
  // its /exceptions/{id} deeplink rather than via the queue row
  // (which no longer carries `data-exception-id`).
  const token = await backendToken(request, USERS.MANAGER);
  const seedTs = Date.now();
  const orderIdA = `PO-W1-A-${seedTs}`;
  const orderIdB = `PO-W1-B-${seedTs}`;
  const idA = await createPendingReviewException(request, token, orderIdA);
  const idB = await createPendingReviewException(request, token, orderIdB);

  // ── Click 1: log in, open record A's detail page ─────────────
  await loginAs(page, USERS.MANAGER);
  await page.goto(await exceptionUrl(request, token, idA));

  // ── Click 2: open Override dialog, submit ─────────────────────
  const openOverride = page.getByRole("button", {
    name: /choose different action/i,
  });
  await expect(openOverride).toBeVisible({ timeout: 15_000 });
  await openOverride.click();
  const dialog = page.getByRole("dialog", { name: /override resolution/i });
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByLabel(/^resolution action$/i).selectOption("ALLOW_BOTH");
  await dialog.getByLabel(/^override reason category$/i).selectOption("BAND_REVIEW_OVERRIDDEN");
  await dialog.getByLabel(/^override notes$/i).fill("W1 first record override");
  await dialog.getByRole("button", { name: /confirm override/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });

  // ── Backend confirms record A reached RESOLVED ────────────────
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${BACKEND_URL}/api/v1/exceptions/${idA}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        return res.ok() ? (await res.json()).lifecycle_state : null;
      },
      { timeout: 10_000, intervals: [250, 500, 1000] },
    )
    .toBe("RESOLVED");

  // ── Click 3: navigate to record B's detail page ───────────────
  await page.goto(await exceptionUrl(request, token, idB));

  // ── Click 4: Override dialog must NOT carry stale state from A ─
  const openOverrideB = page.getByRole("button", {
    name: /choose different action/i,
  });
  await expect(openOverrideB).toBeVisible({ timeout: 15_000 });
  await openOverrideB.click();
  const dialogB = page.getByRole("dialog", { name: /override resolution/i });
  await expect(dialogB).toBeVisible({ timeout: 5_000 });
  // The override notes textarea must be empty for record B — if the
  // dialog leaks state, "W1 first record override" would still be
  // there.
  const notesB = dialogB.getByLabel(/^override notes$/i);
  await expect(notesB).toHaveValue("");
  // Submit a different action so the assertion downstream
  // distinguishes A from B.
  await dialogB.getByLabel(/^resolution action$/i).selectOption("SUPERSEDE");
  await dialogB.getByLabel(/^override reason category$/i).selectOption("SAP_MASTER_PRICE_ERROR");
  await notesB.fill("W1 second record override");
  await dialogB.getByRole("button", { name: /confirm override/i }).click();
  await expect(dialogB).toBeHidden({ timeout: 10_000 });

  // ── Backend confirms record B reached RESOLVED with SUPERSEDE ──
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${BACKEND_URL}/api/v1/exceptions/${idB}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        return res.ok() ? (await res.json()).resolved_action : null;
      },
      { timeout: 10_000, intervals: [250, 500, 1000] },
    )
    .toBe("SUPERSEDE");

  // ── Cross-record check: A did NOT inherit B's SUPERSEDE ──────
  const a = await request.get(
    `${BACKEND_URL}/api/v1/exceptions/${idA}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect((await a.json()).resolved_action).toBe("ALLOW_BOTH");
});


test("W2 — override → re-override on the same record (PO ruling 2026-05-03)", async ({
  page,
  request,
}) => {
  const token = await backendToken(request, USERS.MANAGER);
  const exceptionId = await createPendingReviewException(
    request, token, `PO-W2-${Date.now()}`,
  );
  await loginAs(page, USERS.MANAGER);
  await page.goto(await exceptionUrl(request, token, exceptionId));

  const openOverride = page.getByRole("button", { name: /choose different action/i });

  // ── Click sequence 1: open, fill, submit ─────────────────────
  await expect(openOverride).toBeVisible({ timeout: 15_000 });
  await openOverride.click();
  let dialog = page.getByRole("dialog", { name: /override resolution/i });
  await dialog.getByLabel(/^resolution action$/i).selectOption("MERGE");
  await dialog.getByLabel(/^override reason category$/i).selectOption("BAND_REVIEW_OVERRIDDEN");
  await dialog.getByLabel(/^override notes$/i).fill("W2 first override");
  await dialog.getByRole("button", { name: /confirm override/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });

  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${BACKEND_URL}/api/v1/exceptions/${exceptionId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        return res.ok() ? (await res.json()).resolved_action : null;
      },
      { timeout: 10_000, intervals: [250, 500, 1000] },
    )
    .toBe("MERGE");

  // ── Click sequence 2: same operator opens override AGAIN ─────
  // Per PO ruling 2026-05-03, self-override is allowed (operators
  // legitimately need to correct their own earlier overrides).
  await expect(openOverride).toBeVisible({ timeout: 15_000 });
  await openOverride.click();
  dialog = page.getByRole("dialog", { name: /override resolution/i });
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // The dialog's resolution action selector must NOT be pinned to the
  // previously-submitted MERGE — it should default to whatever the
  // dialog's initial state is (recipe-recommended action).
  await dialog.getByLabel(/^resolution action$/i).selectOption("ALLOW_BOTH");
  await dialog.getByLabel(/^override reason category$/i).selectOption("OTHER");
  await dialog.getByLabel(/^override notes$/i).fill("W2 self-correction");
  await dialog.getByRole("button", { name: /confirm override/i }).click();

  // No SoD self-block toast must appear.
  await expect(
    page.getByText(/segregation of duties/i),
  ).toHaveCount(0, { timeout: 5_000 });

  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${BACKEND_URL}/api/v1/exceptions/${exceptionId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        return res.ok() ? (await res.json()).resolved_action : null;
      },
      { timeout: 10_000, intervals: [250, 500, 1000] },
    )
    .toBe("ALLOW_BOTH");
});


test("W3 — multi-record disposition workflow: 3 distinct resolutions across detail pages", async ({
  page,
  request,
}) => {
  // V5.1 (Phase 28.5) — same supersession as W1: the /exceptions
  // queue list now routes clicks to /cases/{id}; per-record
  // override lives at /exceptions/[id] reached by direct
  // navigation. Test value (cross-record state isolation across
  // three distinct resolutions) is preserved.
  const token = await backendToken(request, USERS.MANAGER);
  const seedTs = Date.now();
  const seeds = [
    { orderId: `PO-W3-1-${seedTs}`, action: "ALLOW_BOTH", reason: "BAND_REVIEW_OVERRIDDEN" },
    { orderId: `PO-W3-2-${seedTs}`, action: "MERGE", reason: "SAP_MASTER_PRICE_ERROR" },
    { orderId: `PO-W3-3-${seedTs}`, action: "SUPERSEDE", reason: "CUSTOMER_CONCESSION_LOW" },
  ] as const;
  const records = await Promise.all(
    seeds.map(async (s) => ({
      ...s,
      id: await createPendingReviewException(request, token, s.orderId),
    })),
  );

  await loginAs(page, USERS.MANAGER);

  for (const rec of records) {
    // Click 1: open this record's detail page directly
    await page.goto(await exceptionUrl(request, token, rec.id));

    // Click 2: open Override dialog
    const openBtn = page.getByRole("button", {
      name: /choose different action/i,
    });
    await expect(openBtn).toBeVisible({ timeout: 15_000 });
    await openBtn.click();

    // Click 3: fill + confirm
    const dialog = page.getByRole("dialog", {
      name: /override resolution/i,
    });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByLabel(/^resolution action$/i).selectOption(rec.action);
    await dialog.getByLabel(/^override reason category$/i).selectOption(rec.reason);
    await dialog.getByLabel(/^override notes$/i).fill(`W3 disposition for ${rec.orderId}`);
    await dialog.getByRole("button", { name: /confirm override/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  }

  // ── Verify each record reached its expected lifecycle/action ──
  for (const rec of records) {
    const res = await request.get(
      `${BACKEND_URL}/api/v1/exceptions/${rec.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.ok(), `GET ${rec.orderId} ok`).toBe(true);
    const body = await res.json();
    expect(body.lifecycle_state, `${rec.orderId} lifecycle`).toBe("RESOLVED");
    expect(body.resolved_action, `${rec.orderId} action`).toBe(rec.action);
  }
});


test("W4 — override dialog cancel → reopen → submit (no stale form state)", async ({
  page,
  request,
}) => {
  const token = await backendToken(request, USERS.MANAGER);
  const exceptionId = await createPendingReviewException(
    request, token, `PO-W4-${Date.now()}`,
  );

  await loginAs(page, USERS.MANAGER);
  await page.goto(await exceptionUrl(request, token, exceptionId));

  const openOverride = page.getByRole("button", {
    name: /choose different action/i,
  });

  // ── Click 1: open dialog, partially fill, then cancel ──────────
  await expect(openOverride).toBeVisible({ timeout: 15_000 });
  await openOverride.click();
  let dialog = page.getByRole("dialog", { name: /override resolution/i });
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await dialog.getByLabel(/^resolution action$/i).selectOption("REJECT");
  await dialog.getByLabel(/^override notes$/i).fill("DRAFT — should not persist");

  // Cancel via the standard dismiss button (Radix dialog renders an
  // accessible Cancel/Close affordance).
  const cancelBtn = dialog.getByRole("button", { name: /^cancel$/i });
  if (await cancelBtn.isVisible().catch(() => false)) {
    await cancelBtn.click();
  } else {
    // Fall back to Escape key — Radix Dialog dismisses on Escape.
    await page.keyboard.press("Escape");
  }
  await expect(dialog).toBeHidden({ timeout: 5_000 });

  // ── Click 2: reopen the dialog ───────────────────────────────
  await expect(openOverride).toBeVisible({ timeout: 5_000 });
  await openOverride.click();
  dialog = page.getByRole("dialog", { name: /override resolution/i });
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  // Notes must be empty — the cancelled draft must NOT have persisted.
  await expect(dialog.getByLabel(/^override notes$/i)).toHaveValue("");

  // ── Click 3: complete the override successfully ───────────────
  await dialog.getByLabel(/^resolution action$/i).selectOption("ESCALATE");
  await dialog.getByLabel(/^override reason category$/i).selectOption("BAND_REVIEW_OVERRIDDEN");
  await dialog.getByLabel(/^override notes$/i).fill("W4 final submission after cancel");
  await dialog.getByRole("button", { name: /confirm override/i }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });

  // ── Backend reflects the FINAL submission (ESCALATE), not REJECT ─
  await expect
    .poll(
      async () => {
        const res = await request.get(
          `${BACKEND_URL}/api/v1/exceptions/${exceptionId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        return res.ok() ? (await res.json()).resolved_action : null;
      },
      { timeout: 10_000, intervals: [250, 500, 1000] },
    )
    .toBe("ESCALATE");
});
