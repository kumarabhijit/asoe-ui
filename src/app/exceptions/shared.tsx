/**
 * Shared helper components + pure utilities for exception detail
 * sub-components. Utilities live here (not in ExceptionDetailPanel)
 * so the orchestrator stays focused on orchestration.
 *
 * ADR-027 Phase C: PIPELINE_NODES + STATE_PROGRESS + buildNodeStates
 * are deleted. The drift surface they represented is closed —
 * EventsTimeline + PipelineDAG consume the trace's `executed_nodes`
 * and the topology endpoint directly, so the UI no longer mirrors
 * the backend graph shape.
 */
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * DoR #11 — Layer-2-open signal. A panel wraps its evidence sections in this
 * provider; every CollapsibleSection then reports the first time it is expanded,
 * with no per-section wiring. Null (the default) means "nobody is listening".
 */
export const Layer2OpenContext = createContext<(() => void) | null>(null);
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one business-rule lifecycle literal referenced in
 * ExceptionDetailPanel — cosign banner gate. Mirrors
 * `contracts/models.py::COSIGN_ELIGIBLE_STATES`.
 */
export const COSIGN_LIFECYCLE_STATE = "PENDING_COSIGN" as const;

/**
 * UX-meaningful grouping of lifecycle states where the operator is
 * expected to take action. Drives:
 *   - `AgentAnalysisSection` auto-expand in `ExceptionDetailPanel`
 *   - the "HITL queue" quick-filter pill in `ExceptionListPane`
 *
 * **Not** a backend enum gate — Guardrail #1 forbids hardcoding enum
 * values for filter dropdowns or business logic. This is a UI-side
 * classification (which states represent "human action expected") and
 * the values themselves come from `health.lifecycle_states` at render
 * time. Lives in `shared.tsx` so both detail panel and list pane
 * share one definition.
 */
export const HITL_LIFECYCLE_STATES: ReadonlySet<string> = new Set([
  "PENDING_REVIEW",
  "ESCALATED",
  "PENDING_ADMIN_REVIEW",
  "PENDING_COSIGN",
  "BLOCKED",
]);

/**
 * Hash-driven expand + scroll (S1 finding #10 follow-on). When the URL hash
 * targets `#<id>`, invoke `onMatch` (the caller opens its section + fires any
 * first-open telemetry) and scroll the referenced element into view on the
 * next frame, after the children have mounted. Runs on mount and on every
 * `hashchange` so an in-page anchor works repeatedly. No-op without an `id`.
 *
 * One mechanism shared by CollapsibleSection, EvidenceGrid, and
 * DiagnosticsSection so every "Jump to …" link reveals its target rather than
 * scrolling to a collapsed shell.
 */
