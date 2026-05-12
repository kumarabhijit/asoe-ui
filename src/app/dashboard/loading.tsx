// CMT-3 — App Router boundary file for /dashboard.
import { ChromeBoundary } from "@/components/ui/ChromeBoundary";

export default function Loading() {
  return (
    <ChromeBoundary activeTab="dashboard">
      <div role="status" aria-live="polite" className="text-text-tertiary py-24">
        Loading dashboard…
      </div>
    </ChromeBoundary>
  );
}
