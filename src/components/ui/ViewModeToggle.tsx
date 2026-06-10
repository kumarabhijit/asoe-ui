/**
 * ViewModeToggle — Legacy / Modern view picker.
 *
 * Lives in the NavBar right section next to ThemeToggle. Surfaces the
 * two presentational layouts (see `useViewMode`) as a DropdownMenu:
 * selecting one calls setMode(), which persists to localStorage and
 * re-renders the detail surfaces (ring vs bar, the Agent Activity rail,
 * the situation hero). No reload, no env change.
 *
 * Hydration: the resolved preference is unknown during SSR. We render a
 * stable trigger icon on the server and swap to the active mode's icon
 * after mount — same pattern as ThemeToggle, avoids a hydration
 * mismatch on the trigger.
 */
"use client";

import * as React from "react";
import { Check, LayoutDashboard, PanelsTopLeft, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./DropdownMenu";
import { useViewMode, type ViewMode } from "@/hooks/useViewMode";
import { cn } from "@/lib/utils";

const VIEW_OPTIONS: ReadonlyArray<{
  value: ViewMode;
  label: string;
  hint: string;
  Icon: typeof LayoutDashboard;
}> = [
  {
    value: "legacy",
    label: "Legacy view",
    hint: "The established layout",
    Icon: PanelsTopLeft,
  },
  {
    value: "modern",
    label: "Modern view",
    hint: "Agent-first decision cockpit",
    Icon: Sparkles,
  },
];

interface ViewModeToggleProps {
  className?: string;
  align?: "start" | "center" | "end";
}

export function ViewModeToggle({ className, align = "end" }: ViewModeToggleProps) {
  const { mode, setMode, mounted } = useViewMode();

  // Stable icon on the server / first paint; reflect the active mode
  // once the stored preference has resolved.
  const TriggerIcon = mounted && mode === "modern" ? Sparkles : LayoutDashboard;
  // `?? "View"` guards the aria-label against rendering the literal
  // string "undefined" if `mode` ever falls outside VIEW_OPTIONS.
  const activeLabel = VIEW_OPTIONS.find((o) => o.value === mode)?.label ?? "View";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            mounted ? `Change view (current: ${activeLabel})` : "Change view"
          }
          className={cn(
            "w-[32px] h-[32px] rounded-full bg-surface-tertiary",
            "flex items-center justify-center",
            "text-text-secondary hover:text-text-primary",
            "border-none cursor-pointer",
            "transition-colors duration-fast",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
            className,
          )}
        >
          <TriggerIcon size={16} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} sideOffset={8} className="min-w-[220px]">
        <DropdownMenuLabel>View</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {VIEW_OPTIONS.map(({ value, label, hint, Icon }) => {
          const isActive = mounted && mode === value;
          return (
            <DropdownMenuItem
              key={value}
              role="menuitemradio"
              aria-checked={isActive}
              onSelect={() => setMode(value)}
            >
              <Icon />
              <span className="flex-1">
                {label}
                <span className="block text-[11px] font-normal text-text-tertiary">
                  {hint}
                </span>
              </span>
              {isActive && (
                <Check
                  className="h-3.5 w-3.5 text-text-primary"
                  aria-hidden="true"
                />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
