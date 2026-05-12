// CMT-3 — App Router error boundary for /home.
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
    <ChromeBoundary activeTab="home">
      <div role="alert" className="py-24 flex flex-col gap-12">
        <h1 className="text-h4 text-text-primary">Home failed to load</h1>
        <p className="text-text-tertiary">
          {error?.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="self-start text-brand hover:underline"
          aria-label="Retry loading home"
        >
          Retry
        </button>
      </div>
    </ChromeBoundary>
  );
}
