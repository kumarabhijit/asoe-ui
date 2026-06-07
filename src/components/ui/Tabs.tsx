"use client";

/**
 * Tabs — minimal accessible tab control (WAI-ARIA Tabs pattern).
 *
 * Built in-house (no Shadcn tab primitive in the repo) to stay on the
 * design-token system. Used by the exception detail pane to isolate the
 * System Diagnostics surface into its own tab (Priority 4) away from the
 * Evidence surface, without hiding the Agent recommendation (that stays
 * in the persistent header — CLAUDE.md Guardrail #4).
 *
 * Accessibility:
 *   - `role="tablist"` wraps `role="tab"` buttons; one tabpanel renders
 *     at a time with `role="tabpanel"` + `aria-labelledby`.
 *   - Roving tabindex: only the active tab is in the tab order; Left/Right
 *     (and Home/End) move between tabs and activate (automatic activation).
 *   - The active tab carries `aria-selected`; selection is never colour-only
 *     (the active tab also shows a bottom border + bolder weight — WCAG 1.4.1).
 *
 * Controlled or uncontrolled: pass `value` + `onValueChange` to control it,
 * or `defaultValue` to let it own the state. Only the active panel is
 * mounted (lazy — heavy panels don't render until selected).
 */

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabDef {
  id: string;
  label: string;
  /** Optional short count/status chip rendered after the label. */
  badge?: string;
}

interface TabsProps {
  tabs: TabDef[];
  /** Accessible name for the tablist (e.g. "Detail sections"). */
  ariaLabel: string;
  /** Controlled active tab id. Omit to use `defaultValue` (uncontrolled). */
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Renders the body for the active tab. Only the active panel mounts. */
  renderPanel: (activeId: string) => ReactNode;
  className?: string;
}

export function Tabs({
  tabs,
  ariaLabel,
  value,
  defaultValue,
  onValueChange,
  renderPanel,
  className,
}: TabsProps) {
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [internal, setInternal] = useState<string>(
    defaultValue ?? tabs[0]?.id ?? "",
  );
  const active = value ?? internal;

  const select = useCallback(
    (id: string) => {
      if (value === undefined) setInternal(id);
      onValueChange?.(id);
    },
    [value, onValueChange],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    if (i < 0) return;
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    select(tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className="flex items-center gap-4 border-b border-border-subtle"
      >
        {tabs.map((t, idx) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              role="tab"
              id={tabId(t.id)}
              aria-selected={selected}
              aria-controls={panelId(t.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(t.id)}
              className={cn(
                "inline-flex items-center gap-6 px-12 py-8 -mb-px border-b-2 font-sans text-caption transition-colors duration-fast",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-t-sm",
                selected
                  ? "border-brand text-text-primary font-semibold"
                  : "border-transparent text-text-tertiary font-medium hover:text-text-secondary",
              )}
            >
              {t.label}
              {t.badge && (
                <span className="text-label font-semibold px-2 py-px rounded-full bg-surface-secondary text-text-tertiary">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={panelId(active)}
        aria-labelledby={tabId(active)}
        tabIndex={0}
        className="focus:outline-none"
      >
        {renderPanel(active)}
      </div>
    </div>
  );
}
