/**
 * /cases/[id] — case detail surface (ADR-038 Phase H.6).
 *
 * Loads the OrderCase + delegates rendering to CaseDetailPanel.
 * Phase H.6 keeps this thin; the rich child-section stack lives
 * inside CaseDetailPanel. ExceptionDetailPanel still renders for
 * /exceptions/[id]; both surfaces converge on the same section
 * components via data-presence dispatch.
 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { casesApi } from "@/lib/api";
import type { OrderCase } from "@/types/cases";

import { CaseDetailPanel } from "../CaseDetailPanel";

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const caseId = params?.id;
  const [orderCase, setOrderCase] = useState<OrderCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    casesApi
      .get(caseId)
      .then((c) => {
        if (cancelled) return;
        if (c) setOrderCase(c);
        else setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return (
    <main className="p-32 max-w-[1280px] mx-auto">
      <button
        type="button"
        onClick={() => router.push("/cases")}
        className="text-caption text-brand hover:underline mb-12"
        aria-label="Back to cases list"
      >
        ← All cases
      </button>

      {loading && (
        <div role="status" aria-live="polite" className="text-text-tertiary py-24">
          Loading case…
        </div>
      )}

      {!loading && notFound && (
        <div role="status" className="text-text-tertiary py-24">
          Case not found: <code>{caseId}</code>
        </div>
      )}

      {!loading && orderCase && <CaseDetailPanel orderCase={orderCase} />}
    </main>
  );
}
