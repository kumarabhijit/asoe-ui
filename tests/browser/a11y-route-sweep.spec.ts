/**
 * Route-level axe sweep (L4).
 *
 * docs/test-strategy/UX_ACCESSIBILITY.md Gap E. For every
 * `AUTHENTICATED_ROUTES` entry, log in, navigate, inject axe via
 * `@axe-core/playwright`, and assert no `serious | critical`
 * violations.
 *
 * Why `serious | critical` only (today): the page-level inventory
 * has not yet been driven to zero across moderate/minor rules.
 * Promoting `moderate` to gating is a follow-on once the current
 * floor is provably zero across two consecutive releases — the
 * doc records the roadmap step.
 *
 * Component-level violations are also covered by the vitest-axe
 * sweep in tests/accessibility/component_sweep.test.tsx; this
 * spec catches violations that only surface in page composition
 * (heading order, duplicate id, landmark uniqueness).
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import {
  AUTHENTICATED_ROUTES,
  resolvePath,
} from "../../e2e/contract/authenticated-routes";
import { loginAs, USERS } from "./_helpers";

// Per-route allow-list. Add an entry only when an outstanding bug
// is tracked elsewhere and the team has agreed to defer. Empty
// today.
const KNOWN_DEFERRED: Record<string, string[]> = {};

test.beforeEach(async ({ page }) => {
  await loginAs(page, USERS.MANAGER);
});

for (const route of AUTHENTICATED_ROUTES) {
  test(`a11y sweep: ${route.path}`, async ({ page }) => {
    const target = resolvePath(route);

    const response = await page.goto(target, { waitUntil: "domcontentloaded" });
    // We do not assert response status here — the chrome-invariant
    // spec already owns "this URL renders without 5xx". The axe
    // analyser cares about the rendered DOM, not the HTTP status.
    expect(response, `${target} navigation produced no response`).not.toBeNull();

    // Let the page settle enough for the primary surfaces to mount
    // (data loads, hydration). The chrome NavBar is the canonical
    // beacon; once it's visible, the page tree is mounted.
    await expect(page.locator("nav").first()).toBeVisible({ timeout: 15_000 });

    const builder = new AxeBuilder({ page })
      // WCAG 2.1 AA tags. Rule-id filtering is done after analysis
      // so the failure message can name the rule that violated.
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);

    const deferred = KNOWN_DEFERRED[route.path];
    if (deferred && deferred.length > 0) {
      builder.disableRules(deferred);
    }

    const results = await builder.analyze();
    const gating = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    // Pretty-print the failure: include rule id, impact, and the
    // first matching node's target selector so a CI viewer can
    // reproduce in DevTools.
    const formatted = gating.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.target),
    }));

    expect(
      formatted,
      `axe found ${formatted.length} serious|critical violation(s) on ${target}`,
    ).toEqual([]);
  });
}