export function useHashOpen<T extends HTMLElement>(
  id: string | undefined,
  ref: RefObject<T | null>,
  onMatch: () => void,
) {
  useEffect(() => {
    if (!id || typeof window === "undefined") return;
    const handle = () => {
      if (window.location.hash !== `#${id}`) return;
      onMatch();
      requestAnimationFrame(() => {
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    handle();
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
    // `onMatch`/`ref` are stable for the caller's purpose; the open-state guard
    // makes re-runs idempotent. Keyed on `id` so it re-binds if that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}

/** Collapsible section header — matches Evidence Detail card pattern */
export function CollapsibleHeader({ title, open, onToggle, badge, badgeVariant = "neutral", controlsId }: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  badgeVariant?: string;
  /** id of the region this header expands/collapses — wires `aria-controls`
   *  so AT can associate the toggle with the panel it governs. */
  controlsId?: string;
}) {
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controlsId}
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

/**
 * CollapsibleSection — wraps an enrichment section in a collapsible
 * card. Used to keep all panes other than the Recommendation
 * minimised by default (TRB ruling on PO request #4). The wrapped
 * children are mounted only when `open` is true so heavy renders
 * (e.g., big tables, charts) don't run until the operator opens the
 * pane.
 */
export function CollapsibleSection({
  title,
  id,
  defaultOpen = false,
  badge,
  badgeVariant,
  children,
  onFirstOpen,
  extraAnchorIds,
}: {
  title: string;
  /** Stable anchor id (S1 finding #10 follow-on). When set, the section
   *  auto-expands and scrolls into view if the URL hash targets it
   *  (`#<id>`) — so every "Jump to …" link both navigates AND reveals a
   *  collapsed section, not just scrolls to a collapsed shell. */
  id?: string;
  defaultOpen?: boolean;
  badge?: string;
  badgeVariant?: string;
  children: ReactNode;
  /** Fired the first time the operator expands this section (DoR #11 —
   *  Layer-2-open signal). Optional + idempotent; never fires on collapse. */
  onFirstOpen?: () => void;
  /** Anchor ids of nested descendants (stacked-group layout 2026-06-09).
   *  When this section groups child sections under one disclosure, a deep
   *  link to a child's anchor (e.g. `#section-source-email`) would target an
   *  unmounted node while the group is collapsed. Listing the descendants'
   *  ids here makes the GROUP open on their hash too; the child's own
   *  `useHashOpen` then scrolls within once it mounts. */
  extraAnchorIds?: string[];
}) {
  const [open, setOpen] = useState(defaultOpen);
  const firedRef = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  // Stable id for the collapsible region so the header's aria-controls
  // resolves. Derived from the anchor `id` when present, else a useId.
  const reactId = useId();
  const regionId = id ? `${id}-region` : reactId;
  const reportLayer2Open = useContext(Layer2OpenContext);
  // First-open side effects (telemetry) fire exactly once, whether the
  // section is opened by a click or by a hash jump.
  const fireFirstOpen = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    onFirstOpen?.();
    reportLayer2Open?.();
  };
  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) fireFirstOpen();
      return next;
    });
  };

  // Hash-driven expand + scroll (anchor bar, "Jump to source email" link, the
  // Knowledge Graph link). Open first (mounting children) + fire telemetry,
  // then the hook scrolls on the next frame once the target has full height.
  useHashOpen(id, sectionRef, () => {
    setOpen((v) => {
      if (!v) fireFirstOpen();
      return true;
    });
  });

  // Descendant-anchor reveal (stacked-group layout 2026-06-09). A jump to a
  // child section's anchor must first open this group so the child mounts;
  // the child's own useHashOpen then handles the in-group scroll. Runs on
  // mount and every hashchange, mirroring useHashOpen's contract.
  const extraKey = extraAnchorIds?.join(",") ?? "";
  useEffect(() => {
    if (!extraAnchorIds?.length || typeof window === "undefined") return;
    const handle = () => {
      const target = window.location.hash.replace(/^#/, "");
      if (!target || !extraAnchorIds.includes(target)) return;
      setOpen((v) => {
        if (!v) fireFirstOpen();
        return true;
      });
    };
    handle();
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
    // `extraKey` captures membership; `fireFirstOpen` is stable for our purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraKey]);

  return (
    <section
      ref={sectionRef}
      id={id}
      className="scroll-mt-[var(--nav-height)] bg-surface-primary rounded-md shadow-sm overflow-hidden"
    >
      <CollapsibleHeader
        title={title}
        open={open}
        onToggle={toggle}
        badge={badge}
        badgeVariant={badgeVariant}
        controlsId={regionId}
      />
      {/* The region element is always present (so aria-controls resolves even
          when collapsed) but `hidden` when closed; heavy children still mount
          lazily on first open to preserve the perf contract. */}
      <div id={regionId} hidden={!open} className={cn(open && "border-t border-border")}>
        {open && children}
      </div>
    </section>
  );
}

/**
 * Magnitude price formatter — for values that are always >= 0 (unit prices,
 * totals, at-risk amounts). `Math.abs` is a defensive guard against an
 * accidental negative on these magnitude fields. For SIGNED deltas (variances,
 * freight deltas, price adjustments) use `fmtSignedPrice` / `fmtMoney` from
 * `@/lib/format` — those keep the sign so direction is never colour-only (T3).
 */
export function fmtPrice(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
