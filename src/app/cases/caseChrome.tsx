/**
 * caseChrome — shared origin / SLA visual maps for the /cases surfaces.
 *
 * Phase 3 consolidation (2026-06-11): these maps were copy-pasted in
 * FOUR files (page.tsx, CasesQueueRow.tsx, CasesQueueRowV2.tsx,
 * CaseDetailPanel.tsx) — a new Origin value meant four edits. The row
 * copies were deliberately self-contained "for rollback" during the V2
 * row rollout; a shared module doesn't impede that rollback (the flag
 * still switches which row renders), so the duplication had no
 * remaining payoff.
 *
 * These are visual mapping functions per Guardrail #1: the vocabulary
 * itself comes from the backend (ALLOWED_CASE_ORIGINS via the api
 * boundary; SLA bands from the shared slaSnapshot derivation) — these
 * maps only attach chrome to known values, with a `default` fallback
 * for unknown ones so a new backend value renders safely untyped.
 *
 * Per requirements §4 Q7 the visible "Customer Inbox" label is stable
 * even though the internal field pivoted CaseSource → Origin: partners
 * read the chrome, not the field name. (Locked by
 * tests/architectural/customer_inbox_lens.test.ts.)
 */
import { Clock, Mail, PackageCheck } from "lucide-react";
import type { Origin, SlaBand } from "@/types/cases";

export const ORIGIN_LABEL: Record<Origin | "default", string> = {
  CUSTOMER: "Customer Inbox",
  API: "API",
  default: "Unknown origin",
};

const ORIGIN_ICON_COMPONENT: Record<Origin | "default", typeof Mail> = {
  CUSTOMER: Mail,
  API: PackageCheck,
  default: Clock,
};

/** Origin glyph at the caller's size — queue rows use 12, the case
 *  detail header 14. Unknown origins get the `default` glyph. */
export function originIcon(
  origin: string | undefined,
  size = 12,
): React.ReactNode {
  const Icon =
    ORIGIN_ICON_COMPONENT[(origin ?? "default") as Origin | "default"]
    ?? ORIGIN_ICON_COMPONENT.default;
  return <Icon size={size} aria-hidden />;
}

export const SLA_BAND_VARIANT: Record<
  SlaBand,
  "error" | "warning" | "success" | "neutral"
> = {
  breached: "error",
  at_risk: "warning",
  today: "warning",
  comfortable: "success",
  none: "neutral",
};
