// CMT-3 — App Router boundary file for /cases (covers /cases/[id] too).
import { ChromeBoundary } from "@/components/ui/ChromeBoundary";

export default function Loading() {
  return (
    <ChromeBoundary activeTab="cases">
      <div role="status" aria-live="polite" className="text-text-tertiary py-24">
        Loading cases…
      </div>
    </ChromeBoundary>
  );
}
