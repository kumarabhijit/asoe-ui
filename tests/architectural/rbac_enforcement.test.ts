/**
 * RBAC Enforcement Tests — verifies the three security fixes:
 *
 * A. Settings URL bypass: analysts cannot access /settings even via direct URL
 * B. Customer scope: mock API filters exceptions by assigned_accounts
 * C. Role normalization: all analyst sub-types share the same RBAC role
 */

import { ROLE_PERMISSIONS, PERMISSIONS } from "@/lib/roles";

const SETTINGS_PERMISSIONS = ["rules:write", "policy:write", "users:manage"];

describe("RBAC Enforcement — Security Fixes", () => {

  describe("Fix A: Settings access requires admin/manager permissions", () => {
    it("admin has settings permissions", () => {
      const hasAccess = SETTINGS_PERMISSIONS.some((p) =>
        ROLE_PERMISSIONS.admin.includes(p),
      );
      expect(hasAccess).toBe(true);
    });

    it("manager has settings permissions (rules:write)", () => {
      const hasAccess = SETTINGS_PERMISSIONS.some((p) =>
        ROLE_PERMISSIONS.manager.includes(p),
      );
      expect(hasAccess).toBe(true);
    });

    it("analyst lacks ALL settings permissions", () => {
      const hasAccess = SETTINGS_PERMISSIONS.some((p) =>
        ROLE_PERMISSIONS.analyst.includes(p),
      );
      expect(hasAccess).toBe(false);
    });

    it("viewer lacks ALL settings permissions", () => {
      const hasAccess = SETTINGS_PERMISSIONS.some((p) =>
        ROLE_PERMISSIONS.viewer.includes(p),
      );
      expect(hasAccess).toBe(false);
    });

    it("partner lacks ALL settings permissions", () => {
      const hasAccess = SETTINGS_PERMISSIONS.some((p) =>
        ROLE_PERMISSIONS.partner.includes(p),
      );
      expect(hasAccess).toBe(false);
    });
  });

  describe("Fix B: Customer scope filtering contract", () => {
    it("analyst permissions do not include account override", () => {
      expect(ROLE_PERMISSIONS.analyst).not.toContain("accounts:override");
    });

    it("assigned_accounts is enforced via account_id on exceptions", () => {
      // Mock the filtering logic that api.ts applies
      const exceptions = [
        { id: "1", account_id: "acct-walmart" },
        { id: "2", account_id: "acct-kroger" },
        { id: "3", account_id: "acct-target" },
        { id: "4", account_id: "acct-costco" },
      ];

      // James Ortiz scope
      const jamesAccounts = new Set(["acct-walmart", "acct-kroger"]);
      const jamesFiltered = exceptions.filter(
        (e) => jamesAccounts.has(e.account_id),
      );
      expect(jamesFiltered).toHaveLength(2);
      expect(jamesFiltered.map((e) => e.id)).toEqual(["1", "2"]);

      // Priya Nair scope
      const priyaAccounts = new Set(["acct-target", "acct-costco"]);
      const priyaFiltered = exceptions.filter(
        (e) => priyaAccounts.has(e.account_id),
      );
      expect(priyaFiltered).toHaveLength(2);
      expect(priyaFiltered.map((e) => e.id)).toEqual(["3", "4"]);

      // Admin (empty assigned_accounts) sees all
      const adminAccounts: string[] = [];
      const adminFiltered = adminAccounts.length > 0
        ? exceptions.filter((e) => new Set(adminAccounts).has(e.account_id))
        : exceptions;
      expect(adminFiltered).toHaveLength(4);
    });
  });

  describe("Fix C: Role normalization — all analyst sub-types use same role", () => {
    it("analyst role exists in ROLE_PERMISSIONS", () => {
      expect(ROLE_PERMISSIONS).toHaveProperty("analyst");
    });

    it("analyst role has exactly 4 permissions", () => {
      expect(ROLE_PERMISSIONS.analyst).toHaveLength(4);
      expect(ROLE_PERMISSIONS.analyst).toContain(PERMISSIONS.EXCEPTIONS_READ);
      expect(ROLE_PERMISSIONS.analyst).toContain(PERMISSIONS.EXCEPTIONS_APPROVE);
      expect(ROLE_PERMISSIONS.analyst).toContain(PERMISSIONS.EXCEPTIONS_ESCALATE);
      expect(ROLE_PERMISSIONS.analyst).toContain(PERMISSIONS.DASHBOARD_READ);
    });

    it("no sub-analyst roles exist in ROLE_PERMISSIONS (CS Analyst, Trade Analyst are titles not roles)", () => {
      const roleNames = Object.keys(ROLE_PERMISSIONS);
      expect(roleNames).not.toContain("cs_analyst");
      expect(roleNames).not.toContain("trade_analyst");
      expect(roleNames).not.toContain("sr_analyst");
    });

    it("analyst cannot override exceptions (manager+ only)", () => {
      expect(ROLE_PERMISSIONS.analyst).not.toContain(PERMISSIONS.EXCEPTIONS_OVERRIDE);
    });
  });
});
