/**
 * MultiSelect — checkbox-list dropdown for multi-value filters.
 *
 * Built on top of the existing `DropdownMenu` wrapper (which uses
 * Radix `react-dropdown-menu` under the hood and exposes
 * `DropdownMenuCheckboxItem` already). No new Radix package required.
 *
 * Trigger label rules (mirrors Outlook / Linear-style multiselects):
 *   - 0 selected         → `placeholder` ("All States" / "All Exceptions")
 *   - 1-2 selected       → comma-joined human labels
 *   - 3+ selected        → "<n> selected"
 * The `formatLabel` prop is the single point that converts a raw value
 * (e.g. "PENDING_REVIEW") into its display string (e.g. "Pending Review")
 * so callers stay free of hardcoded enum text — Guardrail #2 holds.
 *
 * Keyboard:
 *   - Trigger: Enter / Space opens, Escape closes (Radix default)
 *   - Items: ArrowUp/Down, Enter to toggle, Space to toggle (Radix default)
 *   - "Clear" button at the bottom resets to empty selection
 */
"use client";

import { ChevronDown, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "./DropdownMenu";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export interface MultiSelectProps {
  /** Available values (typically from `useHealth`). */
  options: readonly string[];
  /** Currently selected values. */
  value: string[];
  /** Called whenever selection changes (also called with [] for "Clear"). */
  onChange: (next: string[]) => void;
  /** Trigger placeholder when nothing is selected. */
  placeholder: string;
  /** Convert a raw value to its display label. Defaults to underscore→space. */
  formatLabel?: (value: string) => string;
  /** Aria label for the trigger (screen-reader text). */
  ariaLabel: string;
  /** Optional className for the trigger button. */
  triggerClassName?: string;
}

const defaultFormat = (v: string) => v.replace(/_/g, " ");

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  formatLabel = defaultFormat,
  ariaLabel,
  triggerClassName,
}: MultiSelectProps) {
  // Sort the on-trigger label into a stable order matching `options` so
  // toggling doesn't shuffle the displayed string.
  const ordered = options.filter((o) => value.includes(o));

  let triggerLabel: string;
  if (ordered.length === 0) {
    triggerLabel = placeholder;
  } else if (ordered.length <= 2) {
    triggerLabel = ordered.map(formatLabel).join(", ");
  } else {
    triggerLabel = `${ordered.length} selected`;
  }

  function toggle(opt: string) {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex items-center justify-between gap-6 px-10 py-6 rounded-sm",
            "bg-surface-primary border border-border text-caption text-text-primary",
            "hover:border-text-quaternary cursor-pointer font-sans transition-colors duration-fast",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
            triggerClassName,
          )}
        >
          <span
            className={cn(
              "overflow-hidden text-ellipsis whitespace-nowrap",
              ordered.length === 0 && "text-text-quaternary",
            )}
          >
            {triggerLabel}
          </span>
          <ChevronDown size={12} className="text-text-tertiary shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        {options.length === 0 ? (
          <div className="px-12 py-8 text-caption text-text-tertiary italic">
            No options available
          </div>
        ) : (
          <>
            {options.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt}
                checked={value.includes(opt)}
                // Radix calls onCheckedChange after toggling its internal
                // state. Prevent the menu from closing on each click so
                // operators can pick several without re-opening.
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => toggle(opt)}
              >
                {formatLabel(opt)}
              </DropdownMenuCheckboxItem>
            ))}
            {value.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="flex justify-end px-4 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange([])}
                  >
                    <X size={11} className="mr-2" /> Clear
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
