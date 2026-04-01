"use client";

import { useSession } from "next-auth/react";
import type { Role } from "@/types/auth";

interface ExtendedUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  roles?: Role[];
  org?: string;
  permissions?: string[];
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
  };
}
