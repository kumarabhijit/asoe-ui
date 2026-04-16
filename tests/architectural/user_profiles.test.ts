/**
 * User Profile Contract Tests — verifies server-side user profiles,
 * tab visibility derived from RBAC, account scoping, and type alignment.
 *
 * Tests the frontend implementation of:
 * - Tab visibility computed from permissions (mirrors api/users.py compute_visible_tabs)
 * - Mock user data consistency (5 users, correct roles, account IDs)
 * - AuthUser type has required fields for user profile features
 * - Account entity types on ExceptionSummary
 */

import { ROLE_PERMISSIONS, PERMISSIONS } from "@/lib/roles";
import type { AuthUser } from "@/types/auth";
import type { ExceptionSummary } from "@/types/exceptions";
import {
  ANALYST_USER,
  MANAGER_USER,
  ADMIN_USER,
  VIEWER_USER,
  PARTNER_USER,
} from "../fixtures";

// Mirror the backend's compute_visible_tabs logic for verification
function computeVisibleTabs(permissions: string[]): string[] {
  const ps = new Set(permissions);
  const tabs: string[] = [];
  if (ps.has("exceptions:read")) { tabs.push("inbox", "exceptions"); }
  if (ps.has("dashboard:read")) { tabs.push("dashboard"); }
  if (ps.has("rules:write") || ps.has("policy:write") || ps.has("users:manage")) { tabs.push("settings"); }
  return tabs;
}

describe("User Profile Contract — aligned with asoe2/api/users.py", () => {

  describe("Tab visibility derived from RBAC permissions", () => {
    it("admin sees all 4 tabs including settings", () => {
      const tabs = computeVisibleTabs(ROLE_PERMISSIONS.admin);
      expect(tabs).toContain("inbox");
      expect(tabs).toContain("exceptions");
      expect(tabs).toContain("dashboard");
      expect(tabs).toContain("settings");
    });

    it("manager sees settings (has rules:write)", () => {
      const tabs = computeVisibleTabs(ROLE_PERMISSIONS.manager);
      expect(tabs).toContain("settings");
    });

    it("analyst does not see settings", () => {
      const tabs = computeVisibleTabs(ROLE_PERMISSIONS.analyst);
      expect(tabs).not.toContain("settings");
      expect(tabs).toContain("inbox");
      expect(tabs).toContain("exceptions");
      expect(tabs).toContain("dashboard");
    });

    it("viewer does not see settings", () => {
      const tabs = computeVisibleTabs(ROLE_PERMISSIONS.viewer);
      expect(tabs).not.toContain("settings");
      expect(tabs).toContain("dashboard");
    });

    it("partner sees only inbox and exceptions (no dashboard)", () => {
      const tabs = computeVisibleTabs(ROLE_PERMISSIONS.partner);
      expect(tabs).toContain("inbox");
      expect(tabs).toContain("exceptions");
      expect(tabs).not.toContain("dashboard");
      expect(tabs).not.toContain("settings");
    });

    it("empty permissions → no tabs", () => {
      const tabs = computeVisibleTabs([]);
      expect(tabs).toHaveLength(0);
    });
  });

  describe("AuthUser fixture fields match backend UserProfile schema", () => {
    const fixtures: [string, AuthUser][] = [
      ["ANALYST_USER", ANALYST_USER],
      ["MANAGER_USER", MANAGER_USER],
      ["ADMIN_USER", ADMIN_USER],
      ["VIEWER_USER", VIEWER_USER],
      ["PARTNER_USER", PARTNER_USER],
    ];

    it.each(fixtures)("%s has required fields", (_name, user) => {
      expect(user.id).toBeDefined();
      expect(user.sub).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.roles).toBeDefined();
      expect(user.org).toBeDefined();
      expect(user.permissions).toBeDefined();
      expect(user.assigned_accounts).toBeDefined();
      expect(user.visible_tabs).toBeDefined();
    });

    it("assigned_accounts uses account IDs not names", () => {
      // Partner user has assigned_accounts with ID format
      expect(PARTNER_USER.assigned_accounts).toEqual(["acct-walmart"]);
      // Non-scoped users have empty array
      expect(ADMIN_USER.assigned_accounts).toEqual([]);
      expect(ANALYST_USER.assigned_accounts).toEqual([]);
    });

    it("visible_tabs are consistent with permissions", () => {
      // Admin: has all permissions → all tabs
      expect(ADMIN_USER.visible_tabs).toContain("settings");
      // Manager: has rules:write → settings
      expect(MANAGER_USER.visible_tabs).toContain("settings");
      // Analyst: no rules:write → no settings
      expect(ANALYST_USER.visible_tabs).not.toContain("settings");
      // Viewer: has dashboard:read → dashboard
      expect(VIEWER_USER.visible_tabs).toContain("dashboard");
    });
  });

  describe("ExceptionSummary account fields", () => {
    it("accepts account_id and account_name fields", () => {
      const exc: ExceptionSummary = {
        id: "exc-test",
        tenant_id: "t1",
        order_id: "PO-001",
        event_type: "EDI_850_PRICE_MISMATCH",
        lifecycle_state: "RESOLVED",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        account_id: "acct-walmart",
        account_name: "Walmart",
      };
      expect(exc.account_id).toBe("acct-walmart");
      expect(exc.account_name).toBe("Walmart");
    });

    it("account fields are optional (backward compat)", () => {
      const exc: ExceptionSummary = {
        id: "exc-test",
        tenant_id: "t1",
        order_id: "PO-001",
        event_type: "EDI_850_PRICE_MISMATCH",
        lifecycle_state: "RESOLVED",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };
      expect(exc.account_id).toBeUndefined();
      expect(exc.account_name).toBeUndefined();
    });
  });

  describe("AuthUser type includes user profile fields", () => {
    it("supports title and avatar_initials", () => {
      const user: AuthUser = {
        ...ADMIN_USER,
        title: "CS Manager",
        avatar_initials: "SC",
      };
      expect(user.title).toBe("CS Manager");
      expect(user.avatar_initials).toBe("SC");
    });

    it("supports auth_method including switch", () => {
      const user: AuthUser = {
        ...ADMIN_USER,
        auth_method: "switch",
      };
      expect(user.auth_method).toBe("switch");
    });
  });
});
