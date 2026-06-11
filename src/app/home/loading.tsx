// CMT-3 — App Router boundary file for /home.
//
// Skeleton mirrors the home surface anatomy (metric tiles row + case
// list) so the content swap doesn't reflow. Uses the shared `.skeleton`
// class (globals.css); animation honors prefers-reduced-motion.
import { ChromeBoundary } from "@/components/ui/ChromeBoundary";

export default function Loading() {
  return (
    <ChromeBoundary activeTab="home">
      <div role="status" aria-live="polite" className="py-16">
        <span className="sr-only">Loading home…</span>
        <div className="flex flex-col gap-16" aria-hidden>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="skeleton h-64 w-full" />
            <div className="skeleton h-64 w-full" />
            <div className="skeleton h-64 w-full" />
            <div className="skeleton h-64 w-full" />
          </div>
          <div className="skeleton h-48 w-full" />
          <div className="skeleton h-48 w-full" />
          <div className="skeleton h-48 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      </div>
    </ChromeBoundary>
  );
}
