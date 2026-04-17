/**
 * Settings — placeholder page for Phase 9.
 *
 * Scope: user management, SSO config, policy overrides, agent settings.
 * RBAC: requires rules:write, policy:write, or users:manage permission.
 * Unauthorized users are redirected to /exceptions.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Settings, Users, Shield, Zap, Bell, ShieldAlert } from "lucide-react";
import { NavBar } from "@/components/ui/NavBar";
import { Card } from "@/components/ui/Card";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";

const SETTINGS_PERMISSIONS = ["rules:write", "policy:write", "users:manage"] as const;

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
  const { user, visibleTabs, hasPermission, isLoading } = useAuth();

  const hasSettingsAccess = SETTINGS_PERMISSIONS.some((p) => hasPermission(p));

  useEffect(() => {
    if (!isLoading && !hasSettingsAccess) {
      router.replace("/exceptions");
    }
  }, [isLoading, hasSettingsAccess, router]);

  if (isLoading || !hasSettingsAccess) {
    return (
      <div className="min-h-screen bg-surface-page font-sans flex items-center justify-center">
        <div className="text-center text-text-tertiary">
          {isLoading ? (
            <p className="text-body">Loading...</p>
          ) : (
            <div className="flex flex-col items-center gap-8">
              <ShieldAlert size={32} className="text-text-quaternary" />
              <p className="text-body">Access denied. Redirecting...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const userName = user?.name || "User";
  const userInitials = (user as { avatar_initials?: string })?.avatar_initials || userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const userTitle = (user as { title?: string })?.title || "";
  const filteredTabs = visibleTabs.length > 0 ? NAV_TABS.filter((t) => visibleTabs.includes(t.id)) : NAV_TABS;

  return (
    <div className="min-h-screen bg-surface-page font-sans">
      <NavBar
        tabs={filteredTabs}
        activeTab="settings"
        onTabChange={(id) => {
          const tab = NAV_TABS.find((t) => t.id === id);
          if (tab?.href) router.push(tab.href);
        }}
        userName={userName}
        userInitials={userInitials}
        userTitle={userTitle}
        agentCount={health?.allowed_intents?.length || 0}
        onSignOut={() => signOut({ callbackUrl: "/login" })}

      />

      <main id="main-content" className="max-w-[1440px] mx-auto py-24 px-32">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="text-caption text-text-tertiary mb-12 flex items-center gap-6"
        >
          <span>Home</span>
          <span className="text-text-quaternary">/</span>
          <span className="text-text-secondary">Settings</span>
        </nav>

        {/* Page header */}
        <div className="flex items-center gap-12 mb-24">
          <div className="w-40 h-40 rounded-md bg-surface-tertiary flex items-center justify-center text-text-secondary">
            <Settings size={20} />
          </div>
          <div>
            <h1 className="text-display text-text-primary m-0">
              Settings
            </h1>
            <p className="text-caption text-text-tertiary m-0 mt-[2px]">
              Platform configuration and administration
            </p>
          </div>
        </div>

        {/* Settings cards */}
        <div className="grid grid-cols-2 gap-16">
          {SETTING_SECTIONS.map((section) => (
            <Card key={section.label}>
              <div className="p-20 flex items-start gap-16">
                <div className="w-40 h-40 rounded-sm bg-surface-secondary flex items-center justify-center text-text-secondary shrink-0">
                  <section.icon size={20} />
                </div>
                <div className="flex-1">
                  <div className="text-subhead text-text-primary">
                    {section.label}
                  </div>
                  <div className="text-caption text-text-tertiary mt-4">
                    {section.description}
                  </div>
                  <div className="inline-block mt-10 text-label text-text-quaternary uppercase tracking-[0.04em]">
                    {section.status}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
