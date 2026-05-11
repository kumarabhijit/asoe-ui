/**
 * Spec-as-oracle: every authenticated page surface carries the
 * canonical navigation chrome (NavBar with Sign out) AND honours
 * its referrer when rendering a Back button.
 *
 * Three regressions surfaced in operator review prompted these tests:
 *
 *   R1. `/exceptions/[id]` and `/cases/[id]` rendered without the
 *       `Sign out` menu item — operators on a detail page had no
 *       canonical exit point. NavBar must always be rendered AND
 *       must receive an `onSignOut` callback (the menu item only
 *       renders when the prop is present, see
 *       src/components/ui/NavBar.tsx:119).
 *
 *   R2. `/exceptions/[id]` always navigated Back → /exceptions
 *       even when the operator arrived from /inbox (Email Order
 *       Entry inbox row, ADR-034 Phase G dispatch). The detail
 *       page must read a referrer hint and route back to the
 *       originating surface.
 *
 *   R3. The inbox row that produces the dispatch must thread the
 *       referrer hint through. Without this pairing, R2's fix is
 *       inert.
 *
 * These are file-scan assertions — they run in plain vitest with
 * no JSDOM/render plumbing and they cannot be circumvented by a
 * runtime conditional that only fires on a specific session shape.
 * Compose them with the rendering tests under tests/components/
 * (NavBar behaviour) and the Playwright suite (end-to-end flow).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

describe("Authenticated detail pages render NavBar with Sign out (R1)", () => {
  for (const rel of [
    "src/app/exceptions/[id]/page.tsx",
    "src/app/cases/[id]/page.tsx",
  ]) {
    it(`${rel} imports NavBar`, () => {
      const src = read(rel);
      expect(
        /import\s+\{[^}]*\bNavBar\b[^}]*\}\s+from\s+["']@\/components\/ui\/NavBar["']/.test(src),
        `${rel} must import NavBar from @/components/ui/NavBar`,
      ).toBe(true);
    });

    it(`${rel} renders <NavBar ...>`, () => {
      const src = read(rel);
      expect(/<NavBar\b/.test(src), `${rel} must render <NavBar />`).toBe(true);
    });

    it(`${rel} imports signOut from next-auth/react`, () => {
      const src = read(rel);
      expect(
        /import\s+\{[^}]*\bsignOut\b[^}]*\}\s+from\s+["']next-auth\/react["']/.test(src),
        `${rel} must import signOut to wire onSignOut on NavBar`,
      ).toBe(true);
    });

    it(`${rel} passes onSignOut to NavBar (Sign out menu item is gated on it)`, () => {
      const src = read(rel);
      expect(
        /onSignOut\s*=\s*\{[\s\S]*?signOut\s*\(/.test(src),
        `${rel} must pass an onSignOut callback that invokes signOut(). ` +
          `Without onSignOut the user-menu DropdownMenuItem renders nothing — ` +
          `see src/components/ui/NavBar.tsx:119 ("{onSignOut && ...}").`,
      ).toBe(true);
    });
  }
});

describe("Exception detail page honours ?from referrer (R2)", () => {
  const rel = "src/app/exceptions/[id]/page.tsx";

  it("reads ?from via useSearchParams", () => {
    const src = read(rel);
    expect(
      /import\s+\{[^}]*\buseSearchParams\b[^}]*\}\s+from\s+["']next\/navigation["']/.test(src),
      `${rel} must import useSearchParams to read the referrer hint`,
    ).toBe(true);
    expect(
      /useSearchParams\s*\(\s*\)/.test(src),
      `${rel} must call useSearchParams()`,
    ).toBe(true);
    expect(
      /\.get\(\s*["']from["']\s*\)/.test(src),
      `${rel} must read the "from" query parameter`,
    ).toBe(true);
  });

  it("declares an inbox-aware Back target", () => {
    const src = read(rel);
    // Issue #133, PO #9 — `/inbox` now redirects into the case-list
    // view, so the "inbox" referrer points at `/cases?source=manual_order`.
    // The back-target alias remains so deep links from notification
    // emails keep working; the destination is just rewritten.
    expect(
      /\binbox\b[\s\S]{0,200}\/cases\?source=manual_order/.test(src),
      `${rel} must map the "inbox" referrer to the case-list filtered ` +
        `view (post issue #133). See BACK_TARGETS in the page module.`,
    ).toBe(true);
  });

  it("retains the default Back-to-Queue target for unknown referrers", () => {
    const src = read(rel);
    expect(
      /\/exceptions\b/.test(src),
      `${rel} must keep "/exceptions" as the default back href`,
    ).toBe(true);
    expect(
      /Back\s+to\s+Queue/i.test(src),
      `${rel} must keep the "Back to Queue" label as the default`,
    ).toBe(true);
  });
});

describe("/inbox is a server redirect into the case-list view (issue #133, PO #9)", () => {
  const rel = "src/app/inbox/page.tsx";

  // The 2026-05 PO review (kumarabhijit/asoe2#133, PO #9) flagged
  // `/inbox` and `/cases` as redundant — both projected the same
  // case-list shape. Post-#133, `/inbox` is a thin server redirect
  // into `/cases?source=manual_order`. The contract is therefore
  // about the *absence* of UI behaviour: no client state, no row
  // dispatch, no jump button — Next's `redirect()` runs on the
  // server. Deep links from emails / runbooks continue to land
  // operators in the right case view via the redirect.

  it("emits a server redirect to the filtered case-list view", () => {
    const src = read(rel);
    expect(
      /from\s+["']next\/navigation["']/.test(src),
      `${rel} must import from next/navigation (server redirect API).`,
    ).toBe(true);
    expect(
      /\bredirect\s*\(\s*["']\/cases\?source=manual_order["']\s*\)/.test(src),
      `${rel} must redirect into /cases?source=manual_order. ` +
        `Issue #133 / PO #9 retired the parallel /inbox surface.`,
    ).toBe(true);
  });

  it("has no client-side state, handlers, or row dispatch", () => {
    const src = read(rel);
    // The redirect-only file must not retain V5.1.1 master-detail
    // machinery; if a future refactor re-introduces a client surface
    // on /inbox without retiring this contract, the test below fires.
    expect(
      /\"use client\"/.test(src),
      `${rel} must not declare "use client" — it is a server redirect.`,
    ).toBe(false);
    expect(
      /useState\b|useRouter\b|setSelectedId\b/.test(src),
      `${rel} must not retain client-side hooks or row state. The ` +
        `case-list view lives at /cases; /inbox just redirects to it.`,
    ).toBe(false);
  });

  it("the redirect is justified by an explicit issue-133 reference", () => {
    const src = read(rel);
    expect(
      /issue\s*#?133/i.test(src),
      `${rel} must cite issue #133 next to the redirect declaration. ` +
        `If a future PR re-introduces a separate /inbox surface, the ` +
        `comment trail must reference the PO conversation that retired it.`,
    ).toBe(true);
  });
});
