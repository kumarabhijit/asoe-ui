import type { AuthUser, Role } from "@/types/auth";

export const PERMISSIONS = {
  ORDERS_READ: "orders:read",
  ORDERS_APPROVE: "orders:approve",
  ORDERS_OVERRIDE: "orders:override",
  ORDERS_BULK: "orders:bulk",
  RULES_READ: "rules:read",
  RULES_WRITE: "rules:write",
  AGENT_CONFIG: "agent:config",
  USERS_MANAGE: "users:manage",
  AUDIT_READ: "audit:read",
} as const;

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  analyst: [
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_APPROVE,
    PERMISSIONS.ORDERS_OVERRIDE,
    PERMISSIONS.AUDIT_READ,
  ],
  manager: [
    PERMISSIONS.ORDERS_READ,
    PERMISSIONS.ORDERS_APPROVE,
    PERMISSIONS.ORDERS_OVERRIDE,
    PERMISSIONS.ORDERS_BULK,
    PERMISSIONS.RULES_READ,
    PERMISSIONS.RULES_WRITE,
    PERMISSIONS.AUDIT_READ,
  ],
  admin: Object.values(PERMISSIONS),
  viewer: [PERMISSIONS.ORDERS_READ, PERMISSIONS.AUDIT_READ],
  partner: [PERMISSIONS.ORDERS_READ],
};

export function hasRole(user: AuthUser | null, role: Role): boolean {
  return user?.roles.includes(role) ?? false;
}

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  return user?.permissions.includes(permission) ?? false;
}
