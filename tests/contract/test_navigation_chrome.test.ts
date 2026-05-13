// Spec-as-oracle: every authenticated page surface carries the
// canonical navigation chrome (NavBar with Sign out).
//
// Originally three regressions (R1/R2/R3) were locked here. R2/R3
// covered the `/exceptions/[id]` referrer dance — S15a retired that
// route in favour of the inline ribbon on `/cases/[id]?record=<id>`,
// so the referrer-back contract no longer applies. R1 (NavBar +
// useSignOut on every detail page) is the surviving lock.
//
// File-scan assertions — they run in plain vitest with no JSDOM/
// render plumbing and cannot be circumvented by a runtime
// conditional that only fires on a specific session shape.
// Compose them with the rendering tests under tests/components/
// (NavBar behaviour) and the Playwright suite (end-to-end flow).
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

describe("Authenticated detail pages render NavBar with Sign out (R1)", () => {
  for (const rel of [
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

    it(`${rel} sources a sign-out handler from useSignOut`, () => {
      // Phase 1 of the BDD plan moved the per-page inline
      // `() => signOut({ callbackUrl: "/login" })` into the
      // useSignOut hook so every sign-out path also fires a
      // StatusAnnouncer message (Q1). The contract is now:
      // import useSignOut + call it to obtain the handler.
      // The previous assertion (direct `signOut` import) was
      // an implementation detail; the structural contract is
      // unchanged — NavBar still receives a sign-out callback,
      // it just routes through the announcer-aware hook.
      const src = read(rel);
      expect(
        /import\s+\{[^}]*\buseSignOut\b[^}]*\}\s+from\s+["']@\/hooks\/useSignOut["']/.test(
          src,
        ),
        `${rel} must import useSignOut from @/hooks/useSignOut so sign-out announces via StatusAnnouncer (Q1)`,
      ).toBe(true);
      expect(
        /useSignOut\s*\(\s*\)/.test(src),
        `${rel} must call useSignOut() to obtain the handler`,
      ).toBe(true);
    });

    it(`${rel} passes the useSignOut handler to NavBar (Sign out menu item is gated on it)`, () => {
      const src = read(rel);
      expect(
        /onSignOut\s*=\s*\{[^}]*\}/.test(src),
        `${rel} must pass an onSignOut prop to NavBar. ` +
          `Without onSignOut the user-menu DropdownMenuItem renders nothing — ` +
          `see src/components/ui/NavBar.tsx:119 ("{onSignOut && ...}").`,
      ).toBe(true);
    });
  }
});

// R2/R3 (Exception detail ?from referrer) — retired by S15a together
// with `/exceptions/[id]`. The case-detail surface now hosts the
// per-record ribbon inline via `?record=<id>`; there is no second-
// detail-page hop and therefore no referrer to thread.

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
