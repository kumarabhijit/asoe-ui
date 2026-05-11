// CMT-3 — App Router boundary file for /exceptions.
//
// Renders while the queue's data layer is in flight (Suspense or
// server-component data fetch). Must keep chrome present so the
// operator has the canonical exit point at all times.
import { ChromeBoundary } from "@/components/ui/ChromeBoundary";

export default function Loading() {
  return (
    <ChromeBoundary activeTab="exceptions">
      <div role="status" aria-live="polite" className="text-text-tertiary py-24">
        Loading exception queue…
      </div>
    </ChromeBoundary>
  );
}
