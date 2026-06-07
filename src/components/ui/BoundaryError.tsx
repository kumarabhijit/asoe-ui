// BoundaryError — shared body for App Router error.tsx boundaries.
//
// Centralises the error-boundary surface so the five route boundaries
// (home/dashboard/inbox/settings/cases) can't drift apart. Critically it
// does NOT render the raw `error.message`: a client error boundary catches
// arbitrary thrown values whose message may carry internal detail (stack
// fragments, identifiers, upstream payloads) that must not reach the
// operator. We show a generic line plus the opaque `error.digest` — the
// hash Next.js emits for support correlation — instead.
"use client";

interface BoundaryErrorProps {
  /** Heading, e.g. "Dashboard failed to load". */
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
  /** Accessible name for the retry control, e.g. "Retry loading dashboard". */
  retryLabel: string;
}

export function BoundaryError({ title, error, reset, retryLabel }: BoundaryErrorProps) {
  return (
    <div role="alert" className="py-24 flex flex-col gap-12">
      <h1 className="text-heading text-text-primary">{title}</h1>
      <p className="text-text-tertiary">
        An unexpected error occurred. Please retry, or share the reference
        below with support if it persists.
        {error?.digest && (
          <span className="block text-caption text-text-tertiary mt-4">
            Reference: <code>{error.digest}</code>
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="self-start text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm"
        aria-label={retryLabel}
      >
        Retry
      </button>
    </div>
  );
}
