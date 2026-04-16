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
      {/* Logo — links to home */}
      <Link href="/inbox" className="no-underline flex">
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
                  : "font-medium text-text-tertiary hover:text-text-secondary",
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

      {/* Right section */}
      <div className="flex items-center gap-16">
        {agentCount > 0 && (
          <Badge variant="brand" icon={<span className="agent-active-dot" />}>
            {agentCount} Agent{agentCount !== 1 ? "s" : ""} Live
          </Badge>
        )}

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
