// CMT-3 — App Router error boundary for /home.
"use client";

import { ChromeBoundary } from "@/components/ui/ChromeBoundary";
import { BoundaryError } from "@/components/ui/BoundaryError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ChromeBoundary activeTab="home">
      <BoundaryError
        title="Home failed to load"
        error={error}
        reset={reset}
        retryLabel="Retry loading home"
      />
    </ChromeBoundary>
  );
}
