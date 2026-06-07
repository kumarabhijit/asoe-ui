/**
 * CaseViewBanner — explicit "filtered view of /cases" affordance.
 *
 * ADR-038 §H.6 commits `/inbox` and `/exceptions` to operating as
 * filtered case-list views of `/cases` (the new primary CSR
 * surface). The full data-hook reframe is a Frontend Platform
 * follow-up; in the meantime this banner makes the relationship
 * explicit so users can navigate from the legacy view to the
 * canonical case list and back.
 *
 * Visual: thin info-toned strip directly under the page header
 * (the `--color-info` token is the brand violet, not literally blue),
 * dismissible? No — the relationship is permanent product
 * direction, not a transient notice.
 */
"use client";

import Link from "next/link";
import { LayoutList, ArrowRight } from "lucide-react";

export interface CaseViewBannerProps {
  /** Short label describing this view (e.g. "Manual Order Inbox").
   *  Used to phrase the banner copy. */
  scopeLabel: string;
  /** Optional query string applied when the user clicks through to
   *  /cases (e.g. `?source=manual_order`). When omitted the banner
   *  links to `/cases` with no filter. */
  casesHref?: string;
  className?: string;
}

export function CaseViewBanner({
  scopeLabel,
  casesHref = "/cases",
  className,
}: CaseViewBannerProps) {
  return (
    <div
      role="note"
      aria-label="Case-view relationship"
      className={[
        "flex items-center justify-between gap-12 px-32 py-8",
        "bg-info/10 border-b border-info/20",
        "text-caption text-text-secondary",
        className || "",
      ].join(" ")}
    >
      <div className="flex items-center gap-8">
        <LayoutList size={14} className="text-info shrink-0" aria-hidden="true" />
        {/* Plain-text mention; the single trailing CTA is the one link
            (was a duplicate inline `/cases` link with dev-jargon text). */}
        <span>
          Showing <strong className="text-text-primary">{scopeLabel}</strong>{" "}
          — a filtered view of the unified case list.
        </span>
      </div>
      <Link
        href={casesHref}
        className="flex items-center gap-4 text-brand hover:text-brand-hover whitespace-nowrap"
      >
        Open the case list <ArrowRight size={12} aria-hidden="true" />
      </Link>
    </div>
  );
}
