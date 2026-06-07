// CMT-3 — App Router error boundary for /inbox.
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
    <ChromeBoundary activeTab="inbox">
      <div role="alert" className="py-24 flex flex-col gap-12">
        <h1 className="text-heading text-text-primary">Inbox failed to load</h1>
        <p className="text-text-tertiary">
          {error?.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="self-start text-brand hover:underline"
          aria-label="Retry loading inbox"
        >
          Retry
        </button>
      </div>
    </ChromeBoundary>
  );
}
