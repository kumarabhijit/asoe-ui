// CMT-3 — App Router boundary file for /home.
import { ChromeBoundary } from "@/components/ui/ChromeBoundary";

export default function Loading() {
  return (
    <ChromeBoundary activeTab="home">
      <div role="status" aria-live="polite" className="text-text-tertiary py-24">
        Loading home…
      </div>
    </ChromeBoundary>
  );
}
