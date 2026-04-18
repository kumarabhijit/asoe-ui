/**
 * ThemeToggle — Light / Dark / System tri-state theme picker.
 *
 * Lives in the NavBar right section next to the user avatar. Surfaces
 * next-themes' three modes as a DropdownMenu: clicking any option calls
 * setTheme() which persists to localStorage and updates the <html class="dark">
 * attribute. The rest of the UI picks up the dark tokens automatically
 * via design-tokens.css .dark block.
 *
 * Hydration: theme is unknown during SSR. We render a stable Sun icon
 * on the server and swap to the resolved theme's icon (Sun/Moon) after
 * mount — same pattern as next-themes docs, avoids hydration mismatch.
 */
"use client";

import * as React from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./DropdownMenu";
import { cn } from "@/lib/utils";

type ThemeValue = "light" | "dark" | "system";

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemeValue;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

interface ThemeToggleProps {
  className?: string;
  align?: "start" | "center" | "end";
}

export function ThemeToggle({ className, align = "end" }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme: ThemeValue = mounted ? ((theme as ThemeValue) ?? "system") : "system";
  const TriggerIcon = mounted && resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            mounted
              ? `Change theme (current: ${currentTheme})`
              : "Change theme"
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
      <DropdownMenuContent align={align} sideOffset={8} className="min-w-[160px]">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_OPTIONS.map(({ value, label, Icon }) => {
          const isActive = currentTheme === value;
          return (
            <DropdownMenuItem
              key={value}
              role="menuitemradio"
              aria-checked={isActive}
              onSelect={() => setTheme(value)}
            >
              <Icon />
              <span className="flex-1">{label}</span>
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
