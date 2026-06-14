// CMT-3 — App Router boundary file for /inbox.
//
// Structured skeleton mirroring the customer-inbox list anatomy (filter
// row + stacked case rows) so the content swap doesn't reflow. Replaces
// the previous bare "Loading inbox…" text for parity with /cases, /home,
// and /dashboard. Uses the shared <Skeleton> primitive; the pulse is
// neutralized under prefers-reduced-motion (globals.css).
import { ChromeBoundary } from "@/components/ui/ChromeBoundary";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <ChromeBoundary activeTab="inbox">
      <div role="status" aria-live="polite" className="py-16">
        <span className="sr-only">Loading inbox…</span>
        <div className="flex flex-col gap-12" aria-hidden>
          {/* Filter / search row */}
          <div className="flex gap-8">
            <Skeleton className="h-24 w-64" />
            <Skeleton className="h-24 w-64" />
            <Skeleton className="h-24 w-32 ml-auto" />
          </div>
          {/* Inbox rows */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      </div>
    </ChromeBoundary>
  );
}
