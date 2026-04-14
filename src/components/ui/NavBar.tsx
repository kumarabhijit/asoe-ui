/**
 * NavBar — 56px glass surface with agent status pulse dot.
 * Section 11.2: Brand purple on logo only. Glass effect via backdrop-filter.
 */
"use client";

import { useState } from "react";
import { Logo } from "./Logo";
import { Badge } from "./Badge";
import { LogOut, Settings } from "lucide-react";
import type { ReactNode, CSSProperties } from "react";

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
  agentCount?: number;
  onSignOut?: () => void;
  onSettingsClick?: () => void;
  style?: CSSProperties;
  rightContent?: ReactNode;
}

export function NavBar({
  tabs,
  activeTab,
  onTabChange,
  userName,
  userInitials,
  agentCount = 0,
  onSignOut,
  onSettingsClick,
  style,
  rightContent,
}: NavBarProps) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  return (
    <nav
      style={{
        height: "var(--nav-height)",
        display: "flex",
        alignItems: "center",
        padding: "0 var(--space-24)",
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--color-border-default)",
        position: "sticky",
        top: 0,
        zIndex: "var(--z-nav)",
        gap: "var(--space-24)",
        ...style,
      }}
    >
      {/* Logo */}
      <Logo size="sm" />

      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          flex: 1,
          marginLeft: "var(--space-16)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isHovered = hoveredTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
              aria-current={isActive ? "page" : undefined}
              style={{
                position: "relative",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "var(--space-8) var(--space-12)",
                fontSize: "var(--font-size-body)",
                fontWeight: isActive ? 600 : 500,
                fontFamily: "var(--font-sans)",
                color: isActive
                  ? "var(--color-text-primary)"
                  : isHovered
                  ? "var(--color-text-secondary)"
                  : "var(--color-text-tertiary)",
                transition: "color var(--dur-fast)",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
              {/* Active underline — brand purple per Section 11.3 */}
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    bottom: -1,
                    left: "var(--space-12)",
                    right: "var(--space-12)",
                    height: 2,
                    background: "var(--color-brand)",
                    borderRadius: 1,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Right section */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-16)" }}>
        {/* Agent status */}
        {agentCount > 0 && (
          <Badge variant="brand" icon={<span className="agent-active-dot" />}>
            {agentCount} Agent{agentCount !== 1 ? "s" : ""} Live
          </Badge>
        )}

        {rightContent}

        {/* Settings icon */}
        <button
          onClick={onSettingsClick}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-tertiary)",
            padding: "var(--space-6)",
            display: "flex",
            borderRadius: "var(--radius-sm)",
            transition: "color var(--dur-fast)",
          }}
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>

        {/* User avatar */}
        {userInitials && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-8)",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-full)",
                background: "var(--color-surface-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "var(--font-size-caption)",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                cursor: "pointer",
              }}
              title={userName}
            >
              {userInitials}
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-tertiary)",
                  padding: "var(--space-4)",
                  display: "flex",
                  borderRadius: "var(--radius-sm)",
                }}
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
