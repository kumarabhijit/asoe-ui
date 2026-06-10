// /cases/[id] — case detail surface (ADR-038 / S15a).
//
// Loads the OrderCase + attached records, delegates rendering to
// CaseDetailPanel. The page owns the `?record=<id>` URL-query
// binding so the picker selection survives reload and lets callers
// deep-link into a specific record's HITL surface (the case-centric
// pivot retired the standalone /exceptions/[id] route).
//
// Top NavBar (with Sign out) is mandatory on every authenticated
// page — operators must always have the canonical exit point.

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams, notFound } from "next/navigation";
import { useSignOut } from "@/hooks/useSignOut";

import { NavBar } from "@/components/ui/NavBar";
import { HotkeyCheatsheet } from "@/components/ui/HotkeyCheatsheet";
import { useAuth } from "@/hooks/useAuth";
import { useHealth } from "@/hooks/useHealth";
import { casesApi } from "@/lib/api";
import type { OrderCase } from "@/types/cases";
import type { ExceptionDetailResponse } from "@/types/api";
import { useViewMode } from "@/hooks/useViewMode";

import { CaseDetailPanel } from "../CaseDetailPanel";
import { AgentActivityRail } from "../AgentActivityRail";

import { NAV_TABS } from "@/config/nav-tabs";
// NAV_TABS consolidated to src/config/nav-tabs.ts (issue #133, PO #9).

export const requiresAuth = true;

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const { user } = useAuth();
  const { health } = useHealth();
  const handleSignOut = useSignOut();
  // Cockpit (Modern view) gates the presentational additions; Legacy
  // stays byte-unchanged (Guardrail #0 / cockpit-refactor).
  const COCKPIT = useViewMode().mode === "modern";
  const caseId = params?.id;
  const [orderCase, setOrderCase] = useState<OrderCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [caseMissing, setCaseMissing] = useState(false);
  // Phase 28.5.x §28.5 — attached records load on mount alongside
  // the case header so the "Attached records" placeholder section
  // can render concrete data (and so `aggregated_policy_hits`
  // populates the L1/L2 PolicyHitBadge surface).
  const [records, setRecords] = useState<ExceptionDetailResponse[]>([]);
  const [policyHits, setPolicyHits] = useState<string[]>([]);

  // ?record=<id> drives the per-record HITL surface. The picker
  // (CaseDetailPanel) syncs back through `handleSelectRecord` so a
  // user click survives reload and is shareable. router.replace
  // (not push) keeps Back navigation pointing at the case-list
  // surface rather than at each picker step.
  const selectedRecordId = search?.get("record") ?? undefined;
  const handleSelectRecord = useCallback(
    (recordId: string) => {
      if (!caseId) return;
      router.replace(`/cases/${caseId}?record=${encodeURIComponent(recordId)}`);
    },
    [caseId, router],
  );

  const userName = user?.name || "User";
  const userInitials =
    (user as { avatar_initials?: string })?.avatar_initials ||
    userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const userTitle = (user as { title?: string })?.title || "";

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    setLoading(true);
    setCaseMissing(false);
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
          setCaseMissing(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  // Reach the /cases not-found.tsx boundary (parity with the workspace) when
  // the case id resolves to nothing — the previous inline `setNotFound`
  // branch rendered a bespoke string and left not-found.tsx dead code.
  if (!loading && caseMissing) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <NavBar
        tabs={NAV_TABS}
        activeTab="cases"
        agentCount={health?.allowed_intents?.length || 0}
        userName={userName}
        userInitials={userInitials}
        userTitle={userTitle}
        onSignOut={handleSignOut}
      />

      <main id="main-content" className="p-32 max-w-[1280px] mx-auto w-full">
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

        {!loading && orderCase && (
          <>
            {/* Cockpit: surface the Agent Activity stream on the detail
                route too (council 2026-06-10) — Guardrail #4, the system
                is the primary actor. `showWhenEmpty` makes the rail
                DISCOVERABLE here even before a trace lands (loading +
                empty states), unlike the /cases xl rail which collapses
                when empty. Only while a record is selected. Modern-gated;
                Legacy is untouched. */}
            {COCKPIT && selectedRecordId && (
              <div className="mb-16 rounded-lg border border-border-subtle overflow-hidden">
                <AgentActivityRail
                  selectedRecordId={selectedRecordId}
                  showWhenEmpty
                />
              </div>
            )}
            <CaseDetailPanel
              orderCase={orderCase}
              attachedRecords={records}
              policyHits={policyHits}
              selectedRecordId={selectedRecordId}
              onSelectRecord={handleSelectRecord}
            />
          </>
        )}
      </main>

      {/* Keyboard-shortcut surface — parity with the /cases workspace so
          operators get the same hotkeys + discoverable cheatsheet here. */}
      <HotkeyCheatsheet />
    </div>
  );
}
