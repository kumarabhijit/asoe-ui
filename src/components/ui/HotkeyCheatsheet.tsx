// HotkeyCheatsheet — `?` overlay listing keyboard shortcuts.
//
// S2 sprint 2026-05-28 finding #5. F6/Shift+F6, j/k, ⌘+Enter, the
// new ribbon A/R/O/E/Y bindings all exist in the source but were
// invisible to the operator. The cheatsheet renders the registry
// in `src/lib/hotkeys.ts` grouped by scope, opened with `?` and
// closed with Escape or backdrop click.
//
// The cheatsheet is mounted once at the `/cases` page level (the
// only surface that currently registers ribbon hotkeys). When the
// keymap grows to other routes the mount moves to the root layout.
//
// All visual values come from the design-token surface chrome
// already used by Sidebar.tsx (the closest existing dialog pattern)
// — Tailwind class tokens like `bg-surface-primary`, `border-border`,
// `z-modal`, `bg-black/15` for backdrop. No new color literals.

"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { HOTKEYS, HOTKEY_SCOPE_LABEL, type HotkeyScope } from "@/lib/hotkeys";
import { useHotkeys } from "@/hooks/useHotkeys";

const SCOPE_ORDER: HotkeyScope[] = [
  "global",
  "queue",
  "picker",
  "ribbon",
  "comment",
];

export function HotkeyCheatsheet() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // `?` toggles the overlay. Escape closes; Escape is also handled
  // by the backdrop's onClick path so a sighted user can dismiss
  // either way.
  useHotkeys([
    { key: "?", requiresShift: true, handler: () => setOpen((o) => !o) },
    { key: "Escape", handler: () => setOpen(false), enabled: open },
  ]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 bg-black/15 z-modal animate-in fade-in duration-fast"
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-modal bg-surface-primary border border-border rounded-md shadow-xl p-24 max-w-[480px] w-[90vw] max-h-[80vh] overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
      >
        <div className="flex items-center justify-between mb-16">
          <h2 className="text-subhead font-semibold text-text-primary m-0">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close shortcuts"
            className="bg-transparent border-none cursor-pointer text-text-tertiary p-4 flex rounded-sm transition-colors duration-fast hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
          >
            <X size={16} />
          </button>
        </div>

        <dl className="m-0 flex flex-col gap-16">
          {SCOPE_ORDER.map((scope) => {
            const items = HOTKEYS.filter((h) => h.scope === scope);
            if (items.length === 0) return null;
            return (
              <div key={scope}>
                <dt className="text-label uppercase tracking-wider text-text-quaternary mb-6">
                  {HOTKEY_SCOPE_LABEL[scope]}
                </dt>
                <div className="flex flex-col gap-4">
                  {items.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-12 text-caption"
                    >
                      <span className="text-text-secondary">{h.description}</span>
                      <kbd className="font-mono text-label px-6 py-1 bg-surface-secondary border border-border-subtle rounded-sm text-text-primary shrink-0">
                        {h.label}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </dl>

        <p className="mt-16 text-label text-text-tertiary">
          Press <kbd className="font-mono px-2 py-px bg-surface-secondary border border-border-subtle rounded-sm">?</kbd> anywhere to toggle this list.
        </p>
      </div>
    </>
  );
}
