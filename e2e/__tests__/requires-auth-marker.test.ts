// Phase 5b — requiresAuth marker meta-test.
//
// Decision A4 from docs/test-strategy/e2e-flow-plan.md amendment
// v1.2: every authenticated page exports `requiresAuth = true`.
// This is a STRUCTURAL completeness check on top of the runtime
// chrome invariant. The runtime invariant catches behaviour
// (chrome renders); this marker catches "I added a new
// authenticated page but forgot to register it".
//
// Negative coverage matters too: public pages MUST NOT export
// requiresAuth = true. If a page accidentally inherits the
// marker (e.g. via a shared boilerplate that got pasted into
// /login), the auth contract becomes ambiguous.
//
// Why a separate test from the existing meta-test-self-check:
//   - meta-test-self-check asserts "every page.tsx is in the
//     registry or public/redirect"; that walks file paths.
//   - This test asserts the SOURCE-LEVEL marker exists. A
//     future route-group refactor (e.g. wrap all auth pages in
//     src/app/(authenticated)/) changes paths but not exports;
//     this test survives the refactor.
//
// Self-check fixture: a synthetic page source with and without
// the marker locks the regex detection logic.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUTHENTICATED_ROUTES,
  PUBLIC_ROUTES,
} from "../contract/authenticated-routes";

const REPO_ROOT = join(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf-8");
}

/** Returns true if the source declares `export const requiresAuth = true`
 *  at the start of a line (excludes commented-out declarations). */
export function hasRequiresAuthMarker(source: string): boolean {
  return /^[ \t]*export\s+const\s+requiresAuth\s*=\s*true\b/m.test(source);
}

describe("requiresAuth marker meta-test (Phase 5b)", () => {
  it("every authenticated page exports requiresAuth = true", () => {
    const offenders: string[] = [];
    for (const route of AUTHENTICATED_ROUTES) {
      const source = read(route.source);
      if (!hasRequiresAuthMarker(source)) {
        offenders.push(
          `${route.source} (${route.path}) missing 'export const requiresAuth = true'`,
        );
      }
    }
    expect(
      offenders,
      "authenticated pages must declare requiresAuth = true (A4)",
    ).toEqual([]);
  });

  it("public routes MUST NOT export requiresAuth = true", () => {
    // PUBLIC_ROUTES is a list of paths; we have to map them to
    // page.tsx files. The convention: /login -> src/app/login/page.tsx.
    const publicSources: Array<{ path: string; source: string }> = [];
    for (const path of PUBLIC_ROUTES) {
      // Strip leading slash, append /page.tsx.
      const filePath = `src/app${path}/page.tsx`;
      try {
        publicSources.push({ path, source: read(filePath) });
      } catch {
        // Some public paths (e.g. /api/auth) have no page.tsx,
        // they're served by route handlers. Skip — there's
        // nothing to assert against.
      }
    }
    const offenders: string[] = [];
    for (const { path, source } of publicSources) {
      if (hasRequiresAuthMarker(source)) {
        offenders.push(`${path} unexpectedly declares requiresAuth = true`);
      }
    }
    expect(
      offenders,
      "public routes must not declare requiresAuth",
    ).toEqual([]);
  });

  it("self-check: detection regex finds the marker", () => {
    const positive = "export const requiresAuth = true;";
    const positiveTyped = "export const requiresAuth: boolean = true;";
    // Type-annotated positive is intentionally NOT matched by
    // the strict regex — keeping the marker terse forces the
    // canonical idiom across the codebase.
    expect(hasRequiresAuthMarker(positive)).toBe(true);
    expect(hasRequiresAuthMarker(positiveTyped)).toBe(false);
  });

  it("self-check: detection regex rejects false negatives", () => {
    const negatives = [
      "const requiresAuth = true;", // missing export
      "export const requiresAuth = false;", // explicit opt-out
      "// export const requiresAuth = true;", // commented out
      "export default requiresAuth;", // not a marker
      "",
    ];
    for (const src of negatives) {
      expect(
        hasRequiresAuthMarker(src),
        `expected NO match for: ${JSON.stringify(src)}`,
      ).toBe(false);
    }
  });
});
