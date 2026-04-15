/**
 * Shared helper components for exception detail sub-components.
 */
"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Collapsible section header — matches Evidence Detail card pattern */
export function CollapsibleHeader({ title, open, onToggle, badge, badgeVariant = "neutral" }: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  badgeVariant?: string;
}) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center justify-between px-16 py-10 bg-transparent border-none cursor-pointer font-sans"
    >
      <div className="flex items-center gap-8">
        <ChevronDown
          size={14}
          className={cn(
            "text-text-tertiary transition-transform duration-fast",
            !open && "-rotate-90",
          )}
        />
        <span className="text-subhead font-semibold text-text-primary">
          {title}
        </span>
        {badge && (
          <span
            className={cn(
              "text-label font-semibold px-2 py-px rounded-full",
              badgeVariant === "success" && "bg-success-subtle text-success",
              badgeVariant === "error" && "bg-error-subtle text-error",
              badgeVariant === "info" && "bg-info-subtle text-info",
              (!badgeVariant || badgeVariant === "neutral") && "bg-surface-secondary text-text-tertiary",
            )}
          >
            {badge}
          </span>
        )}
      </div>
    </button>
  );
}

/** Price formatting helper */
export function fmtPrice(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
