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
    expect(
      /\binbox\b[\s\S]{0,200}\/inbox/.test(src),
      `${rel} must map the "inbox" referrer to a /inbox back-target. ` +
        `See BACK_TARGETS in the page module.`,
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

describe("Inbox dispatch threads ?from=inbox into the URL (R3)", () => {
  const rel = "src/app/inbox/page.tsx";

  it("inbox row navigation includes ?from=inbox when an exception_id is present", () => {
    const src = read(rel);
    // Match the router.push call that opens an exception from the
    // inbox row. The pairing is: handleActivate → router.push with
    // the exception_id AND the referrer hint.
    const pushExceptionRe =
      /router\.push\(\s*[`'"]\s*\/exceptions\/\$\{[^}]+\}\?from=inbox/;
    expect(
      pushExceptionRe.test(src),
      `${rel} inbox-row dispatch must push to /exceptions/<id>?from=inbox so ` +
        `the detail page renders "Back to Inbox". Today the row jumps to ` +
        `/exceptions/<id> with no referrer and the operator can only get ` +
        `back to the queue, not back to the inbox.`,
    ).toBe(true);
  });
});

describe("ADR-034 inbox dispatch divergence is documented in code", () => {
  const rel = "src/app/inbox/page.tsx";

  it("inbox handler dispatches differently based on item.exception_id (intentional, ADR-034)", () => {
    const src = read(rel);
    // Two branches: with exception_id → router.push; without → setSelectedId.
    expect(
      /if\s*\(\s*item\.exception_id\s*\)\s*\{[\s\S]{0,400}router\.push/.test(src),
      `${rel} inbox dispatch must branch on item.exception_id and call ` +
        `router.push for items that carry one (ADR-034 Phase G).`,
    ).toBe(true);
    expect(
      /setSelectedId\s*\(\s*item\.id\s*\)/.test(src),
      `${rel} inbox dispatch must fall through to local selection ` +
        `(setSelectedId) for items without exception_id — that's the ` +
        `master-detail branch that keeps SHIPMENT_INQUIRY / ` +
        `INVOICE_QUERY / COMPLAINT items rendering in the right pane.`,
    ).toBe(true);
  });

  it("the divergence is justified by an explicit ADR-034 reference", () => {
    const src = read(rel);
    // Operators reading the file should immediately see WHY the two
    // inbox row clicks diverge. If a future refactor unifies them,
    // this test fails and forces an ADR update in the same PR.
    expect(
      /ADR-034/.test(src),
      `${rel} must cite ADR-034 next to the divergent dispatch handler. ` +
        `If you're unifying the behaviour, update the ADR + this test.`,
    ).toBe(true);
  });
});
