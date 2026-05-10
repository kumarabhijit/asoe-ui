/**
 * PolicyHitBadge — distinguish L1-rule-derived from L2-LLM-derived
 * compliance reasons (ADR-039 §4.5).
 *
 * The L1 deterministic Compliance Shadow emits policy_hits as plain
 * rule names (e.g. `MK-2026-12`). When the L2 LLM Shadow downgrades
 * a verdict at X.2+, the orchestration layer prefixes the LLM's
 * named concerns with `LLM_SHADOW:` (per ADR-039 §4.5 / per the
 * `compliance.shadow_llm.combine_verdicts` contract). The reviewer
 * needs to see both at a glance and tell which is which.
 *
 * Visual contract:
 *   * Rule-based hit (no LLM_SHADOW: prefix) — neutral surface,
 *     mono font (matches the existing list rendering).
 *   * LLM-derived hit (LLM_SHADOW: prefix) — brand-tinted background
 *     + small "AI" pill prefix. The actual concern name (after the
 *     prefix) renders in the same mono font for parity.
 *
 * Accessibility:
 *   * The "AI" pill is text-not-color; WCAG 1.4.1 holds.
 *   * `aria-label` includes the source ("AI second-opinion") so SR
 *     readers don't have to rely on the visual badge.
 *
 * The component is a pure projector — it does NOT compute or
 * combine anything (CLAUDE.md §6); it just renders the string the
 * backend stamped.
 */
"use client";

import { Bot } from "lucide-react";

const LLM_SHADOW_PREFIX = "LLM_SHADOW:";

export interface PolicyHitBadgeProps {
  hit: string;
  /** Optional className for layout overrides; the badge owns its
   *  visual tokens internally. */
  className?: string;
}

export function PolicyHitBadge({ hit, className }: PolicyHitBadgeProps) {
  const isLlmDerived = hit.startsWith(LLM_SHADOW_PREFIX);
  const concernName = isLlmDerived
    ? hit.slice(LLM_SHADOW_PREFIX.length).trim()
    : hit;

  if (!isLlmDerived) {
    return (
      <span
        className={[
          "text-label text-text-secondary font-mono",
          className || "",
        ].join(" ")}
      >
        {concernName}
      </span>
    );
  }

  return (
    <span
      aria-label={`AI second-opinion concern: ${concernName}`}
      className={[
        "inline-flex items-center gap-4 px-6 py-2 rounded-sm",
        "bg-brand/10 border border-brand/20",
        "text-label font-mono text-text-primary",
        className || "",
      ].join(" ")}
    >
      <span
        // Small text-pill prefix — readable independent of colour.
        className={[
          "inline-flex items-center gap-2",
          "text-label font-semibold uppercase tracking-wider text-brand",
        ].join(" ")}
      >
        <Bot size={10} aria-hidden="true" />
        AI
      </span>
      <span className="opacity-60">·</span>
      <span>{concernName}</span>
    </span>
  );
}
