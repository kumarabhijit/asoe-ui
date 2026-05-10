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

describe("Inbox row dispatch is consistent master-detail (R3 — ADR-034 §6.1)", () => {
  const rel = "src/app/inbox/page.tsx";

  it("inbox handleActivate selects locally for every row (no router.push in the row dispatch)", () => {
    const src = read(rel);
    // Capture the body of handleActivate. ADR-034 §6.1 (PO ruling
    // 2026-05-10) requires a single, branch-free dispatch:
    //   const handleActivate = () => { setSelectedId(item.id); };
    // No router.push, no exception_id branch — the right-pane jump
    // button is the only place that navigates off the inbox surface.
    const m = src.match(
      /const\s+handleActivate\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\};/,
    );
    expect(m, `${rel} must declare a handleActivate row handler`).not.toBeNull();
    const body = m![1];
    expect(
      /setSelectedId\s*\(\s*item\.id\s*\)/.test(body),
      `${rel} handleActivate must call setSelectedId(item.id) — the ` +
        `consistent master-detail dispatch decided in ADR-034 §6.1.`,
    ).toBe(true);
    expect(
      /router\.push/.test(body),
      `${rel} handleActivate must NOT call router.push. Per ADR-034 §6.1 ` +
        `(2026-05-10 PO ruling), navigation off the inbox surface is an ` +
        `explicit operator action via the "Open in Exception Queue" jump ` +
        `button on the right pane — not a side effect of clicking a row.`,
    ).toBe(false);
  });

  it("right-pane detail renders an Open-in-Exception-Queue jump button when selected.exception_id is set", () => {
    const src = read(rel);
    // The jump button is gated on selected.exception_id and pushes
    // /exceptions/<id>?from=inbox so the detail page back-targets
    // "/inbox" via the BACK_TARGETS whitelist.
    expect(
      /selected\.exception_id\s*&&/.test(src),
      `${rel} right pane must conditionally render content gated on ` +
        `selected.exception_id (the jump-button section).`,
    ).toBe(true);
    expect(
      /Open\s+in\s+Exception\s+Queue/i.test(src),
      `${rel} right pane must render an "Open in Exception Queue" button ` +
        `label so the operator has an explicit jump affordance.`,
    ).toBe(true);
    expect(
      /router\.push\(\s*[`'"]\s*\/exceptions\/\$\{\s*selected\.exception_id\s*\}\?from=inbox/.test(
        src,
      ),
      `${rel} the jump button must push /exceptions/<id>?from=inbox so ` +
        `the detail page renders "Back to Inbox" via BACK_TARGETS in ` +
        `src/app/exceptions/[id]/page.tsx.`,
    ).toBe(true);
  });

  it("the supersession is justified by an explicit ADR-034 reference", () => {
    const src = read(rel);
    expect(
      /ADR-034/.test(src),
      `${rel} must cite ADR-034 next to the inbox dispatch + jump button. ` +
        `If you're changing the behaviour, update the ADR + this test in ` +
        `the same PR.`,
    ).toBe(true);
  });
});
