/**
 * Viewport overflow + reduced-motion respect (L4).
 *
 * docs/test-strategy/UX_ACCESSIBILITY.md Gap F.
 *
 *   1. Viewport overflow: at each of three desktop viewport sizes
 *      (1280×800, 1440×900, 1920×1080), every authenticated route
 *      renders without a horizontal scrollbar. Catches a new
 *      component widening a row past the queue's min-width.
 *
 *   2. Reduced motion: when the page is loaded in a context with
 *      `reducedMotion: "reduce"`, the Sidebar transition collapses
 *      to a 0-duration paint rather than the standard
 *      var(--duration-normal) slide. Asserts the design tokens
 *      honour `prefers-reduced-motion: reduce`.
 *
 * Both are smoke-style: short bounded assertions, no per-route
 * deep dive. The cost is one Playwright spec per gap, not one
 * spec per (route × viewport).
 */
import { test, expect, type Page } from "@playwright/test";

import {
  AUTHENTICATED_ROUTES,
  resolvePath,
} from "../../e2e/contract/authenticated-routes";
import { loginAs, USERS } from "./_helpers";

const VIEWPORTS = [
  { name: "1280×800 (laptop)", width: 1280, height: 800 },
  { name: "1440×900 (desktop)", width: 1440, height: 900 },
  { name: "1920×1080 (full HD)", width: 1920, height: 1080 },
] as const;

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    // +1 absorbs sub-pixel rounding across DPR boundaries.
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      diff: doc.scrollWidth - doc.clientWidth,
    };
  });
  expect(
    overflow.diff,
    `${label}: horizontal overflow of ${overflow.diff}px ` +
      `(scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth})`,
  ).toBeLessThanOrEqual(1);
}

test.describe("Viewport overflow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, USERS.MANAGER);
  });

  for (const route of AUTHENTICATED_ROUTES) {
    for (const vp of VIEWPORTS) {
      test(`${route.path} @ ${vp.name} has no horizontal scroll`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(resolvePath(route), { waitUntil: "domcontentloaded" });
        await expect(page.locator("nav").first()).toBeVisible({
          timeout: 15_000,
        });
        await assertNoHorizontalOverflow(page, `${route.path} @ ${vp.name}`);
      });
    }
  }
});

test.describe("Reduced motion", () => {
  test("design tokens honour prefers-reduced-motion: reduce", async ({
    page,
  }) => {
    // Emulate the OS-level user preference. emulateMedia is the
    // page-level equivalent of `contextOptions.reducedMotion`;
    // we keep it inside the test so the spec is self-contained
    // and does not require a top-level `test.use({...})` block
    // (which Playwright 1.56's TestOptions type does not expose
    // reducedMotion on directly).
    await page.emulateMedia({ reducedMotion: "reduce" });

    await loginAs(page, USERS.MANAGER);
    await page.goto("/cases", { waitUntil: "domcontentloaded" });
    await expect(page.locator("nav").first()).toBeVisible({ timeout: 15_000 });

    // Read the computed transition tokens; the reduced-motion
    // media query in design-tokens.css should have collapsed them
    // to 0ms. Tokens are exposed as CSS custom properties on
    // :root, so getComputedStyle(documentElement) returns the
    // active values.
    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        instant: cs.getPropertyValue("--dur-instant").trim(),
        fast: cs.getPropertyValue("--dur-fast").trim(),
        normal: cs.getPropertyValue("--dur-normal").trim(),
        slow: cs.getPropertyValue("--dur-slow").trim(),
      };
    });

    function isZeroMs(value: string): boolean {
      if (!value) return false;
      // Accept "0", "0ms", "0s", "0.000s" — but reject "150ms".
      return /^0(\.0+)?(ms|s)?$/.test(value);
    }

    for (const [name, value] of Object.entries(tokens)) {
      expect(
        isZeroMs(value),
        `--dur-${name} should collapse to 0 under reduced motion; got "${value}". ` +
          "Add a `@media (prefers-reduced-motion: reduce) { :root { --dur-*: 0ms } }` " +
          "block to src/styles/design-tokens.css.",
      ).toBe(true);
    }
  });
});
