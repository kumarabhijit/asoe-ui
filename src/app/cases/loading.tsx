// CMT-3 — App Router boundary file for /cases (covers /cases/[id] too).
//
// Skeleton mirrors the two-pane workspace anatomy (queue left, detail
// right) so the content swap doesn't reflow. Uses the shared `.skeleton`
// class (globals.css) — pulse animation is disabled under
// prefers-reduced-motion by the global media query.
import { ChromeBoundary } from "@/components/ui/ChromeBoundary";

export default function Loading() {
  return (
    <ChromeBoundary activeTab="cases">
      <div role="status" aria-live="polite" className="py-16">
        <span className="sr-only">Loading cases…</span>
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-16" aria-hidden>
          {/* Queue pane — filter chips + rows */}
          <div className="flex flex-col gap-12">
            <div className="flex gap-8">
              <div className="skeleton h-24 w-64" />
              <div className="skeleton h-24 w-64" />
              <div className="skeleton h-24 w-64" />
            </div>
            <div className="skeleton h-48 w-full" />
            <div className="skeleton h-48 w-full" />
            <div className="skeleton h-48 w-full" />
            <div className="skeleton h-48 w-full" />
            <div className="skeleton h-48 w-full" />
          </div>
          {/* Detail pane — header + status + record cards */}
          <div className="flex flex-col gap-12">
            <div className="skeleton h-24 w-2/5" />
            <div className="skeleton h-16 w-3/5" />
            <div className="skeleton h-64 w-full" />
            <div className="skeleton h-64 w-full" />
          </div>
        </div>
      </div>
    </ChromeBoundary>
  );
}
