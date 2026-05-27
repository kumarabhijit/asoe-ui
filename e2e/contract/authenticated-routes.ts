// Registry of routes that must render authenticated chrome.
//
// W6 amendment v1.2 (docs/test-strategy/e2e-flow-plan.md):
//
//   For each route in the registry, page.goto(route) and assert
//   AuthenticatedLayout testid + sign-out + user-menu render.
//   Plus CMT-2 transition + bfcache; plus CMT-3 boundary coverage
//   (loading.tsx / error.tsx / not-found.tsx).
//
// The registry is a plain TS export (not YAML) so the Playwright
// spec can import it and TypeScript catches stale route names at
// build time. A meta-test (T1) scans every src/app page.tsx and
// asserts every non-public page is either in this registry or in
// PUBLIC_ROUTES.
//
// D5 recon: asoe-ui does NOT (yet) have a single AuthenticatedLayout
// component. Chrome is provided per-page by <NavBar> + onSignOut.
// The chrome contract is therefore expressed as a set of selectors
// (NavBar surface + Sign-out menu item + StatusAnnouncer testid)
// until a layout component lands. When that refactor happens,
// add a layoutTestid to CHROME_CONTRACT and the Playwright spec
// follows automatically.

export interface AuthenticatedRoute {
  // URL path, with :id-style placeholders for dynamic segments.
  path: string;
  // Filesystem path to page.tsx, relative to the repo root.
  // Used by the meta-test to verify the registry covers every
  // non-public page.
  source: string;
  // If the path has dynamic segments, a known sample id the
  // Playwright spec can substitute for :id. Use a sandbox-mode
  // fixture id; never a production identifier.
  sampleParams?: Record<string, string>;
}

// Routes that are public — middleware in src/middleware.ts allows
// these without auth. They are NOT expected to render the
// authenticated chrome.
export const PUBLIC_ROUTES: readonly string[] = [
  "/login",
  "/auth/callback",
  // PARITY-3a — no-role-for-tenant landing page. Public because the
  // middleware redirects authenticated-but-unprivileged identities
  // here without forcing a sign-out; the route itself does not gate
  // on roles.
  "/403",
] as const;

// Routes whose source page.tsx exists but which do not host a
// persistent UI surface (redirect-only roots, etc.). The meta-test
// tolerates them outside the chrome registry.
export const REDIRECT_ROUTES: readonly string[] = [
  // src/app/page.tsx is a redirect to /home; no chrome of its own.
  "/",
  // Issue #133, PO #9 — `/inbox` is preserved as a server redirect
  // into `/cases?source=manual_order`. No chrome; the destination
  // page is the registered surface.
  "/inbox",
] as const;

export const AUTHENTICATED_ROUTES: readonly AuthenticatedRoute[] = [
  // Issue #133 (PO #5/#6) — operational landing surface.
  { path: "/home", source: "src/app/home/page.tsx" },
  // ADR-041 P4 (2026-05-13) — `/exceptions` retired (redirect to
  // `/cases`); the route files and CaseListPane were deleted. S15a
  // had already retired `/exceptions/[id]`. `/cases` is the single
  // canonical queue + workspace surface now.
  { path: "/cases", source: "src/app/cases/page.tsx" },
  {
    path: "/cases/:id",
    source: "src/app/cases/[id]/page.tsx",
    sampleParams: { id: "case-001" },
  },
  { path: "/dashboard", source: "src/app/dashboard/page.tsx" },
  { path: "/settings", source: "src/app/settings/page.tsx" },
] as const;

// The chrome contract every authenticated page must render.
//
// D5 (anchor on a layout component): when a single
// <AuthenticatedLayout> lands, add a layoutTestid here and the
// Playwright spec asserts the wrapping component directly. Until
// then we anchor on the NavBar selector pair — already enforced
// by tests/contract/test_navigation_chrome.test.ts.
export const CHROME_CONTRACT = {
  // Stable selector for the NavBar surface.
  navBarSelector: "nav",
  // Sign-out menu item label (case-insensitive substring).
  signOutLabel: /sign\s*out/i,
  // StatusAnnouncer testid — every authenticated route must mount
  // one (Q1) so flow YAML's assert_announcement_text works no
  // matter where the operator triggered the action from.
  statusAnnouncerTestid: "status-announcer",
} as const;

// Convenience: the path strings only.
export function authenticatedPaths(): string[] {
  return AUTHENTICATED_ROUTES.map((r) => r.path);
}

// Substitute :id-style placeholders with sample params, returning
// a concrete URL path the Playwright spec can navigate to.
export function resolvePath(route: AuthenticatedRoute): string {
  let resolved = route.path;
  if (route.sampleParams) {
    for (const [key, value] of Object.entries(route.sampleParams)) {
      resolved = resolved.replace(`:${key}`, value);
    }
  }
  return resolved;
}
