/**
 * Full-page exception detail — expanded view.
 * Reuses ExceptionDetailPanel from the sidebar in a full-width layout.
 * Accessed via the expand button in the sidebar header AND via the
 * Customer Inbox row click (ADR-034 Phase G) when the inbox item
 * carries an exception_id.
 *
 * Referrer-aware Back button: when the caller passes `?from=inbox`,
 * the breadcrumb chevrons back to /inbox. Without that hint we
 * default to /exceptions (the historical behaviour). The full nav
 * including Sign out remains visible — operators must always have
 * the canonical exit point regardless of how they got here.
 */
"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import { NavBar } from "@/components/ui/NavBar";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import ExceptionDetailPanel from "../ExceptionDetailPanel";

const NAV_TABS = [
  { id: "inbox", label: "Customer Inbox", href: "/inbox" },
  { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
  { id: "cases", label: "Cases", href: "/cases" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];

// Whitelisted referrer values. Anything else falls through to the
// default Exception Queue back-target so a malformed `from=` can't
// be used to redirect off-app.
const BACK_TARGETS = {
  inbox: { href: "/inbox", label: "Back to Inbox" },
  cases: { href: "/cases", label: "Back to Cases" },
} as const;

const DEFAULT_BACK = { href: "/exceptions", label: "Back to Queue" } as const;

export default function ExceptionFullPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const { user } = useAuth();
  const exceptionId = params.id as string;

  const userName = user?.name || "User";
  const userInitials =
    (user as { avatar_initials?: string })?.avatar_initials ||
    userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const userTitle = (user as { title?: string })?.title || "";

  const fromKey = search?.get("from") ?? "";
  const back =
    fromKey in BACK_TARGETS
      ? BACK_TARGETS[fromKey as keyof typeof BACK_TARGETS]
      : DEFAULT_BACK;
  const activeTab = fromKey === "inbox" ? "inbox" : "exceptions";

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <NavBar
        tabs={NAV_TABS}
        activeTab={activeTab}
        agentCount={3}
        userName={userName}
        userInitials={userInitials}
        userTitle={userTitle}
        onTabChange={(id: string) => {
          const tab = NAV_TABS.find((t) => t.id === id);
          if (tab?.href) router.push(tab.href);
        }}
        onSignOut={() => signOut({ callbackUrl: "/login" })}
      />

      {/* Breadcrumb + back button */}
      <div className="px-32 py-12 border-b border-border bg-surface-primary flex items-center gap-12">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(back.href)}
          aria-label={back.label}
        >
          <ArrowLeft size={16} />
          {back.label}
        </Button>
        <span className="text-text-quaternary text-caption">/</span>
        <span className="text-caption font-semibold text-text-secondary font-mono">
          {exceptionId}
        </span>
      </div>

      {/* Full-width detail content */}
      <div className="flex-1 max-w-[960px] w-full mx-auto px-32 py-24">
        <ExceptionDetailPanel
          exceptionId={exceptionId}
          onClose={() => router.push(back.href)}
        />
      </div>
    </div>
  );
}
