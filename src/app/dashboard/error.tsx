// CMT-3 — App Router error boundary for /dashboard.
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
    <ChromeBoundary activeTab="dashboard">
      <div role="alert" className="py-24 flex flex-col gap-12">
        <h1 className="text-h4 text-text-primary">Dashboard failed to load</h1>
        <p className="text-text-tertiary">
          {error?.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="self-start text-brand hover:underline"
          aria-label="Retry loading dashboard"
        >
          Retry
        </button>
      </div>
    </ChromeBoundary>
  );
}
