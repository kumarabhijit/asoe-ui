/**
 * RBAC mirror parity lock — the UI's mock-layer mirrors of the backend
 * RBAC sources must not drift (Phase 4 gap closure, 2026-06-11).
 *
 * Two documented mirrors exist:
 *   * src/lib/roles.ts ROLE_PERMISSIONS ← asoe2/api/deps.py _ROLE_PERMISSIONS
 *   * src/lib/api.ts computeVisibleTabs ← asoe2/api/users.py
 *     _PERMISSION_TAB_MAP + compute_visible_tabs
 *
 * Both mirrors carry "aligned with asoe2" comments but had no drift
 * gate — a backend permission or tab-map change would silently leave
 * mock-mode RBAC (and therefore every mock-mode e2e) testing the wrong
 * policy. Same cross-repo source-parse pattern as
 * ws_payload_parity.test.ts; skipped when the sibling checkout is
 * absent (UI-only CI).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import { ROLE_PERMISSIONS } from "@/lib/roles";
import { computeVisibleTabs } from "@/lib/api";

const DEPS_PY = join(__dirname, "..", "..", "..", "asoe2", "api", "deps.py");
const USERS_PY = join(__dirname, "..", "..", "..", "asoe2", "api", "users.py");

const HAS_ASOE2 = existsSync(DEPS_PY) && existsSync(USERS_PY);

/** Parse `_ROLE_PERMISSIONS = { "role": ["perm", ...], ... }` from deps.py. */
function parseRolePermissions(src: string): Record<string, string[]> {
  const block = src.match(/_ROLE_PERMISSIONS = \{([\s\S]*?)\n\}/);
  expect(block, "_ROLE_PERMISSIONS dict not found in deps.py").not.toBeNull();
  const out: Record<string, string[]> = {};
  for (const m of block![1].matchAll(/"(\w+)":\s*\[([^\]]*)\]/g)) {
    out[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  }
  return out;
}

/** Parse `_PERMISSION_TAB_MAP = [ ("tab", ["perm", ...]), ... ]` from users.py. */
function parseTabMap(src: string): Array<[string, string[]]> {
  const block = src.match(/_PERMISSION_TAB_MAP[\s\S]*?\n\]/);
  expect(block, "_PERMISSION_TAB_MAP not found in users.py").not.toBeNull();
  return [...block![0].matchAll(/\("(\w+)",\s*\[([^\]]*)\]\)/g)].map((m) => [
    m[1],
    [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
  ]);
}

/** Reference implementation of users.py::compute_visible_tabs over the
 *  parsed tab map (any-of semantics: `perm_set & set(required)`). */
function backendVisibleTabs(
  tabMap: Array<[string, string[]]>,
  permissions: string[],
): string[] {
  const ps = new Set(permissions);
  return tabMap
    .filter(([, required]) => required.some((p) => ps.has(p)))
    .map(([tab]) => tab);
}

describe.skipIf(!HAS_ASOE2)("RBAC mirrors: asoe-ui ↔ asoe2", () => {
  const depsSrc = HAS_ASOE2 ? readFileSync(DEPS_PY, "utf-8") : "";
  const usersSrc = HAS_ASOE2 ? readFileSync(USERS_PY, "utf-8") : "";

  it("ROLE_PERMISSIONS mirrors deps.py per role (same roles, same permission sets)", () => {
    const backend = parseRolePermissions(depsSrc);
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(
      Object.keys(backend).sort(),
    );
    for (const [role, perms] of Object.entries(backend)) {
      expect(
        [...ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]].sort(),
        `permission set for role '${role}' drifted from deps.py`,
      ).toEqual([...perms].sort());
    }
  });

  it("computeVisibleTabs matches users.py tab map for every role's permissions", () => {
    const tabMap = parseTabMap(usersSrc);
    expect(tabMap.length).toBeGreaterThan(0);
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      expect(
        computeVisibleTabs(perms),
        `visible tabs for role '${role}' drifted from users.py`,
      ).toEqual(backendVisibleTabs(tabMap, perms));
    }
  });
});
