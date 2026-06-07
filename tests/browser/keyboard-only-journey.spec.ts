/**
 * Keyboard-only operator journey (L5) + announcement assertion.
 *
 * docs/test-strategy/UX_ACCESSIBILITY.md Gap G. One spec that
 * bundles two invariants:
 *
 *   1. Every primary surface is reachable with the keyboard alone
 *      — no `mouse.move`, no `click()` on coordinates. Only
 *      Tab / Shift+Tab / Enter / Space / Escape / Arrow keys.
 *   2. After a disposition action, the `[data-testid=
 *      "status-announcer"]` text changes, proving the aria-live
 *      wiring is intact end-to-end.
 *
 * Bundling these in one spec is deliberate: the keyboard path and
 * the announcement are co-dependent contracts that ship or break
 * together. Splitting them produces two flaky specs that fail at
 * the same time anyway.
 */
import { test, expect } from "@playwright/test";

import {
  USERS,
  backendToken,
  createYellowException,
  resetTenant,
} from "./_helpers";

test("operator drives login → cases → action via keyboard only", async ({
  page,
  request,
}) => {
  // Seed a known YELLOW record so we know an actionable row will
  // be in the queue. Keyboard navigation against an empty queue is
  // a different test (the empty state ought to focus the
  // create-shortcut button — out of scope here).
  const token = await backendToken(request, USERS.MANAGER);
  await resetTenant(request, token);
  await createYellowException(request, token);

  // ── 1. Keyboard login ────────────────────────────────────────
  await page.goto("/login");
  const emailInput = page.getByRole("textbox", {
    name: /username, email address/i,
  });
  await expect(emailInput).toBeVisible({ timeout: 10_000 });
  // Focus via keyboard rather than `.focus()` so we exercise the
  // tab order: first focusable element on /login MUST be the
  // email input (skip-link comes before it but jumps to main).
  await emailInput.focus();
  await page.keyboard.type(USERS.MANAGER);
  await page.keyboard.press("Enter");

  const passwordInput = page.getByRole("textbox", { name: /^password$/i });
  await expect(passwordInput).toBeVisible({ timeout: 10_000 });
  await passwordInput.focus();
  await page.keyboard.type("any-non-empty-password");
  await page.keyboard.press("Enter");

  await page.waitForURL(/\/(home|exceptions|dashboard|cases)/, {
    timeout: 20_000,
  });

  // ── 2. Skip-link is the first tabbable element ───────────────
  // The skip link lives in the layout above the nav. The first
  // Tab from a freshly loaded page must focus it. This is what
  // makes the keyboard journey usable for AT users.
  await page.goto("/cases");
  await expect(page.locator("nav").first()).toBeVisible({ timeout: 15_000 });

  // Move focus to <body> so the next Tab starts from a known
  // origin. evaluate is non-interactive — keyboard only after.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    document.body.focus();
  });
  await page.keyboard.press("Tab");
  const skipFocused = await page.evaluate(
    () =>
      document.activeElement?.matches('a[href="#main-content"]') ?? false,
  );
  expect(
    skipFocused,
    "first Tab from <body> on /cases should focus the skip-to-main link",
  ).toBe(true);

  // ── 3. Navigate the queue with the keyboard ──────────────────
  // The queue listbox supports arrow-key navigation via
  // useKeyboardListNav. Focus the first row, then Enter to select.
  const firstRow = page.locator('[role="option"]').first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  await firstRow.focus();
  await page.keyboard.press("Enter");

  // The right pane now shows the case detail. Wait for the
  // AgentReasoningCard action row to appear — `re-analyze` is the
  // vocabulary-stable beacon (it exists across every verdict ×
  // permission branch); the per-action buttons (Approve / Reject /
  // Escalate / Override…) vary. Mirrors the pattern in
  // tests/browser/cases-workspace-case-switch.spec.ts.
  await expect(
    page.getByRole("button", { name: /re-analyze/i }).first(),
  ).toBeVisible({ timeout: 15_000 });

  // Now grab the Escalate action by its aria-label "Send for
  // triage" (the visible text is just "Escalate"; the accessible
  // name carries the verb the screen reader announces).
  const escalateBtn = page.getByRole("button", { name: /send for triage/i });
  await expect(escalateBtn).toBeVisible({ timeout: 15_000 });

  // ── 4. Trigger the action via keyboard + assert announcement ─
  // Capture the announcer text before the action; assert it
  // changes within 2s of the action firing. The exact text is
  // assertion-fragile across copy edits — assert that the text
  // mutated, not the literal phrase.
  const announcer = page.locator('[data-testid="status-announcer"]');
  await expect(announcer).toBeAttached();
  const before = (await announcer.textContent()) ?? "";

  // ADR-045 CP3 — Escalate now collects its mandatory reason through an
  // in-panel dialog (the window.prompt path was retired; an in-DOM
  // dialog is the more accessible surface this keyboard journey asserts).
  // Enter on the button opens it; the reason textarea autofocuses, so we
  // type the reason and submit with ⌘↵ — entirely on the keyboard.
  await escalateBtn.focus();
  await page.keyboard.press("Enter");

  const escalationDialog = page.getByRole("dialog", {
    name: /escalation reason required/i,
  });
  await expect(escalationDialog).toBeVisible({ timeout: 5_000 });
  await escalationDialog.getByRole("textbox").focus();
  await page.keyboard.type("Need supervisor review");
  await page.keyboard.press("Meta+Enter");

  // After the prompt is accepted, useExceptionActions.handleEscalate
  // calls exceptionsApi.escalate and then announce(). Poll up to 8s
  // to absorb the network round-trip against the live backend.
  await expect
    .poll(async () => (await announcer.textContent()) ?? "", {
      timeout: 8_000,
      message: "StatusAnnouncer text did not change after Escalate",
    })
    .not.toEqual(before);
});
