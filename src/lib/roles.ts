/**
 * RBAC permissions — aligned with asoe2/api/deps.py _ROLE_PERMISSIONS
 *
 * Permission format: {resource}:{action} per Section 9.2
 */
import type { AuthUser, Role } from "@/types/auth";

export const PERMISSIONS = {
  EXCEPTIONS_READ: "exceptions:read",
  EXCEPTIONS_APPROVE: "exceptions:approve",
  EXCEPTIONS_OVERRIDE: "exceptions:override",
  EXCEPTIONS_ESCALATE: "exceptions:escalate",
  RULES_WRITE: "rules:write",
  USERS_MANAGE: "users:manage",
  POLICY_WRITE: "policy:write",
  AUDIT_READ: "audit:read",
  DASHBOARD_READ: "dashboard:read",
} as const;

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  analyst: [
    PERMISSIONS.EXCEPTIONS_READ,
    PERMISSIONS.EXCEPTIONS_APPROVE,
    PERMISSIONS.EXCEPTIONS_ESCALATE,
    PERMISSIONS.DASHBOARD_READ,
  ],
  manager: [
    PERMISSIONS.EXCEPTIONS_READ,
    PERMISSIONS.EXCEPTIONS_APPROVE,
    PERMISSIONS.EXCEPTIONS_OVERRIDE,
    PERMISSIONS.EXCEPTIONS_ESCALATE,
    PERMISSIONS.RULES_WRITE,
    PERMISSIONS.DASHBOARD_READ,
  ],
  admin: [
    PERMISSIONS.EXCEPTIONS_READ,
    PERMISSIONS.EXCEPTIONS_APPROVE,
    PERMISSIONS.EXCEPTIONS_OVERRIDE,
    PERMISSIONS.EXCEPTIONS_ESCALATE,
    PERMISSIONS.RULES_WRITE,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.POLICY_WRITE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.DASHBOARD_READ,
  ],
  viewer: [
    PERMISSIONS.EXCEPTIONS_READ,
    PERMISSIONS.DASHBOARD_READ,
  ],
  partner: [
    PERMISSIONS.EXCEPTIONS_READ,
  ],
};

export function hasRole(user: AuthUser | null, role: Role): boolean {
  return user?.roles.includes(role) ?? false;
}

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return user?.permissions.includes(permission) ?? false;
}
