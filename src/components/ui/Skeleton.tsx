/**
 * Skeleton — the shared loading-placeholder primitive.
 *
 * Before this existed, every async surface hand-rolled
 * `<div className="skeleton h-… w-…" />`. This wraps the canonical
 * `.skeleton` class (globals.css — pulse animation tokenized via
 * `--dur-skeleton`, neutralized under prefers-reduced-motion) so
 * loaders are consistent and a11y-correct in one place.
 *
 * Accessibility: a skeleton conveys no information to assistive tech —
 * it is the visual stand-in for content that hasn't loaded. It is
 * therefore `aria-hidden`; the surrounding loading surface owns the
 * `role="status"` + an sr-only "Loading…" label (see the route
 * `loading.tsx` files). Do not put text inside a Skeleton.
 */
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export interface SkeletonProps {
  /** Tailwind utility classes for sizing/layout (e.g. "h-24 w-64"). */
  className?: string;
  /** Escape hatch for token-driven inline dimensions when a utility
   *  class doesn't exist (values must be design tokens, not literals). */
  style?: CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return <div className={cn("skeleton", className)} style={style} aria-hidden />;
}
