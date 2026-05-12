// CMT-3 — App Router boundary file for /settings.
import { ChromeBoundary } from "@/components/ui/ChromeBoundary";

export default function Loading() {
  return (
    <ChromeBoundary activeTab="settings">
      <div role="status" aria-live="polite" className="text-text-tertiary py-24">
        Loading settings…
      </div>
    </ChromeBoundary>
  );
}
