/**
 * T1 -- meta-test self-check.
 *
 * The chrome-invariant Playwright spec iterates the registry in
 * e2e/contract/authenticated-routes.ts. The registry is the
 * single source of truth -- but a future page.tsx could land
 * under src/app/** without being added to the registry, and
 * the chrome invariant would silently skip it.
 *
 * This meta-test scans src/app/**\/page.tsx and asserts every
 * page is accounted for: either in the authenticated registry,
 * in PUBLIC_ROUTES (login / callback), or in REDIRECT_ROUTES
 * (root redirect to /inbox). Anything else fails loud.
 *
 * Per docs/test-strategy/e2e-flow-plan.md (Failure modes):
 *   "Refactor renames the component, registry reference stale --
 *    TypeScript import in the test file fails to resolve -> hard
 *    error at CI."
 *
 * The fixture self-check at the bottom of the file deliberately
 * introduces a fake page.tsx outside the registry and asserts
 * the same scanning logic would surface it. This locks the meta-
 * test against silent regressions where it walks an empty list
 * and reports green.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  AUTHENTICATED_ROUTES,
  PUBLIC_ROUTES,
  REDIRECT_ROUTES,
} from "../contract/authenticated-routes";

const REPO_ROOT = join(__dirname, "..", "..");
const APP_ROOT = join(REPO_ROOT, "src", "app");

/**
 * Walk a directory recursively and return the relative paths of
 * every page.tsx file. Hand-rolled walker rather than fast-glob to
 * avoid pulling in another dependency for one call site.
 */
function findPages(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        // Skip Next.js parallel-route folders (not used here, but
        // future-proof) and route-group folders are still walked.
        walk(full);
      } else if (entry === "page.tsx") {
        out.push(relative(REPO_ROOT, full).split(sep).join("/"));
      }
    }
  }
  walk(root);
  return out;
}

/**
 * Convert src/app/foo/[id]/page.tsx to /foo/:id.
 * src/app/page.tsx -> /.
 * Route groups (group)/ are stripped (they do not appear in URLs).
 */
export function pathFromSource(rel: string): string {
  const trimmed = rel
    .replace(/^src\/app\//, "")
    .replace(/(^|\/)page\.tsx$/, "");
  if (trimmed === "") return "/";
  const segments = trimmed
    .split("/")
    .filter((seg) => seg !== "")
    // Drop Next.js route-group folders, e.g. (authenticated)/.
    .filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")))
    .map((seg) =>
      seg.startsWith("[") && seg.endsWith("]")
        ? `:${seg.slice(1, -1)}`
        : seg,
    );
  if (segments.length === 0) return "/";
  return "/" + segments.join("/");
}

describe("auth-route-coverage meta-test", () => {
  const pageFiles = findPages(APP_ROOT);

  it("finds at least one page.tsx (sanity)", () => {
    expect(pageFiles.length).toBeGreaterThan(0);
  });

  it("every src/app/**/page.tsx is in the registry, public, or redirect-only", () => {
    const authPaths = new Set(AUTHENTICATED_ROUTES.map((r) => r.path));
    const publicPaths = new Set(PUBLIC_ROUTES);
    const redirectPaths = new Set(REDIRECT_ROUTES);

    const orphans: string[] = [];
    for (const rel of pageFiles) {
      const path = pathFromSource(rel);
      const accountedFor =
        authPaths.has(path) ||
        publicPaths.has(path) ||
        redirectPaths.has(path) ||
        // Allow public paths matched by prefix (e.g. nested /auth/callback subpages).
        Array.from(publicPaths).some(
          (p) => path === p || path.startsWith(`${p}/`),
        );
      if (!accountedFor) orphans.push(`${rel} -> ${path}`);
    }

    expect(orphans, "page.tsx files missing from authenticated-routes registry").toEqual(
      [],
    );
  });

  it("every AUTHENTICATED_ROUTES.source file actually exists on disk", () => {
    const missing: string[] = [];
    for (const route of AUTHENTICATED_ROUTES) {
      try {
        const stat = statSync(join(REPO_ROOT, route.source));
        if (!stat.isFile()) missing.push(route.source);
      } catch {
        missing.push(route.source);
      }
    }
    expect(missing, "registry references nonexistent page.tsx").toEqual([]);
  });

  it("dynamic-segment routes declare sampleParams", () => {
    const offenders: string[] = [];
    for (const route of AUTHENTICATED_ROUTES) {
      const dynamicSegments = (route.path.match(/:([a-zA-Z]+)/g) || []).map(
        (s) => s.slice(1),
      );
      if (dynamicSegments.length === 0) continue;
      for (const seg of dynamicSegments) {
        if (!route.sampleParams || !(seg in route.sampleParams)) {
          offenders.push(`${route.path} missing sampleParams.${seg}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // ──────────────────────────────────────────────────────────────
  // Self-check fixture: assert the scanner would catch a missing
  // registry entry. Locks the meta-test against silent regressions
  // where a future refactor turns it into a no-op.
  // ──────────────────────────────────────────────────────────────
  it("scanner flags an orphaned page.tsx in a fixture directory", () => {
    const fixtureRoot = join(__dirname, "fixtures", "fake-app");
    const fakePages = findPages(fixtureRoot);
    expect(fakePages.length).toBeGreaterThan(0);

    const authPaths = new Set(AUTHENTICATED_ROUTES.map((r) => r.path));
    const publicPaths = new Set(PUBLIC_ROUTES);

    // Map fixture pages relative to the fixture root, mirroring the
    // production scanner so paths resolve to /forgotten-flow not
    // /e2e/__tests__/.../forgotten-flow.
    const fixtureRelative = fakePages.map((rel) => {
      const idx = rel.indexOf("fake-app/");
      return rel.slice(idx + "fake-app/".length).replace(/^/, "src/app/");
    });

    const orphans = fixtureRelative
      .map((rel) => ({ rel, path: pathFromSource(rel) }))
      .filter(
        ({ path }) => !authPaths.has(path) && !publicPaths.has(path),
      );

    // The fixture is intentionally orphaned — the scanner must see it.
    // If this assertion ever flips, the scanner has been broken and
    // the production assertion above would silently pass.
    expect(orphans.length).toBeGreaterThan(0);
    expect(orphans[0].path).toBe("/forgotten-flow");
  });
});

describe("pathFromSource", () => {
  it("converts simple page.tsx to its route", () => {
    expect(pathFromSource("src/app/inbox/page.tsx")).toBe("/inbox");
  });
  it("strips dynamic segments to colon-prefixed params", () => {
    expect(pathFromSource("src/app/exceptions/[id]/page.tsx")).toBe(
      "/exceptions/:id",
    );
  });
  it("treats the root page.tsx as /", () => {
    expect(pathFromSource("src/app/page.tsx")).toBe("/");
  });
});
