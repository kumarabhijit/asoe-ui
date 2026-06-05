/**
 * useEvidenceSelection — shared evidence selection for ADR-043 field↔source
 * linking.
 *
 * The "selected evidence" is a backend-authoritative `EvidenceAnchor
 * .supports_ref` (or the equivalent `ExtractedEntity.evidence_ref`). A panel
 * wraps its evidence sections in `<EvidenceSelectionProvider>`; a section that
 * knows a row's ref calls `selectRef(ref)` to foreground the matching
 * in-document anchor, and the document viewer reads `selectedRef` to emphasise
 * it.
 *
 * This is ephemeral UI highlight state keyed on an authoritative ref — NOT
 * data composition (Guardrail #6). Each surface still renders only its own
 * backend payload; the shared key merely coordinates which evidence is
 * foregrounded. Lives in `hooks/` (not `app/exceptions/shared`) so a
 * `components/ui` viewer can consume it without a components→app dependency.
 *
 * The default context is a safe no-op pair, so a consumer (e.g.
 * AttachmentPreview in the a11y sweep) renders correctly with no provider.
 */
"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export interface EvidenceSelection {
  selectedRef: string | null;
  selectRef: (ref: string | null) => void;
}

const EvidenceSelectionContext = createContext<EvidenceSelection>({
  selectedRef: null,
  selectRef: () => {},
});

export function useEvidenceSelection(): EvidenceSelection {
  return useContext(EvidenceSelectionContext);
}

/**
 * Provider holding the selected ref. The panel mounts this with
 * `key={exceptionId}` so switching records remounts the provider and drops a
 * stale highlight — no explicit reset wiring needed.
 */
export function EvidenceSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  // Toggle semantics: selecting the already-selected ref clears it.
  const selectRef = (ref: string | null) =>
    setSelectedRef((cur) => (ref !== null && cur === ref ? null : ref));
  return (
    <EvidenceSelectionContext.Provider value={{ selectedRef, selectRef }}>
      {children}
    </EvidenceSelectionContext.Provider>
  );
}
