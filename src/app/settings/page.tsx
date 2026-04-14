/**
 * Settings — placeholder page for Phase 9.
 *
 * Scope: user management, SSO config, policy overrides, agent settings.
 * RBAC: gated to admin role (future).
 */
"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Settings, Users, Shield, Zap, Bell } from "lucide-react";
import { NavBar } from "@/components/ui/NavBar";
import { Card } from "@/components/ui/Card";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";

const NAV_TABS = [
  { id: "inbox", label: "Customer Inbox", href: "/inbox" },
  { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];

const SETTING_SECTIONS = [
  { icon: Users, label: "User Management", description: "Manage users, roles, and permissions", status: "Coming soon" },
  { icon: Shield, label: "SSO & Authentication", description: "Configure SSO providers and MFA policies", status: "Coming soon" },
  { icon: Zap, label: "Agent Configuration", description: "Kill switch, explain mode, and agent thresholds", status: "Coming soon" },
  { icon: Bell, label: "Notifications", description: "Email alerts, webhook integrations, and escalation rules", status: "Coming soon" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { health } = useHealth();
  const { user } = useAuth();

  const userName = user?.name || "User";
  const userInitials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-surface-page)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <NavBar
        tabs={NAV_TABS}
        activeTab="settings"
        onTabChange={(id) => {
          const tab = NAV_TABS.find((t) => t.id === id);
          if (tab?.href) router.push(tab.href);
        }}
        userName={userName}
        userInitials={userInitials}
        agentCount={health?.allowed_intents?.length || 0}
        onSignOut={() => signOut({ callbackUrl: "/login" })}
        onSettingsClick={() => router.push("/settings")}
      />

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "var(--space-24) var(--space-32)" }}>
        {/* Breadcrumb */}
        <div
          style={{
            fontSize: "var(--font-size-caption)",
            color: "var(--color-text-tertiary)",
            marginBottom: "var(--space-12)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-6)",
          }}
        >
          <span>Home</span>
          <span style={{ color: "var(--color-text-quaternary)" }}>/</span>
          <span style={{ color: "var(--color-text-secondary)" }}>Settings</span>
        </div>

        {/* Page header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-12)",
            marginBottom: "var(--space-24)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-md)",
              background: "var(--color-surface-tertiary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-secondary)",
            }}
          >
            <Settings size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: "var(--font-size-display)", fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
              Settings
            </h1>
            <p style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-tertiary)", margin: 0, marginTop: 2 }}>
              Platform configuration and administration
            </p>
          </div>
        </div>

        {/* Settings cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-16)" }}>
          {SETTING_SECTIONS.map((section) => (
            <Card key={section.label}>
              <div style={{ padding: "var(--space-20)", display: "flex", alignItems: "flex-start", gap: "var(--space-16)" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-surface-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-text-secondary)",
                    flexShrink: 0,
                  }}
                >
                  <section.icon size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--font-size-subhead)", fontWeight: 600, color: "var(--color-text-primary)" }}>
                    {section.label}
                  </div>
                  <div style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-tertiary)", marginTop: "var(--space-4)" }}>
                    {section.description}
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      marginTop: "var(--space-10)",
                      fontSize: "var(--font-size-label)",
                      fontWeight: 600,
                      color: "var(--color-text-quaternary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {section.status}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
