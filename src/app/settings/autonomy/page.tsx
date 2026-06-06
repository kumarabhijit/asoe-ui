/**
 * Settings → Autonomy & Review Quality.
 *
 * The real-data slice of the Autonomy program: the automation-bias review
 * scrutiny SLIs that gate a safe path to autonomy ("are operators reviewing or
 * rubber-stamping?"). Read-only. RBAC: manager+/admin — gated on
 * `exceptions:override`, which exactly mirrors the backend
 * `require_role("manager","admin")` on GET /api/v1/metrics/reviewer-activity
 * (analysts lack it). Counterfactual STP + calibration reliability render as
 * honest "no data source yet" cards inside the panel — never fabricated.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ShieldAlert } from "lucide-react";

import { NavBar } from "@/components/ui/NavBar";
import { ReviewQualityPanel } from "@/components/ui/ReviewQualityPanel";
import { NAV_TABS } from "@/config/nav-tabs";
import { useAuth } from "@/hooks/useAuth";
import { useHealth } from "@/hooks/useHealth";
import { useSignOut } from "@/hooks/useSignOut";
import { PERMISSIONS } from "@/lib/roles";
import { metricsApi, type ReviewerActivitySnapshot } from "@/lib/api";

export const requiresAuth = true;

export default function AutonomyMetricsPage() {
  const router = useRouter();
  const { health } = useHealth();
  const { user, visibleTabs, hasPermission, isLoading } = useAuth();
  const handleSignOut = useSignOut();

  const canView = hasPermission(PERMISSIONS.EXCEPTIONS_OVERRIDE);

  const [data, setData] = useState<ReviewerActivitySnapshot | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!isLoading && !canView) router.replace("/settings");
  }, [isLoading, canView, router]);

  useEffect(() => {
    if (isLoading || !canView) return;
    let cancelled = false;
    setLoadError(false);
    metricsApi
      .getReviewerActivity()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoading, canView]);

  if (isLoading || !canView) {
    return (
      <div className="min-h-screen bg-surface-page font-sans flex items-center justify-center">
        <div className="text-center text-text-tertiary">
          {isLoading ? (
            <p className="text-body">Loading...</p>
          ) : (
            <div className="flex flex-col items-center gap-8">
              <ShieldAlert size={32} className="text-text-quaternary" aria-hidden />
              <p className="text-body">Access denied. Redirecting...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const userName = user?.name || "User";
  const userInitials =
    (user as { avatar_initials?: string })?.avatar_initials ||
    userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const userTitle = (user as { title?: string })?.title || "";
  const filteredTabs = visibleTabs.length > 0 ? NAV_TABS.filter((t) => visibleTabs.includes(t.id)) : NAV_TABS;

  return (
    <div className="min-h-screen bg-surface-page font-sans">
      <NavBar
        tabs={filteredTabs}
        activeTab="settings"
        userName={userName}
        userInitials={userInitials}
        userTitle={userTitle}
        agentCount={health?.allowed_intents?.length || 0}
        onSignOut={handleSignOut}
      />

      <main id="main-content" className="max-w-[1100px] mx-auto py-24 px-32">
        <nav aria-label="Breadcrumb" className="text-caption text-text-tertiary mb-12 flex items-center gap-6">
          <Link
            href="/home"
            className="text-text-tertiary hover:text-text-secondary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm"
          >
            Home
          </Link>
          <span className="text-text-quaternary" aria-hidden>/</span>
          <Link
            href="/settings"
            className="text-text-tertiary hover:text-text-secondary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm"
          >
            Settings
          </Link>
          <span className="text-text-quaternary" aria-hidden>/</span>
          <span className="text-text-secondary">Autonomy &amp; Review Quality</span>
        </nav>

        <div className="flex items-center gap-12 mb-24">
          <div className="w-40 h-40 rounded-md bg-surface-tertiary flex items-center justify-center text-text-secondary">
            <Activity size={20} aria-hidden />
          </div>
          <div>
            <h1 className="text-display text-text-primary m-0">Autonomy &amp; Review Quality</h1>
            <p className="text-caption text-text-tertiary m-0 mt-[2px]">
              Review-scrutiny signals that gate a safe path to autonomy
            </p>
          </div>
        </div>

        {loadError ? (
          <div
            role="alert"
            className="p-12 bg-error-subtle border border-error-border rounded-md text-caption text-error"
          >
            Couldn&rsquo;t load review-quality metrics. Try refreshing.
          </div>
        ) : data ? (
          <ReviewQualityPanel data={data} />
        ) : (
          <div className="flex flex-col gap-12" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[80px] rounded-md" />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
