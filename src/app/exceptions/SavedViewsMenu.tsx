/**
 * SavedViewsMenu — "Views ▾" trigger that opens a dropdown of
 * persisted filter snapshots (lifecycle states + intents + today-pill +
 * search). Slice-3 of the search-UX uplift.
 *
 * Behaviour
 *   - Trigger displays a count badge when the operator has any saved
 *     views; "Views" alone otherwise.
 *   - Dropdown rows: name + delete (×). Click name → applies the view
 *     (replaces all four filter dimensions in one go).
 *   - "Save current view…" entry opens a Dialog with a name input.
 *     Disabled when there are no active filters (saving an empty view
 *     is meaningless).
 *
 * Storage and the CRUD surface live in `useSavedViews`; this component
 * is a dumb projector over that hook plus the parent's apply handler.
 */
"use client";

import { useState } from "react";
import { Bookmark, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  useSavedViews,
  type SavedView,
  type SavedViewFilters,
} from "@/hooks/useSavedViews";

interface SavedViewsMenuProps {
  /** Snapshot of the current filter state — used as the body of the
   *  next saved view when the operator clicks "Save current view…". */
  currentFilters: SavedViewFilters;
  /** Apply a saved view to the queue. Parent updates all four filter
   *  dimensions in one render so the URL syncs in a single replace. */
  onApply: (view: SavedView) => void;
}

export function SavedViewsMenu({
  currentFilters,
  onApply,
}: SavedViewsMenuProps) {
  const { views, save, remove, hydrated } = useSavedViews();
  const [saveOpen, setSaveOpen] = useState(false);
  const [draftName, setDraftName] = useState("");

  function commitSave() {
    save(draftName, currentFilters);
    setDraftName("");
    setSaveOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={
              views.length > 0
                ? `Saved views (${views.length})`
                : "Saved views"
            }
          >
            <Bookmark size={12} className="mr-4" />
            Views
            {hydrated && views.length > 0 && (
              <span className="ml-4 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-brand-subtle text-brand text-label font-bold">
                {views.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[240px]">
          {views.length === 0 ? (
            <DropdownMenuLabel>No saved views yet</DropdownMenuLabel>
          ) : (
            views.map((view) => (
              <SavedViewRow
                key={view.id}
                view={view}
                onApply={() => onApply(view)}
                onRemove={() => remove(view.id)}
              />
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            // Always enabled — saving an "All exceptions" view (no
            // filters) is a legitimate use case and the previous
            // gate-on-active-filters made the item look broken when
            // the operator opened the menu before setting any filter.
            // Suppress the auto-close-on-select; we open the Dialog
            // ourselves and need the focus to land in the name input.
            onSelect={(e) => {
              e.preventDefault();
              setSaveOpen(true);
            }}
            className="flex items-center gap-6"
          >
            <Plus size={11} />
            <span>Save current view…</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
            <DialogDescription>
              Captures the current filters and search box. Stored in your
              browser only — clear browser data and the view is gone.
            </DialogDescription>
          </DialogHeader>
          <Input
            label="Name"
            placeholder="e.g. Walmart HITL queue"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            // Enter submits on top of the explicit Save button, so
            // operators can name + Enter without reaching for the mouse.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitSave();
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" size="sm" onClick={commitSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SavedViewRow({
  view,
  onApply,
  onRemove,
}: {
  view: SavedView;
  onApply: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Saved view ${view.name}`}
      className="flex items-center gap-4 px-4 py-2"
    >
      <button
        type="button"
        onClick={onApply}
        className={cn(
          "flex-1 text-left bg-transparent border-none cursor-pointer font-sans px-8 py-4 rounded-sm",
          "text-caption text-text-primary hover:bg-surface-row-hover",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        )}
      >
        <span className="block truncate">{view.name}</span>
        <span className="block text-label text-text-quaternary mt-px">
          {summariseView(view)}
        </span>
      </button>
      <button
        type="button"
        aria-label={`Delete saved view ${view.name}`}
        onClick={onRemove}
        className={cn(
          "shrink-0 p-4 rounded-sm bg-transparent border-none cursor-pointer text-text-quaternary",
          "hover:text-error hover:bg-error-subtle",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring",
        )}
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

/** Render a one-line summary of a saved view's filter set so the
 *  operator can tell two saved views apart at a glance without
 *  applying them. Counts states/intents rather than enumerating to
 *  keep the row short. */
function summariseView(v: SavedView): string {
  const parts: string[] = [];
  // The SavedViewsMenu lives under /exceptions/ today and only the
  // exception-surface views are rendered through it (the cases
  // surface gets its own menu in CaseListPane). We narrow here
  // rather than rendering a "case view" in the wrong place.
  if (v.surface !== "exceptions") return "case view";
  if (v.filterStates.length > 0) {
    parts.push(
      v.filterStates.length === 1
        ? v.filterStates[0].replace(/_/g, " ").toLowerCase()
        : `${v.filterStates.length} states`,
    );
  }
  if (v.filterIntents.length > 0) {
    parts.push(
      v.filterIntents.length === 1
        ? v.filterIntents[0].replace(/_/g, " ").toLowerCase()
        : `${v.filterIntents.length} intents`,
    );
  }
  if (v.filterDate === "today") parts.push("today");
  if (v.searchQuery) parts.push(`"${v.searchQuery}"`);
  return parts.length === 0 ? "no filters" : parts.join(" · ");
}
