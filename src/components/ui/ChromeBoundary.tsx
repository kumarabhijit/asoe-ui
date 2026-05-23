// ChromeBoundary — minimal authenticated chrome for Next.js App
// Router boundary files (loading.tsx / error.tsx / not-found.tsx).
//
// CMT-3 from docs/test-strategy/e2e-flow-plan.md amendment v1.2:
//
//   "For each authenticated route, walk its boundary files. Slow
//    API -> assert loading.tsx renders + chrome present. API 500
//    -> assert error.tsx renders + chrome present. Bad ID ->
//    assert not-found.tsx renders + chrome present. Each
//    boundary tested for the SAME chrome contract as page.tsx."
//
// Boundary files render OUTSIDE the page.tsx component tree but
// INSIDE the surrounding layout(s). Until the D5
// <AuthenticatedLayout> refactor lands, NavBar is per-page —
// boundary files would lose chrome by default. This component
// closes the gap: a minimal NavBar render with the canonical
// tabs + a passthrough onSignOut.
//
// The component is intentionally tiny:
//   - Same NAV_TABS as the authenticated pages.
//   - Same sign-out wiring via useSignOut (Q1 announcement on
//     sign-out works from boundary surfaces too).
//   - Skips userName / userInitials / agent count — boundary
//     surfaces are transitional; over-rendering them adds risk
//     without value.
//
// When the D5 layout refactor lands, this component goes away;
// the boundary files inherit chrome from the layout.

"use client";

import { NavBar } from "@/components/ui/NavBar";
import { useSignOut } from "@/hooks/useSignOut";

// Kept in sync with `src/config/nav-tabs.ts` (single source of truth).
// ADR-041 P2 retires the "Exception Queue" tab — `/cases` is the
// canonical queue surface.
const NAV_TABS = [
  { id: "inbox", label: "Customer Inbox", href: "/inbox" },
  { id: "cases", label: "Cases", href: "/cases" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];

export interface ChromeBoundaryProps {
  /** Optional active tab hint. Boundary surfaces typically don't
   *  know their parent route at runtime; the prop is here so a
   *  per-route boundary file can pass it without forcing every
   *  boundary to compute the active tab. */
  activeTab?: string;
  children: React.ReactNode;
}

export function ChromeBoundary({ activeTab, children }: ChromeBoundaryProps) {
  const handleSignOut = useSignOut();
  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <NavBar
        tabs={NAV_TABS}
        activeTab={activeTab}
        onSignOut={handleSignOut}
      />
      <main className="p-32 max-w-[1280px] mx-auto w-full">{children}</main>
    </div>
  );
}
