// CMT-3 — App Router 404 boundary for /cases and /cases/[id].
//
// Renders when notFound() is called from /cases/[id]/page.tsx
// (bad case_id, deleted record). Covers descendants per Next.js
// App Router semantics: a not-found.tsx at /cases/ catches
// notFound() calls in /cases/[id]/ too.
import Link from "next/link";
import { ChromeBoundary } from "@/components/ui/ChromeBoundary";

export default function NotFound() {
  return (
    <ChromeBoundary activeTab="cases">
      <div role="status" className="py-24 flex flex-col gap-12">
        <h1 className="text-h4 text-text-primary">Case not found</h1>
        <p className="text-text-tertiary">
          The case you requested doesn&apos;t exist or has been deleted.
        </p>
        <Link
          href="/cases"
          className="self-start text-brand hover:underline"
          aria-label="Return to case list"
        >
          Back to Cases
        </Link>
      </div>
    </ChromeBoundary>
  );
}
