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
import { useSignOut } from "@/hooks/useSignOut";

import { NavBar } from "@/components/ui/NavBar";
import { useAuth } from "@/hooks/useAuth";
import { casesApi } from "@/lib/api";
import type { OrderCase } from "@/types/cases";
import type { ExceptionDetailResponse } from "@/types/api";

import { CaseDetailPanel } from "../CaseDetailPanel";

import { NAV_TABS } from "@/config/nav-tabs";
// NAV_TABS consolidated to src/config/nav-tabs.ts (issue #133, PO #9).

export const requiresAuth = true;

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const handleSignOut = useSignOut();
  const caseId = params?.id;
  const [orderCase, setOrderCase] = useState<OrderCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Phase 28.5.x §28.5 — attached records load on mount alongside
  // the case header so the "Attached records" placeholder section
  // can render concrete data (and so `aggregated_policy_hits`
  // populates the L1/L2 PolicyHitBadge surface).
  const [records, setRecords] = useState<ExceptionDetailResponse[]>([]);
  const [policyHits, setPolicyHits] = useState<string[]>([]);

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
    // Two parallel fetches — case header + attached-record stack.
    // We Promise.all so the UI flips out of `loading` only when both
    // settle, which avoids a flicker where the header renders without
    // the policy-hits section.
    Promise.all([
      casesApi.get(caseId),
      casesApi
        .getRecords(caseId)
        .catch(() => ({
          items: [] as ExceptionDetailResponse[],
          total: 0,
          aggregated_policy_hits: [] as string[],
        })),
    ])
      .then(([c, r]) => {
        if (cancelled) return;
        if (c) {
          setOrderCase(c);
          setRecords(r.items);
          setPolicyHits(r.aggregated_policy_hits);
        } else {
          setNotFound(true);
        }
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
        onSignOut={handleSignOut}
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

        {!loading && orderCase && (
          <CaseDetailPanel
            orderCase={orderCase}
            attachedRecords={records}
            policyHits={policyHits}
          />
        )}
      </main>
    </div>
  );
}
