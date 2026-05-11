// CMT-3 — App Router boundary file for /inbox.
import { ChromeBoundary } from "@/components/ui/ChromeBoundary";

export default function Loading() {
  return (
    <ChromeBoundary activeTab="inbox">
      <div role="status" aria-live="polite" className="text-text-tertiary py-24">
        Loading inbox…
      </div>
    </ChromeBoundary>
  );
}
