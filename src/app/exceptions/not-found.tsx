// CMT-3 — App Router 404 boundary for /exceptions and descendants.
//
// Renders when notFound() is called from /exceptions or
// /exceptions/[id] (bad id, deleted record, etc.). Keeps chrome
// present and offers a return path to the queue.
import Link from "next/link";
import { ChromeBoundary } from "@/components/ui/ChromeBoundary";

export default function NotFound() {
  return (
    <ChromeBoundary activeTab="exceptions">
      <div role="status" className="py-24 flex flex-col gap-12">
        <h1 className="text-h4 text-text-primary">Exception not found</h1>
        <p className="text-text-tertiary">
          The exception you requested doesn&apos;t exist or has been deleted.
        </p>
        <Link
          href="/exceptions"
          className="self-start text-brand hover:underline"
          aria-label="Return to exception queue"
        >
          Back to Exception Queue
        </Link>
      </div>
    </ChromeBoundary>
  );
}
