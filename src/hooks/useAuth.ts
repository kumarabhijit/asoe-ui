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
  // The backend-issued JWT lives on the session root, exposed by the
  // session callback in lib/auth.ts. The api client reads it via
  // getSession() at request time; consumers that need the value
  // synchronously (e.g. the WebSocket hook, which takes the token as
  // a connect-time arg) get it through this hook instead.
  const accessToken = (session as unknown as { accessToken?: string } | null)
    ?.accessToken;

  return {
    user,
    accessToken,
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
