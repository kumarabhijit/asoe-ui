// Combobox — typeahead-filterable single-select dropdown.
//
// S2 sprint follow-up — finding #6. Replaces the native `<select>`
// in surfaces where the operator picks from a small-but-growing
// vocabulary and benefits from typeahead filtering across the full
// option label (not just the first letter that native `<select>`
// supports). Today's only consumer is `OverrideChooserDialog`'s
// resolution-action and reason-tag pickers; future consumers like a
// global case-id search or per-intent recipe override can mount it
// the same way.
//
// Built on `cmdk`'s `Command` primitive which provides the input +
// filtered list + keyboard nav contract (Arrow / Enter / Esc) and
// the APG combobox ARIA shape. We add:
//
//   * Trigger button that opens the popover and surfaces the
//     current selection as its label (matches the native `<select>`
//     visual contract so callers don't have to restyle the row).
//   * Absolute-positioned popover list below the trigger. No extra
//     Radix popover dependency — we render a portal-free overlay
//     and close it on outside click / Escape / blur off the
//     container. This works inside a Radix Dialog (today's only
//     mount context) because the dialog's focus trap permits a
//     descendant input + listbox.
//   * Optional grouping via `groups`. When absent the items render
//     as a flat list — matches the optgroup vs flat behaviour the
//     consumer already implements.
//
// Vocabularies are passed in as `items` / `groups`. The component
// holds zero enum literals (Guardrail #2 preserved). Values flow as
// strings; the consumer maps to its domain types.

"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { Command } from "cmdk";

import { cn } from "@/lib/utils";

export interface ComboboxItem {
  /** Stable identifier — what `onChange` returns and `value` matches. */
  value: string;
  /** Display label rendered in the trigger + list row. */
  label: string;
}

export interface ComboboxGroup {
  /** Heading text rendered above the group. */
  heading: string;
  items: readonly ComboboxItem[];
}

export interface ComboboxProps {
  /** Selected value (controlled). Empty string means "no selection". */
  value: string;
  onChange: (value: string) => void;
  /**
   * Flat list of items. Mutually exclusive with `groups` — pass one
   * or the other. Both empty renders an empty-state row.
   */
  items?: readonly ComboboxItem[];
  /**
   * Grouped list of items. Equivalent to the consumer's `<optgroup>`
   * shape. Headings are rendered as group labels.
   */
  groups?: readonly ComboboxGroup[];
  /** Trigger button accessible name. */
  ariaLabel: string;
  /** Placeholder shown in the trigger when nothing is selected. */
  placeholder?: string;
  /** Optional placeholder for the typeahead input. */
  filterPlaceholder?: string;
  /** ARIA required flag mirrored onto the trigger button. */
  required?: boolean;
  disabled?: boolean;
  /** Optional dom id for the trigger button (label `for=` targets). */
  id?: string;
}

/** Walk both shapes to find the label for a value — used in the trigger. */
function findLabel(
  value: string,
  items?: readonly ComboboxItem[],
  groups?: readonly ComboboxGroup[],
): string | null {
  if (!value) return null;
  if (items) {
    const hit = items.find((i) => i.value === value);
    if (hit) return hit.label;
  }
  if (groups) {
    for (const g of groups) {
      const hit = g.items.find((i) => i.value === value);
      if (hit) return hit.label;
    }
  }
  return null;
}

export const Combobox = forwardRef<HTMLButtonElement, ComboboxProps>(
  function Combobox(
    {
      value,
      onChange,
      items,
      groups,
      ariaLabel,
      placeholder = "Select…",
      filterPlaceholder = "Type to filter…",
      required = false,
      disabled = false,
      id,
    },
    triggerRef,
  ) {
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState("");
    const containerRef = useRef<HTMLDivElement | null>(null);

    const selectedLabel = useMemo(
      () => findLabel(value, items, groups),
      [value, items, groups],
    );

    // Close on outside click. The dialog overlay above us still
    // owns the Escape contract — cmdk's Command also forwards
    // Escape via onKeyDown so we cover it twice for safety.
    useEffect(() => {
      if (!open) return;
      function onDown(ev: MouseEvent) {
        if (!containerRef.current) return;
        if (!containerRef.current.contains(ev.target as Node)) {
          setOpen(false);
        }
      }
      document.addEventListener("mousedown", onDown);
      return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    const pick = useCallback(
      (next: string) => {
        onChange(next);
        setOpen(false);
        setFilter("");
      },
      [onChange],
    );

    function renderItem(item: ComboboxItem): ReactNode {
      const active = item.value === value;
      return (
        <Command.Item
          key={item.value}
          value={item.label}
          data-value={item.value}
          onSelect={() => pick(item.value)}
          className={cn(
            "flex items-center gap-8 px-8 py-6 rounded-sm cursor-pointer",
            "text-caption text-text-primary",
            "data-[selected=true]:bg-surface-row-active",
            "aria-selected:bg-surface-row-active",
          )}
        >
          <span className="flex-1 truncate">{item.label}</span>
          {active && (
            <Check size={12} aria-hidden className="text-brand shrink-0" />
          )}
        </Command.Item>
      );
    }

    return (
      <div ref={containerRef} className="relative">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-required={required || undefined}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "h-[32px] w-full flex items-center justify-between gap-8 rounded-md border border-border bg-surface-primary px-8",
            "text-caption font-medium text-left",
            selectedLabel ? "text-text-primary" : "text-text-quaternary",
            "focus:outline-none focus:ring-2 focus:ring-brand-ring focus:border-border-brand",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-colors duration-fast",
          )}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronDown
            size={12}
            aria-hidden
            className={cn(
              "shrink-0 text-text-tertiary transition-transform duration-fast",
              open && "rotate-180",
            )}
          />
        </button>
        {open && (
          <div
            className={cn(
              "absolute z-modal left-0 right-0 top-[calc(100%+4px)]",
              "bg-surface-primary border border-border rounded-md shadow-lg",
              "max-h-[260px] overflow-hidden flex flex-col",
            )}
          >
            <Command
              loop
              onKeyDown={(ev: ReactKeyboardEvent) => {
                if (ev.key === "Escape") {
                  ev.stopPropagation();
                  setOpen(false);
                  setFilter("");
                }
              }}
            >
              <div className="flex items-center gap-6 px-8 py-6 border-b border-border-subtle">
                <Search
                  size={12}
                  aria-hidden
                  className="text-text-quaternary shrink-0"
                />
                <Command.Input
                  autoFocus
                  value={filter}
                  onValueChange={setFilter}
                  placeholder={filterPlaceholder}
                  aria-label={`${ariaLabel} filter`}
                  className="flex-1 bg-transparent border-none outline-none text-caption text-text-primary placeholder:text-text-quaternary"
                />
              </div>
              <Command.List className="flex-1 overflow-y-auto p-4">
                <Command.Empty className="px-8 py-12 text-caption text-text-tertiary">
                  No matches.
                </Command.Empty>
                {items && items.map((it) => renderItem(it))}
                {groups &&
                  groups.map((g) => (
                    <Command.Group
                      key={g.heading}
                      heading={g.heading}
                      className="text-label uppercase tracking-wider text-text-quaternary [&_[cmdk-group-heading]]:px-8 [&_[cmdk-group-heading]]:py-4"
                    >
                      {g.items.map((it) => renderItem(it))}
                    </Command.Group>
                  ))}
              </Command.List>
            </Command>
          </div>
        )}
      </div>
    );
  },
);
