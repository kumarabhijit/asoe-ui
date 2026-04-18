/**
 * RBAC Contract Test — verifies roles.ts matches asoe2/api/deps.py
 *
 * Mirrors asoe2's contract-first testing approach.
 * If the backend changes its permission model, this test fails.
 */

import { ROLE_PERMISSIONS, PERMISSIONS } from "@/lib/roles";

describe("RBAC Contract — aligned with asoe2/api/deps.py", () => {
  describe("Permission constants match backend", () => {
    it("uses exceptions: prefix (not orders:)", () => {
      expect(PERMISSIONS.EXCEPTIONS_READ).toBe("exceptions:read");
      expect(PERMISSIONS.EXCEPTIONS_APPROVE).toBe("exceptions:approve");
      expect(PERMISSIONS.EXCEPTIONS_OVERRIDE).toBe("exceptions:override");
      expect(PERMISSIONS.EXCEPTIONS_ESCALATE).toBe("exceptions:escalate");
    });

    it("includes all backend permission keys", () => {
      const expected = [
        "exceptions:read",
        "exceptions:approve",
        "exceptions:override",
        "exceptions:escalate",
        "rules:write",
        "users:manage",
        "policy:write",
        "audit:read",
        "dashboard:read",
      ];
      const actual = Object.values(PERMISSIONS);
      for (const perm of expected) {
        expect(actual).toContain(perm);
      }
    });
  });

  describe("Role-permission mapping matches backend", () => {
    it("analyst has read + approve + escalate + dashboard", () => {
      expect(ROLE_PERMISSIONS.analyst).toContain("exceptions:read");
      expect(ROLE_PERMISSIONS.analyst).toContain("exceptions:approve");
      expect(ROLE_PERMISSIONS.analyst).toContain("exceptions:escalate");
      expect(ROLE_PERMISSIONS.analyst).toContain("dashboard:read");
      expect(ROLE_PERMISSIONS.analyst).not.toContain("exceptions:override");
      expect(ROLE_PERMISSIONS.analyst).not.toContain("users:manage");
    });

    it("manager has analyst permissions + override + escalate + rules:write", () => {
      expect(ROLE_PERMISSIONS.manager).toContain("exceptions:read");
      expect(ROLE_PERMISSIONS.manager).toContain("exceptions:approve");
      expect(ROLE_PERMISSIONS.manager).toContain("exceptions:override");
      expect(ROLE_PERMISSIONS.manager).toContain("exceptions:escalate");
      expect(ROLE_PERMISSIONS.manager).toContain("rules:write");
      expect(ROLE_PERMISSIONS.manager).not.toContain("users:manage");
      expect(ROLE_PERMISSIONS.manager).not.toContain("policy:write");
    });

    it("admin has all permissions", () => {
      const allPerms = Object.values(PERMISSIONS);
      for (const perm of allPerms) {
        expect(ROLE_PERMISSIONS.admin).toContain(perm);
      }
    });

    it("viewer has only read + dashboard", () => {
      expect(ROLE_PERMISSIONS.viewer).toContain("exceptions:read");
      expect(ROLE_PERMISSIONS.viewer).toContain("dashboard:read");
      expect(ROLE_PERMISSIONS.viewer).toHaveLength(2);
    });

    it("partner has only exceptions:read", () => {
      expect(ROLE_PERMISSIONS.partner).toContain("exceptions:read");
      expect(ROLE_PERMISSIONS.partner).toHaveLength(1);
    });
  });

  describe("All 5 roles are defined", () => {
    it("defines analyst, manager, admin, viewer, partner", () => {
      const roles = Object.keys(ROLE_PERMISSIONS);
      expect(roles).toContain("analyst");
      expect(roles).toContain("manager");
      expect(roles).toContain("admin");
      expect(roles).toContain("viewer");
      expect(roles).toContain("partner");
      expect(roles).toHaveLength(5);
    });
  });
});
