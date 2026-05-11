// CMT-3 — App Router error boundary for /exceptions.
//
// Renders when a server / data-fetch error escapes the queue
// surface. Keeps chrome present (the operator must always have
// an exit) and offers a retry path.
"use client";

import { ChromeBoundary } from "@/components/ui/ChromeBoundary";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ChromeBoundary activeTab="exceptions">
      <div role="alert" className="py-24 flex flex-col gap-12">
        <h1 className="text-h4 text-text-primary">
          Exception queue failed to load
        </h1>
        <p className="text-text-tertiary">
          {error?.message || "An unexpected error occurred."}
          {error?.digest && (
            <span className="block text-caption text-text-tertiary mt-4">
              digest: <code>{error.digest}</code>
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="self-start text-brand hover:underline"
          aria-label="Retry loading exception queue"
        >
          Retry
        </button>
      </div>
    </ChromeBoundary>
  );
}
