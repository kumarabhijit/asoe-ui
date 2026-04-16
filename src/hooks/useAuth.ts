"use client";

import { useSession } from "next-auth/react";
import type { Role } from "@/types/auth";

interface ExtendedUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  title?: string;
  avatar_initials?: string;
  roles?: Role[];
  org?: string;
  permissions?: string[];
  assigned_accounts?: string[];
  visible_tabs?: string[];
}

export function useAuth() {
  const { data: session, status } = useSession();
  const user = session?.user as ExtendedUser | undefined;

  return {
    user,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    hasRole: (role: Role) => user?.roles?.includes(role) ?? false,
    hasPermission: (perm: string) => user?.permissions?.includes(perm) ?? false,
    /** Tabs the user can see — derived from RBAC permissions by the backend. */
    visibleTabs: user?.visible_tabs ?? [],
    /** Customer accounts this user is scoped to — empty means all. */
    assignedAccounts: user?.assigned_accounts ?? [],
  };
}
