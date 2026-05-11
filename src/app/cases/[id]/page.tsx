/**
 * /cases/[id] — case detail surface (ADR-038 Phase H.6).
 *
 * Loads the OrderCase + delegates rendering to CaseDetailPanel.
 * Phase H.6 keeps this thin; the rich child-section stack lives
 * inside CaseDetailPanel. ExceptionDetailPanel still renders for
 * /exceptions/[id]; both surfaces converge on the same section
 * components via data-presence dispatch.
 *
 * Top NavBar (with Sign out) is mandatory on every authenticated
 * page — operators must always have the canonical exit point.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import { NavBar } from "@/components/ui/NavBar";
import { useAuth } from "@/hooks/useAuth";
import { casesApi } from "@/lib/api";
import type { OrderCase } from "@/types/cases";

import { CaseDetailPanel } from "../CaseDetailPanel";

const NAV_TABS = [
  { id: "inbox", label: "Customer Inbox", href: "/inbox" },
  { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
  { id: "cases", label: "Cases", href: "/cases" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const caseId = params?.id;
  const [orderCase, setOrderCase] = useState<OrderCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const userName = user?.name || "User";
  const userInitials =
    (user as { avatar_initials?: string })?.avatar_initials ||
    userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const userTitle = (user as { title?: string })?.title || "";

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    casesApi
      .get(caseId)
      .then((c) => {
        if (cancelled) return;
        if (c) setOrderCase(c);
        else setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <NavBar
        tabs={NAV_TABS}
        activeTab="cases"
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

      <main className="p-32 max-w-[1280px] mx-auto w-full">
        <button
          type="button"
          onClick={() => router.push("/cases")}
          className="text-caption text-brand hover:underline mb-12"
          aria-label="Back to cases list"
        >
          ← All cases
        </button>

        {loading && (
          <div role="status" aria-live="polite" className="text-text-tertiary py-24">
            Loading case…
          </div>
        )}

        {!loading && notFound && (
          <div role="status" className="text-text-tertiary py-24">
            Case not found: <code>{caseId}</code>
          </div>
        )}

        {!loading && orderCase && <CaseDetailPanel orderCase={orderCase} />}
      </main>
    </div>
  );
}
