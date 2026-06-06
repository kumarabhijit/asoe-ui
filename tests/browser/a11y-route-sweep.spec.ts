/**
 * Route-level axe sweep (L4).
 *
 * docs/test-strategy/UX_ACCESSIBILITY.md Gap E. For every
 * `AUTHENTICATED_ROUTES` entry, log in, navigate, inject axe via
 * `@axe-core/playwright`, and report `serious | critical`
 * violations.
 *
 * ── Why the gate is informational today ──────────────────────
 *
 * The first PR run surfaced a pervasive `color-contrast` (serious)
 * inventory across every authenticated route: small-caption uses
 * of `text-text-tertiary` (#7E7E92 → 3.92:1 on the page surface)
 * and `text-text-quaternary` (#B0B0C0 → ~1.9:1), both below the
 * 4.5:1 AA small-text floor.
 *
 * The strategy doc anticipated this — "promoting `moderate` to
 * gating is a follow-on once the existing inventory is at zero".
 * The same logic applies to the `serious` band: we can't gate
 * day-1 without first driving the inventory to zero or building
 * an allow-list per route.
 *
 * v1 behaviour (this file):
 *   - Run axe on every route.
 *   - Attach the per-route violation report as a test annotation
 *     so the Playwright HTML report surfaces the findings.
 *   - Fail the test ONLY if the inventory regresses past the
 *     route's `baseline` count — additions are caught, current
 *     debt is tolerated.
 *
 * v2 behaviour (follow-on PR):
 *   - Once a route's baseline drops to zero, flip its entry to
 *     `baseline: 0` and the test becomes a hard gate for that
 *     route. Routes can ratchet down independently.
 *   - Once every route has `baseline: 0` for two consecutive
 *     releases, promote `moderate` rules into the gating set.
 *
 * The route fixed under this PR (NavBar inactive tab text bumped
 * from `text-tertiary` to `text-secondary`) closes one cluster
 * of violations across all routes. The remaining clusters are
 * tracked in `UX_ACCESSIBILITY.md` "Known shortfalls".
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import {
  AUTHENTICATED_ROUTES,
  resolvePath,
} from "../../e2e/contract/authenticated-routes";
import { loginAs, USERS } from "./_helpers";

// Per-route ratchet: maximum number of `serious | critical`
// violations tolerated today. Driving any entry to 0 is the
// follow-on cleanup; lowering an entry locks the win.
//
// Numbers measured 2026-05-14 against the post-NavBar-fix tree.
// The remaining violations are all small-text `color-contrast`
// uses of `text-text-tertiary` / `text-text-quaternary` in
// captions, badges, and table headers. Tracked in
// docs/test-strategy/UX_ACCESSIBILITY.md "Known shortfalls".
const ROUTE_BASELINE: Record<string, number> = {
  "/home": 1,
  "/cases": 1,
  "/cases/:id": 1,
  "/dashboard": 1,
  "/settings": 1,
  // Same documented small-caption color-contrast debt as every sibling
  // route — `text-text-tertiary` / `text-text-quaternary` captions/labels,
  // including via the shared `MetricTile` (the irreducible source until the
  // design-token contrast fix lands). axe aggregates these into a single
  // `serious` violation object. Rationale in UX_ACCESSIBILITY.md "Known
  // shortfalls"; drive to 0 with the token fix, not a per-page workaround.
  "/settings/autonomy": 1,
};

// Rule ids that may be disabled per-route while an underlying
// fix is still in flight. Empty today; a future PR may add one
// when a specific route needs to defer a single rule beyond
// what the count-based ratchet captures.
const KNOWN_DEFERRED_RULES: Record<string, string[]> = {};

test.beforeEach(async ({ page }) => {
  await loginAs(page, USERS.MANAGER);
});

for (const route of AUTHENTICATED_ROUTES) {
  test(`a11y sweep: ${route.path}`, async ({ page }, testInfo) => {
    const target = resolvePath(route);

    const response = await page.goto(target, { waitUntil: "domcontentloaded" });
    expect(response, `${target} navigation produced no response`).not.toBeNull();

    // Let the page settle enough for the primary surfaces to mount
    // (data loads, hydration). The chrome NavBar is the canonical
    // beacon; once it's visible, the page tree is mounted.
    await expect(page.locator("nav").first()).toBeVisible({ timeout: 15_000 });

    const builder = new AxeBuilder({ page })
      // WCAG 2.1 AA tags. Rule-id filtering is done after analysis
      // so the failure message can name the rule that violated.
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);

    const deferredRules = KNOWN_DEFERRED_RULES[route.path];
    if (deferredRules && deferredRules.length > 0) {
      builder.disableRules(deferredRules);
    }

    const results = await builder.analyze();
    const gating = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    // Pretty-print for the Playwright HTML report.
    const formatted = gating.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 5).map((n) => n.target),
    }));

    // Attach as a test annotation so reviewers can see every
    // finding in the HTML report without re-running axe locally.
    testInfo.annotations.push({
      type: "axe-findings",
      description: JSON.stringify(
        { route: target, count: formatted.length, violations: formatted },
        null,
        2,
      ),
    });

    const baseline = ROUTE_BASELINE[route.path] ?? 0;
    expect(
      formatted.length,
      `axe found ${formatted.length} serious|critical violation(s) on ` +
        `${target}; baseline allows ${baseline}. ` +
        (formatted.length > baseline
          ? "Regression — a new violation has landed. Either fix it or, " +
            "if the fix is out of scope, raise the baseline with " +
            "rationale in UX_ACCESSIBILITY.md \"Known shortfalls\"."
          : "Below baseline — lock the win by lowering the baseline."),
    ).toBeLessThanOrEqual(baseline);
  });
}
