// Root-segment App Router error boundary.
//
// The five primary routes (home/dashboard/inbox/settings/cases) each
// carry their own error.tsx; this boundary catches errors thrown by
// segments WITHOUT one (login, 403, auth callback, root redirect) so
// no route can white-screen. No ChromeBoundary here — the failing
// segment may be unauthenticated chrome-less surface.
"use client";

import { BoundaryError } from "@/components/ui/BoundaryError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="max-w-[640px] mx-auto px-16">
      <BoundaryError
        title="Something went wrong"
        error={error}
        reset={reset}
        retryLabel="Retry"
      />
    </main>
  );
}
