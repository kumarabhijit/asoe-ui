/**
 * UserSwitcher — Sandbox-only user switching via server round-trip.
 *
 * Calls POST /api/auth/switch to get a new JWT for the target user,
 * then triggers a NextAuth re-login. Not a client-side localStorage
 * hack — the JWT is reissued by the server with the correct role,
 * permissions, tab visibility, and customer scope.
 *
 * Only rendered when NEXT_PUBLIC_ASOE_ENV !== "production".
 */
"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useAuth } from "@/hooks/useAuth";
import { authApi } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./DropdownMenu";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, Users, Shield, Headphones, UserCog } from "lucide-react";
import type { AuthUser } from "@/types/auth";

function roleIcon(roles: string[]) {
  if (roles.includes("admin")) return <Shield className="h-3.5 w-3.5" />;
  if (roles.includes("manager")) return <UserCog className="h-3.5 w-3.5" />;
  return <Headphones className="h-3.5 w-3.5" />;
}

export function UserSwitcher() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [switching, setSwitching] = useState(false);

  // Don't render in production
  const env = process.env.NEXT_PUBLIC_ASOE_ENV || "sandbox";
  const isSandbox = env !== "production";

  useEffect(() => {
    if (!isSandbox) return;
    authApi.listUsers().then((resp) => setUsers(resp.data)).catch(() => {});
  }, [isSandbox]);

  if (!isSandbox || users.length === 0 || !user) return null;

  async function handleSwitch(targetEmail: string) {
    if (targetEmail === user?.email || switching) return;
    setSwitching(true);
    try {
      // Re-login as the target user via NextAuth credentials flow.
      // This triggers a full server round-trip: new JWT with the
      // target user's role, permissions, tabs, and customer scope.
      await signIn("credentials", {
        email: targetEmail,
        password: "password", // V1 stub accepts any password
        redirect: false,
      });
      // Force a full page reload to pick up the new session
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-6 px-10 py-4 rounded-full",
            "bg-brand-subtle text-brand text-caption font-medium",
            "border border-brand-subtle cursor-pointer",
            "hover:bg-brand/10 transition-colors duration-fast",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
          )}
          aria-label={`Logged in as ${user.name}. Click to switch user.`}
          disabled={switching}
        >
          <span className="w-[22px] h-[22px] rounded-full bg-brand text-white flex items-center justify-center text-[10px] font-bold">
            {(user as AuthUser).avatar_initials || user.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
          </span>
          <span className="max-w-[120px] truncate">{user.name}</span>
          <span className="text-text-tertiary font-normal hidden sm:inline">
            {(user as AuthUser).title || user.roles?.join(", ")}
          </span>
          <ChevronDown className="h-3 w-3 text-text-tertiary" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-[280px]">
        <DropdownMenuLabel className="flex items-center gap-6">
          <Users className="h-3.5 w-3.5" />
          Switch User (Sandbox)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {users.map((u) => {
          const isActive = u.email === user.email;
          return (
            <DropdownMenuItem
              key={u.sub}
              onClick={() => handleSwitch(u.email)}
              className={cn(
                "flex items-center gap-8 py-6 cursor-pointer",
                isActive && "bg-brand-subtle",
              )}
              disabled={switching}
            >
              <span
                className={cn(
                  "w-[28px] h-[28px] rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                  isActive ? "bg-brand text-white" : "bg-surface-tertiary text-text-secondary",
                )}
              >
                {u.avatar_initials}
              </span>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-caption font-semibold text-text-primary truncate">
                  {u.name}
                </span>
                <span className="text-[11px] text-text-tertiary flex items-center gap-4">
                  {roleIcon(u.roles)}
                  {u.title}
                  {u.assigned_accounts.length > 0 && (
                    <span className="text-text-quaternary ml-2">
                      ({u.assigned_accounts.join(", ")})
                    </span>
                  )}
                </span>
              </div>
              {isActive && (
                <div className="flex items-center gap-4 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <Check className="h-3.5 w-3.5 text-brand" />
                </div>
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <div className="px-8 py-4">
          <p className="text-[10px] text-text-quaternary">
            User switching is sandbox-only. Each switch issues a new JWT.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
