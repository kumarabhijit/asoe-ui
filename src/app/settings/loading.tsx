// CMT-3 — App Router boundary file for /settings.
//
// Structured skeleton mirroring the settings anatomy (page title + two
// labelled-field sections) so the content swap doesn't reflow. Replaces
// the previous bare "Loading settings…" text for parity with the other
// routes. Uses the shared <Skeleton> primitive; the pulse is neutralized
// under prefers-reduced-motion (globals.css).
import { ChromeBoundary } from "@/components/ui/ChromeBoundary";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <ChromeBoundary activeTab="settings">
      <div role="status" aria-live="polite" className="py-16">
        <span className="sr-only">Loading settings…</span>
        <div className="flex flex-col gap-24 max-w-[640px]" aria-hidden>
          <Skeleton className="h-28 w-48" />
          {[0, 1].map((section) => (
            <div key={section} className="flex flex-col gap-12">
              <Skeleton className="h-20 w-40" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </ChromeBoundary>
  );
}
