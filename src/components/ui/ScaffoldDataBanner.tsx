/**
 * ScaffoldDataBanner / SampleDataTag — non-live data provenance cue.
 *
 * Some preview/pre-prod surfaces render deliberately fabricated demo data
 * because no real backend endpoint exists yet (there is no production env —
 * only local, Vercel preview, and pre-prod). Showing that data unlabelled is
 * the "fabricated data presented as live" anti-pattern the UX audit flagged
 * (theme T1). This primitive marks such a surface as non-live so an operator
 * never mistakes sample data for audited/live data.
 *
 * Gated on the SAME switch as the API client (`NEXT_PUBLIC_USE_REAL_API`,
 * src/lib/api.ts): in live mode (`=== "1"`) the tag returns null and callers
 * should render real data (or an honest empty state) instead.
 *
 * Shape mirrors PreprodIdentityBanner (thin, token-clean, role=note) so it
 * passes the accessibility sweep and reads as established chrome.
 */
"use client";

import { FlaskConical } from "lucide-react";

/**
 * True when the UI is running against mock data (local dev / Vercel preview),
 * i.e. `NEXT_PUBLIC_USE_REAL_API !== "1"`. `override` is for tests.
 */
export function isMockDataMode(override?: boolean): boolean {
  if (override !== undefined) return override;
  return process.env.NEXT_PUBLIC_USE_REAL_API !== "1";
}

export interface SampleDataTagProps {
  label?: string;
  className?: string;
  /** Test/Storybook override for the mock-mode gate. */
  mockOverride?: boolean;
}

/**
 * Inline "Sample data" chip. Renders null in live mode so it never appears on
 * a real-backend deployment.
 */
export function SampleDataTag({
  label = "Sample data — not live",
  className,
  mockOverride,
}: SampleDataTagProps) {
  if (!isMockDataMode(mockOverride)) return null;
  return (
    <span
      role="note"
      aria-label={label}
      data-testid="sample-data-tag"
      className={[
        "inline-flex items-center gap-4 px-6 py-1 rounded-full",
        "bg-warning/10 text-warning text-label font-semibold",
        className || "",
      ].join(" ")}
    >
      <FlaskConical size={11} aria-hidden />
      {label}
    </span>
  );
}
