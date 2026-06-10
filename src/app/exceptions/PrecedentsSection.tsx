"use client";

/**
 * PrecedentsSection — 'Similar past cases' (sign-off 2026-06-10).
 *
 * Layer-2 evidence card: how this tenant resolved similar records
 * before. Dumb projector of the backend-composed `analysis.precedents`
 * (Guardrail #6) — the asoe2 precedents composer owns matching
 * (semantic embeddings, or the deterministic correlate fallback) and
 * ranking; the UI renders rows as given, in order.
 *
 * Honesty rules carried through from the contract:
 *   - `similarity` exists only on semantic rows; correlate rows render
 *     the "same customer & issue" basis label instead — no fabricated
 *     percentage.
 *   - Null fields (outcome_summary, resolved_at, case link) are
 *     structurally omitted — no dash/placeholder partial-truth states.
 *   - The similarity figure is labelled as a match score, and the raw
 *     basis ("semantic" / model id) rides the row title for audit.
 *
 * Advisory only: nothing here gates an action; rows deep-link to the
 * precedent's case workspace for the operator to judge.
 */

import Link from "next/link";
import { History } from "lucide-react";
import { humanizeEnumLabel, formatTimestamp } from "@/lib/format";
import type { PrecedentCase, PrecedentsAnalysis } from "@/types/exceptions";

interface PrecedentsSectionProps {
  data: PrecedentsAnalysis;
}

export function PrecedentsSection({ data }: PrecedentsSectionProps) {
  if (!data.items.length) return null;
  return (
    <div className="flex flex-col">
      <ul className="m-0 p-0 list-none flex flex-col">
        {data.items.map((item) => (
          <PrecedentRow key={item.record_id} item={item} />
        ))}
      </ul>
      <p className="m-0 mt-8 text-label text-text-quaternary">
        Precedents are informational — they never decide an action.
      </p>
    </div>
  );
}

function PrecedentRow({ item }: { item: PrecedentCase }) {
  const heading = [item.customer_name, item.resolved_at ? formatTimestamp(item.resolved_at) : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="flex items-start gap-10 py-10 border-b border-border-subtle last:border-b-0">
      <History size={14} aria-hidden className="mt-2 shrink-0 text-text-quaternary" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-8 flex-wrap">
          {item.case_id ? (
            <Link
              href={`/cases/${item.case_id}?record=${item.record_id}`}
              className="text-caption font-semibold text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm"
            >
              {heading || item.record_id}
            </Link>
          ) : (
            <span className="text-caption font-semibold text-text-primary">
              {heading || item.record_id}
            </span>
          )}
          {item.outcome && (
            <span className="text-label uppercase tracking-wider font-semibold text-text-tertiary">
              {humanizeEnumLabel(item.outcome)}
            </span>
          )}
        </div>
        {item.outcome_summary && (
          <p className="m-0 mt-2 text-caption text-text-secondary">
            {item.outcome_summary}
          </p>
        )}
      </div>
      {/* Match provenance: a semantic row carries its score (+ the
          model id on the tooltip for audit); a correlate row states its
          deterministic basis instead — never a fabricated percentage. */}
      {item.match_basis === "semantic" && typeof item.similarity === "number" ? (
        <span
          className="shrink-0 font-mono text-label font-semibold text-text-tertiary"
          title={`Semantic match score (not a probability)${item.embedding_model ? ` · ${item.embedding_model}` : ""}`}
        >
          {Math.round(item.similarity * 100)}% match
        </span>
      ) : (
        <span className="shrink-0 text-label text-text-quaternary" title="Deterministic match: same issue type, same customer first">
          same issue
        </span>
      )}
    </li>
  );
}
