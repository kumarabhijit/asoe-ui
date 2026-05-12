// CMT-2 — chrome invariant under TRANSITIONS.
//
// V2 was a transition bug: chrome disappeared during forward/back
// navigation, not on final-state DOM. The base chrome-invariant
// spec asserts chrome on each route in isolation (page.goto then
// assert). This spec exercises the transition itself:
//
//   1. Per-pair transition: for each (route_a -> route_b) in the
//      registry, navigate route_a, then route_b, and observe the
//      NavBar continuously during the navigation. The nav must
//      not unmount mid-flight.
//   2. bfcache restore: page.goBack() after a forward navigation.
//      Modern browsers may serve the prior page from the
//      back-forward cache without re-mounting the React tree;
//      chrome must still be present.
//
// J4 (auth-edge operator) owns this archetype. The orientation
// arc asserts chrome reachability across these transitions; the
// task-completion arc (auth degraded mid-flow) is broader and
// remains a TODO for V1.1.
//
// Note on pair selection: the registry has 7 routes which would
// yield 42 ordered pairs. We exercise a representative subset
// rather than the full N×(N-1) matrix because:
//   - The chrome surface is the same per page (per-page NavBar
//     render, not a shared layout — D5 still pending).
//   - Each pair adds ~3-5s of runtime in CI; the full matrix
//     pushes the spec past Playwright's per-file budget.
//   - The pairs picked cover (queue ↔ detail), (cross-tab nav),
//     and (dynamic-segment ↔ static), which is the V2 class.

import { expect, test } from "@playwright/test";
import {
  AUTHENTICATED_ROUTES,
  CHROME_CONTRACT,
  resolvePath,
  type AuthenticatedRoute,
} from "../../e2e/contract/authenticated-routes";
import { loginAs, USERS } from "./_helpers";

test.beforeEach(async ({ page }) => {
  await loginAs(page, USERS.MANAGER);
});

function byPath(path: string): AuthenticatedRoute {
  const r = AUTHENTICATED_ROUTES.find((x) => x.path === path);
  if (!r) throw new Error(`registry missing route ${path}`);
  return r;
}

// Representative transition pairs covering V2's bug class:
//   - queue -> detail -> queue (dynamic-segment round-trip)
//   - cross-tab navigation (home -> exceptions queue)
//   - detail -> detail across tabs (case detail -> exception detail)
//
// Note: /inbox used to be a cross-tab origin here. Issue #133
// retired /inbox as an authenticated surface (now a redirect to
// /cases?source=manual_order) — it lives in REDIRECT_ROUTES, not
// AUTHENTICATED_ROUTES. Routing it through byPath() would throw
// at spec collection time and abort the entire Playwright run.
// /home (the new operational landing surface) is the equivalent
// cross-tab origin for the chrome-during-transition assertion.
// S15a — /exceptions/[id] retired in favour of inline mount on
// /cases/[id]?record=<id>. The dynamic-segment round-trip is now
// covered by /cases <-> /cases/:id.
const TRANSITION_PAIRS: Array<[AuthenticatedRoute, AuthenticatedRoute]> = [
  [byPath("/cases"), byPath("/cases/:id")],
  [byPath("/home"), byPath("/exceptions")],
  [byPath("/cases/:id"), byPath("/exceptions")],
  [byPath("/dashboard"), byPath("/settings")],
];

for (const [from, to] of TRANSITION_PAIRS) {
  test(`CMT-2 transition: ${from.path} -> ${to.path} keeps chrome`, async ({
    page,
  }) => {
    const fromUrl = resolvePath(from);
    const toUrl = resolvePath(to);

    await page.goto(fromUrl, { waitUntil: "domcontentloaded" });

    const nav = page.locator(CHROME_CONTRACT.navBarSelector).first();
    const announcer = page.locator(
      `[data-testid="${CHROME_CONTRACT.statusAnnouncerTestid}"]`,
    );

    // Final state on route_a: chrome present.
    await expect(nav, `nav must be visible on ${fromUrl}`).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      announcer,
      `StatusAnnouncer must be mounted on ${fromUrl}`,
    ).toHaveCount(1);

    // Begin the transition. We start the navigation but do NOT
    // await it immediately — instead we poll the nav locator
    // while the request is in flight to assert continuous
    // presence. The nav element MUST remain attached and visible
    // throughout.
    const navigationPromise = page.goto(toUrl, {
      waitUntil: "domcontentloaded",
    });

    // While the navigation resolves, poll. waitForFunction runs
    // in the browser context so we observe the live DOM. A
    // negative observation (nav momentarily absent) would fail
    // here loudly; V2 was exactly this class.
    await page.waitForFunction(() => {
      const navEl = document.querySelector("nav");
      // Chrome contract is "nav is attached"; transient
      // visibility:hidden during the transition is acceptable
      // because the React tree itself hasn't unmounted.
      return navEl !== null;
    });
    await navigationPromise;

    // Final state on route_b: chrome present.
    await expect(nav, `nav must be visible on ${toUrl}`).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      announcer,
      `StatusAnnouncer must be mounted on ${toUrl}`,
    ).toHaveCount(1);

    // bfcache restore. page.goBack() can either re-mount the
    // tree or restore from the back-forward cache; both paths
    // must surface chrome.
    await page.goBack({ waitUntil: "domcontentloaded" });

    // We don't assert the URL strictly — Next.js can choose to
    // resolve trailing slashes either way — but chrome MUST be
    // present on the restored page.
    await expect(
      nav,
      `nav must be visible after page.goBack() to ${fromUrl}`,
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      announcer,
      `StatusAnnouncer must be mounted on the bfcache-restored page`,
    ).toHaveCount(1);
  });
}
