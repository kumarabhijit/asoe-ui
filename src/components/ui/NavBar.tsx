/**
 * NavBar — 56px glass surface with agent status pulse dot.
 * Section 11.2: Brand purple on logo only. Glass effect via backdrop-filter.
 */
"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { Badge } from "./Badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "./DropdownMenu";
import { ThemeToggle } from "./ThemeToggle";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavTab {
  id: string;
  label: string;
  href: string;
}

interface NavBarProps {
  tabs: NavTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  userName?: string;
  userInitials?: string;
  userTitle?: string;
  agentCount?: number;
  onSignOut?: () => void;
  className?: string;
}

export function NavBar({
  tabs,
  activeTab,
  onTabChange,
  userName,
  userInitials,
  userTitle,
  agentCount = 0,
  onSignOut,
  className,
}: NavBarProps) {
  return (
    <nav
      className={cn(
        "h-[var(--nav-height)] flex items-center px-24 bg-surface-glass backdrop-blur-glass border-b border-border sticky top-0 z-sticky gap-24",
        className,
      )}
    >
      {/* Logo — links to /home (issue #133, PO #5/#6). The link
          target is hard-coded rather than parameterised because
          "Home" is the canonical landing surface regardless of which
          tab subset the operator's role exposes. */}
      <Link href="/home" className="no-underline flex" aria-label="Home">
        <Logo size="sm" />
      </Link>

      {/* Tab Navigation */}
      <div className="flex items-center gap-4 flex-1 ml-16">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative bg-transparent border-none cursor-pointer px-12 py-8 text-body font-sans whitespace-nowrap transition-colors duration-fast",
                isActive
                  ? "font-semibold text-text-primary"
                  // Inactive tabs use text-secondary (#4A4A5A → 8.46:1 on
                  // page surface) rather than text-tertiary (#7E7E92 →
                  // 3.92:1, below WCAG AA small-text floor of 4.5:1).
                  // The active/inactive hierarchy is still clear via the
                  // font-weight delta (semibold vs medium).
                  : "font-medium text-text-secondary hover:text-text-primary",
              )}
            >
              {tab.label}
              {isActive && (
                <span className="absolute -bottom-px left-12 right-12 h-0.5 bg-brand rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Right section — system state, then personal controls */}
      <div className="flex items-center gap-12">
        {agentCount > 0 && (
          <Badge variant="brand" icon={<span className="agent-active-dot" />}>
            {agentCount} Agent{agentCount !== 1 ? "s" : ""} Live
          </Badge>
        )}

        <ThemeToggle />

        {/* User menu — name, title, sign out */}
        {userInitials && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="w-[32px] h-[32px] rounded-full bg-surface-tertiary flex items-center justify-center text-caption font-semibold text-text-secondary cursor-pointer border-none"
                aria-label="User menu"
              >
                {userInitials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              <DropdownMenuLabel>
                {userName || "User"}
                {userTitle && (
                  <span className="block text-[11px] font-normal text-text-tertiary">
                    {userTitle}
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onSignOut && (
                <DropdownMenuItem onClick={onSignOut}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}
