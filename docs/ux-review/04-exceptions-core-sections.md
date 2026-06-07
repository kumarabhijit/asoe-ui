# UX/UI Review — Exceptions Detail: CORE Sections

**Slice:** Right-pane detail surface scaffolding (container + core sections)
**Reviewer:** QA / UX-UI Evaluator
**Date:** 2026-06-06
**Scope note:** `AgentReasoningCard`, `ActionButtonMatrix`, and `StickyActionRibbon` are reviewed separately and only referenced here.

---

## Summary verdict counts

| Verdict | Count |
|---|---|
| Pass | 4 |
| Needs Minor Tweaks | 8 |
| Needs Rework | 2 |

Components: ExceptionDetailPanel, ContextStrip, HeaderRibbon, AgentAnalysisSection, DiagnosticsSection, EntitiesSection, EvidenceGrid, DraftReplySection, EmailSourceSection, EmailOrderEntrySection, OrderEntrySection, KnowledgeGraphSection, OverrideChooserDialog, shared.tsx.

---

### ExceptionDetailPanel
**Context**
- Pane Name: Unified polymorphic exception detail (right pane of the master-detail / cases workspace).
- Primary Goal: Orchestrate Layer-1 (Recommendation/action) + Layer-2 (enrichment/evidence/diagnostics) so an operator can decide in seconds and drill on demand.
- Target Audience: O2C operators / analysts / managers (RBAC-gated).

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- `ExceptionDetailPanel.tsx:633` gates the sticky action ribbon on `CASES_ROW_V2 && detail?.shadow_verdict`. When V2 is ON but `shadow_verdict` is null AND `lifecycle_state === "FAILED"`, the ribbon is suppressed and the only action surface is the legacy `AgentReasoningCard` branch (`:870`), which is itself flag-gated to `hideActionMatrix={CASES_ROW_V2}` (`:856`). Trace the matrix: with V2 ON + no verdict + FAILED, the card renders the execution-error banner (`:881`) with NO actions, and the ribbon never mounts. A manager has no Re-analyze/Escalate affordance for a failed-pipeline record in V2 mode. Verify against intended V2 behaviour — this looks like an action-surface gap on the FAILED+no-verdict path.
- `ExceptionDetailPanel.tsx:528` `showPreview` reads `process.env.NEXT_PUBLIC_SHOW_PREVIEW_FEATURES !== "false"` — defaults preview tabs (SAP Data, Change Analysis in Diagnostics) to ON. Those tabs render only placeholder italic copy (DiagnosticsSection:391-400). Shipping placeholder-only tabs ON-by-default to production operators is a polish risk; confirm the env default is "false" in prod.
- `ExceptionDetailPanel.tsx:692-748` the cosign banner reads `pending_override` from `resolution_data` via `as` casts and renders `pending.action` / `pending.reason_tag` directly. `reason_tag` gets `.replace(/_/g," ")` (`:713`) but `pending.action` (`:711`) is shown raw (e.g. `RELEASE_CREDIT_BLOCK`) — inconsistent formatting with the dialog/ribbon which humanize action codes.
- `ExceptionDetailPanel.tsx:1103-1116` Created/Updated metadata uses `new Date(...).toLocaleString()` with no guard for an unparseable timestamp; an invalid date renders "Invalid Date". Low-likelihood (backend ISO), but `DraftReplySection.formatTimestamp` (DraftReplySection.tsx:401) already models the safe passthrough — inconsistent handling across the slice.

**Usability Issues**
- `ExceptionDetailPanel.tsx:903-907` the "Agent analysis pending — Compliance Shadow has not yet completed." fallback uses `AlertTriangle` (a warning glyph) for a neutral/in-progress state. A pending state reads as an error at a glance; an Activity/Loader indicator (agent-first pattern) would be truer.
- `ExceptionDetailPanel.tsx:1063` `AI Draft Reply` is `defaultOpen`, while Source Email / Knowledge Graph / all enrichment sections are collapsed. The draft is Layer-2 evidence; opening it by default competes with the Recommendation card (Layer-1) for the operator's first glance. Reasonable product call, but it is the one enrichment section that breaks the "collapsed by default" rule (shared.tsx CollapsibleSection) — flag for intent confirmation.
- `ExceptionDetailPanel.tsx:590-594` `SectionAnchorBar` only surfaces Recommendation / Source Email / Knowledge Graph / Draft Reply / Evidence / Diagnostics. The many enrichment sections (Price Analysis, Duplicate Detection, EDI Mismatch, etc., `:939-1047`) have no jump target, so on a record with 6+ enrichment cards the operator still linearly scrolls to reach them — the bar partially solves the stated problem (S1 finding #10).
- `ExceptionDetailPanel.tsx:437-450` loading skeleton renders generic blocks with no `aria-busy`/`role="status"` and no text alternative. The fetch-error and pending states have `role`/`aria-live`, but the loading state is silent to screen readers.

**Simplicity Opportunities**
- `ExceptionDetailPanel.tsx:674-680` and `:862-868` duplicate the exact `availableReasonTags` per-intent fallback expression at two mount points. The comment acknowledges this is intentional (byte-for-byte audit invariant), but a single `const availableReasonTags = …` derived once would remove the copy-paste drift risk while staying identical at the wire level.
- `ExceptionDetailPanel.tsx` is ~1225 lines and mixes data-fetch, lazy-load orchestration, telemetry wrappers, cosign banner JSX, reanalysis banner JSX, and the anchor bar. The cosign banner IIFE (`:692-748`) and reanalysis banner (`:754-773`) are self-contained and would read better extracted (matching how actions already moved to `useExceptionActions`).

**Top 3 Actionable Recommendations**
1. Audit the V2 + FAILED + no-`shadow_verdict` path (`:633` vs `:870`): ensure a manager retains Re-analyze/Escalate when the pipeline crashed before writing a verdict.
2. Swap the pending-shadow `AlertTriangle` (`:905`) for an activity/progress indicator and add `role="status"` + visually-hidden text to the loading skeleton (`:437`).
3. Humanize `pending.action` in the cosign banner (`:711`) to match the rest of the action vocabulary, and extract the cosign + reanalysis banners into named sub-components.

---

### ContextStrip
**Context**
- Card Name: Entity Profile + Impact & Risk strip (Layer-2 enrichment).
- Primary Goal: Surface customer master data and blast-radius metrics on demand.
- Target Audience: Operators assessing customer importance / financial exposure.

**Overall Verdict:** Pass

**Correctness Issues**
- `ContextStrip.tsx:80` Delta renders `${fmtPrice(im.delta_amount)} (${im.delta_percentage.toFixed(1)}%)`. `fmtPrice` (shared.tsx:218-220) uses `Math.abs(n)`, so a negative delta loses its sign and shows positive dollars beside a possibly-negative percentage — sign mismatch. For a financial impact strip the direction of the delta is meaningful; confirm `delta_amount` is always non-negative or surface the sign.
- Clean on partial-truth: contextual fields use structural omission via `ContextRow` returning null (`:112`) rather than `?? "—"`, exactly per Guardrail #6. The inline comment (`:84-86`) documents a fixed duplicate-badge bug. Good.

**Usability Issues**
- `ContextStrip.tsx:37` header label is "Entity Profile" but the panel comment (ExceptionDetailPanel:575) and the right column header (`:74`) call it "Impact & Risk". The collapsed header names only one of the two columns it contains; "Entity & Impact" or similar would set expectations for what expands.
- `ContextStrip.tsx:79` `revenue_at_risk` renders in `text-error font-bold` always (via `highlight`), even when the value is small/zero — color-as-alarm with no threshold. Reads as "always critical." Needs visual/manual verification of intended severity semantics.

**Simplicity Opportunities**
- `ContextStrip.tsx:30` default-collapsed strip duplicating header-ribbon facts (customer/location) in standalone mode: the `embedded` plumbing is sound, but in standalone the Customer row (`:53`) repeats the HeaderRibbon breadcrumb customer — minor redundancy when both are visible.

**Top 3 Actionable Recommendations**
1. Confirm `delta_amount` sign handling at `:80`; if it can be negative, preserve the sign rather than `Math.abs`.
2. Rename the collapsed header (`:37`) to reflect both columns (entity + impact).
3. Gate the `highlight` error styling on a meaningful threshold/flag from the backend rather than always-red.

---

### HeaderRibbon
**Context**
- Card Name: Breadcrumb + status ribbon (Layer-1 context identifiers).
- Primary Goal: Orient the operator (which order/customer/SKU) and show lifecycle + audit verdict + total at a glance.
- Target Audience: Operators scanning a record.

**Overall Verdict:** Pass

**Correctness Issues**
- `HeaderRibbon.tsx:73-75` lifecycle Badge content is `detail.lifecycle_state.replace(/_/g," ")` and `:87-89` verdict Badge content is `detail.shadow_verdict` raw. Both go through `lifecycleVariant`/`verdictVariant` (allowed visual mapping). No partial-truth fallback. Clean per Guardrail #1/#2.
- `HeaderRibbon.tsx:99-103` Delta is shown only `if (delta !== 0)` as `Δ {fmtPrice(Math.abs(delta))}` in `text-error`. Same `Math.abs` sign-loss note as ContextStrip — a PO-over-ERP vs ERP-over-PO delta both render identically red with no direction. The `Δ` glyph + always-error color implies "bad" without telling the operator which way.

**Usability Issues**
- `HeaderRibbon.tsx:73` lifecycle and `:87` verdict badges sit in a `flex-wrap` row with explicit "Current State:" / "Audit Result:" labels — good for disambiguating the two pills (WCAG: not color-alone; text label present). No issue.
- `HeaderRibbon.tsx:96-98` `totalPo` renders as a bold mono number with no label; relies on the Evidence grid ("PO"/"ERP") for meaning. A bare currency figure in the header is mildly ambiguous (total of what?). A small "PO total" label or tooltip would help first-time users.

**Simplicity Opportunities**
- Clean and compact; no removable elements. The `embedded` suppression of breadcrumb + Audit Result is well-justified for de-duplication inside CaseDetailPanel.

**Top 3 Actionable Recommendations**
1. Preserve delta direction at `:99-103` (e.g. signed value or up/down glyph) so red doesn't conflate "PO higher" with "PO lower."
2. Add a short label/aria-label to the header total (`:96`) so the standalone figure is self-describing.
3. Otherwise ship as-is.

---

### AgentAnalysisSection
**Context**
- Card Name: Agent Analysis — Problem / Root Cause / Recommendation narrative (Layer-2, auto-expands in HITL states).
- Primary Goal: Give the reviewer the diagnosis prose when a record needs their judgement.
- Target Audience: Reviewers/managers at decision points.

**Overall Verdict:** Pass

**Correctness Issues**
- `AgentAnalysisSection.tsx:96-127` each of diagnosis/root_cause/recommendation renders only when present (structural omission). If ALL three are absent, the section renders an empty `border-t` body (`:87`) with zero content after the header — an empty expandable shell. Consider not mounting the open body when nothing is present. Low-likelihood (parent only mounts when `analysis` exists) but possible per the comment at `:88-95`.
- `AgentAnalysisSection.tsx:56-77` IntersectionObserver reports `entry.intersectionRatio` as scroll depth. `intersectionRatio` is the visible fraction of the element, not how far the operator has scrolled THROUGH it — for a section taller than the viewport the ratio caps below 1.0 and never reaches full "depth." The telemetry metric ("analysis scroll depth") is approximate; verify it matches the intended definition.

**Usability Issues**
- `AgentAnalysisSection.tsx:118-126` Recommendation prose is `text-brand font-semibold` inside a brand left-border block, visually echoing the actual Recommendation card (AgentReasoningCard). Two brand-colored "recommendation" surfaces on the same scroll can read as duplication; the panel comment (ExceptionDetailPanel:828-836) explicitly avoided this for the Recommendation card's explanation, but the Agent Analysis "Recommendation" block still mirrors the brand treatment.

**Simplicity Opportunities**
- The three near-identical blocks (`:96`, `:107`, `:118`) could be a small `NarrativeBlock({label, text, accent})` helper to cut repetition; DiagnosticsSection already has a `NarrativeBlock`.

**Top 3 Actionable Recommendations**
1. Guard the open body so an all-absent analysis doesn't render an empty expanded shell (`:86-128`).
2. Confirm the scroll-depth definition vs. `intersectionRatio` (`:71`).
3. Reduce the brand-treatment overlap between this block's "Recommendation" and the Recommendation card.

---

### DiagnosticsSection
**Context**
- Card Name: Diagnostics — Pipeline (timeline/DAG) + Reanalysis History + Trace Evidence (Layer-2, behind "Show Diagnostics").
- Primary Goal: Audit/debug surface — where the pipeline went and why.
- Target Audience: Analysts/admins/audit roles.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- `DiagnosticsSection.tsx:401-409` Resolution Data renders `JSON.stringify(detail.resolution_data, null, 2)` in a `<pre>`. This is raw JSON dumped to a SOX-relevant operator surface — keys like `pending_override`, internal flags, and any nested PII are exposed verbatim with no key humanization or redaction. Acceptable for an admin/audit "raw" view, but it is unconditional (any role that can open Diagnostics sees it). Confirm RBAC intent; at minimum label it as raw/debug.
- `DiagnosticsSection.tsx:349` Evidence tab body only renders `trace && (...)`. When `detailTab === "evidence"` and `trace` is null (still lazy-loading, or fetch failed and silently reset at ExceptionDetailPanel:417-420), the tab shows nothing — no "loading" and no "trace unavailable" message. The pane looks broken on a failed trace fetch.
- `DiagnosticsSection.tsx:91,151-158` `id={anchorId}` is placed on the toggle `<button>` while `scroll-mt-[var(--nav-height)]` is on that same button — but `useHashOpen` scrolls `toggleRef` (the button), which is fine; however the expanded content lives in a sibling `<div>` (`:172`), so a hash-jump scrolls to the toggle, not to revealed content. Minor: acceptable since the toggle is the section anchor.

**Usability Issues**
- `DiagnosticsSection.tsx:192-208` the Attempt `<select>` is a raw native select with `border-border` styling; elsewhere in the slice (OverrideChooserDialog) selects were upgraded to a typeahead `Combobox`. Inconsistent control vocabulary within the same detail surface. Native select is accessible, so this is consistency polish, not a defect.
- `DiagnosticsSection.tsx:150-170` the "Show/Hide Diagnostics" toggle is center-aligned, borderless, low-contrast `text-text-tertiary` — easy to miss as the entry point to the entire audit surface. Given audit users hit this first, a stronger affordance is warranted.
- `DiagnosticsSection.tsx:333-346` Trace Evidence tabs are `<button>`s without `role="tab"`/`role="tablist"`/`aria-selected`; keyboard users get buttons but not tab semantics. WCAG-functional but not ideal tab a11y.

**Simplicity Opportunities**
- `DiagnosticsSection.tsx` carries 7 collapsible/disclosure layers (Diagnostics → Pipeline → attempt → view; Reanalysis History; Trace Evidence → tabs → resolution data). Deeply nested disclosure increases clicks-to-evidence. Consider flattening Trace Evidence's inner Resolution Data behind one fewer level.

**Top 3 Actionable Recommendations**
1. Add an explicit "trace unavailable / loading" state to the Evidence tab when `trace` is null (`:349`) so a failed/lazy fetch doesn't render an empty pane.
2. Confirm RBAC + add a "Raw" label/redaction posture for the `JSON.stringify(resolution_data)` dump (`:401-409`).
3. Strengthen the "Show Diagnostics" toggle affordance (`:150`) and give the Trace Evidence tabs `role="tab"` semantics (`:333`).

---

### EntitiesSection
**Context**
- Card Name: Extracted entities (Customer Inbox, preview-only).
- Primary Goal: Show backend-extracted entities with optional confidence/source-span and field↔source linking.
- Target Audience: CSAs reviewing an email-channel order.

**Overall Verdict:** Pass

**Correctness Issues**
- Clean. Optional `confidence`/`source_span` flow through `EvidenceBlock` (`:91`, `:106`); the `evidence_ref` button only renders when `ref !== null` (`:117`) — no dead affordance, no `?? "—"`. Fully compliant with Guardrail #6.
- `EntitiesSection.tsx:46-48` `data.extracted.map` with no empty-state branch. If `extracted` is `[]`, the header shows "(0)" and an empty list. Parent gates on `analysis.entities_analysis` presence, not on `extracted.length`, so a present-but-empty payload renders a zero-count header with nothing under it. Minor — add an empty hint or suppress.

**Usability Issues**
- `EntitiesSection.tsx:84` the entity value uses `break-all`; long values (e.g. an email address or PO) will hard-break mid-token. `break-words` is usually friendlier for human-readable values. Needs visual verification.
- `EntitiesSection.tsx:128-129` toggle text changes "Show in source" ↔ "Showing in source" with `aria-pressed` — good. Clear affordance.

**Simplicity Opportunities**
- Tight and well-scoped. No removable elements.

**Top 3 Actionable Recommendations**
1. Add a graceful empty branch for `extracted.length === 0` (`:45`).
2. Reconsider `break-all` vs `break-words` for entity values (`:84`).
3. Otherwise ship as-is.

---

### EvidenceGrid
**Context**
- Card Name: Evidence Detail — line-item table + per-line pricing waterfall (Layer-2, collapsed by default).
- Primary Goal: Let the operator inspect line-level ERP vs PO discrepancies and the pricing breakdown.
- Target Audience: Operators verifying pricing exceptions.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- `EvidenceGrid.tsx:88-90` the line-count chip shows `"—"` when `lineItems.length === 0`. This is an ad-hoc dash placeholder in a collapsed-header chip. It's a UI count, not a backend audit field, so it is NOT strictly the Guardrail #6 partial-truth violation — but the dash conflates "still loading" (the expected pre-open state per the lazy-load comment) with "zero lines." Use "0 lines" or a loading affordance rather than a bare em-dash so it doesn't read as missing data on a SOX surface.
- `EvidenceGrid.tsx:106-110` when expanded with no lines, the body shows "Loading line items…" italic — but this same state also displays if the fetch genuinely returned zero lines (the loader sets `lineItemsLoaded=true` then `lineItems=[]`). A zero-line record perpetually reads "Loading…". No terminal empty state. Correctness/feedback bug on the empty path.
- `EvidenceGrid.tsx:130-151` table rows are clickable (`onClick={onSelectLine}`) but the `<tr>` is not keyboard-focusable and has no `role="button"`/`tabIndex`/key handler. Row selection is mouse-only — keyboard users can only select via the pill buttons below (`:163`). Accessibility gap for the primary selection affordance.
- `EvidenceGrid.tsx:174` the line-selector pill renders `Badge variant={rootCauseVariant(item.root_cause)}` but the badge text is `la.risk` — variant is keyed off root_cause while the label is risk. Mixing two different fields into one badge (color from root_cause, text from risk) can mislead (a "LOW" risk label tinted by a severe root_cause color). Verify this is intended.

**Usability Issues**
- `EvidenceGrid.tsx:141` description cell is `max-w-[200px] ... text-ellipsis whitespace-nowrap` with no title/tooltip — truncated SKU descriptions are unreadable with no way to see the full text.
- `EvidenceGrid.tsx:147-149` Root Cause badge cell is empty when `item.root_cause` is falsy — fine, but the column header always shows "Root Cause," leaving blank cells with no indication whether it's "none" vs "not analyzed."

**Simplicity Opportunities**
- `EvidenceGrid.tsx:156-179` the line-selector pills duplicate the line list already shown in the table directly above; on a multi-line order the operator sees each line twice. Consider making the table rows the single selection surface (with keyboard support) and dropping the pill row, or vice-versa.

**Top 3 Actionable Recommendations**
1. Add a terminal empty state distinct from loading (`:106-110`) and replace the `"—"` count chip (`:89`) so a zero-line record doesn't read "Loading…" forever.
2. Make table rows keyboard-selectable (`role`, `tabIndex`, Enter/Space) at `:130-151`, or consolidate selection into one accessible surface.
3. Add `title`/tooltip to the truncated description cell (`:141`) and confirm the pill badge color-vs-label field mix (`:174`).

---

### DraftReplySection
**Context**
- Card Name: AI Draft Reply — projected reply draft + inline composer + version history (Layer-2, defaultOpen).
- Primary Goal: Show the agent's drafted customer reply, allow an RBAC-gated edit (append-only revision), and jump to the source email.
- Target Audience: CSAs authorizing/editing outbound replies.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- `DraftReplySection.tsx:91-92` `editable = canEdit && !!onSubmitEdit && !rejected`. The "Edit in record detail" link (`:164`) renders when `editInDetailHref && !editable`. On a REJECTED draft in the detail mount (where `onSubmitEdit` IS passed and `canEdit` true), `editable` is false (rejected), so if `editInDetailHref` were also passed the link would appear pointing back to the same detail — self-referential. In practice the detail mount doesn't pass `editInDetailHref`, so it's latent; flag the interaction.
- `DraftReplySection.tsx:174-177` REJECTED reason uses `EvidenceBlock tier="contextual"`. A rejection reason on a rejected draft is arguably the audit-bearing fact that justifies the rejection — `contextual` means it's silently omitted if absent, so a REJECTED draft with no reason shows a red "REJECTED" badge and NO explanation. Consider `audit-bearing` (or `conditional` predicated on `rejected`) so a missing reason is flagged, not silently dropped.
- `DraftReplySection.tsx:99-100,232-245` the read-only body flows through `EvidenceBlock tier="contextual"`. For a DRAFTED (non-rejected) reply the body is the core deliverable; if absent it's structurally omitted with no signal. A DRAFTED status with empty body would render a header + badge and nothing else. Consider conditional tier predicated on `!rejected`.

**Usability Issues**
- `DraftReplySection.tsx:204-211` the Body textarea is a raw `<textarea>` with hand-rolled token classes rather than the project's `Input`/textarea primitive — the Subject field above (`:191`) uses the `Input` component. Inconsistent control styling within the same composer.
- `DraftReplySection.tsx:218-227` Save/Cancel buttons: while `saving`, Save shows "Saving…" and both disable — good feedback. No success confirmation in-section (the parent toasts), acceptable.
- `DraftReplySection.tsx:266-273,275-282` "Version history" disclosure and a separate "Drafted by …" line both appear at the card bottom; the drafted-by also appears inside the version history entries. Mild duplication of authorship metadata.

**Simplicity Opportunities**
- `DraftReplySection.tsx:381-387` the edits diff renders before/after with `line-through` + `truncate`; on long field values the truncation hides exactly what changed (the point of a diff). Consider wrapping or a hover-to-expand.

**Top 3 Actionable Recommendations**
1. Re-tier the REJECTED reason (`:175`) and the DRAFTED body (`:236`) as conditional/audit-bearing so a missing-but-expected value is flagged rather than silently omitted on this SOX surface.
2. Use the project textarea primitive for the Body field (`:204`) to match the Subject `Input`.
3. Improve diff legibility in Version history (`:381`) so truncation doesn't hide the changed text.

---

### EmailSourceSection
**Context**
- Card Name: Source email — inbound email metadata + body excerpt + attachment manifest + body hash (Layer-2 substrate).
- Primary Goal: Put the source email evidence on the same surface as the recommendation; support attachment preview/download with evidence anchors.
- Target Audience: CSAs authorizing email-channel orders.

**Overall Verdict:** Pass

**Correctness Issues**
- Strong Guardrail #6 discipline: audit-bearing fields (from/received/subject/manifest/body_hash) and contextual fields (source_email_id/body_excerpt) all flow through `EvidenceBlock` with correct tiers (`:75,89,98,112,120,134,216`). No `?? "—"`.
- `EmailSourceSection.tsx:138-145,142-143` the comment acknowledges that an empty attachment manifest (`[]`) is treated as absent by `EvidenceBlock.isPresent` (EvidenceBlock.tsx:95), so a legitimately attachment-less email triggers the dev warning and renders nothing for the Attachments block. For an audit-bearing field "no attachments" is a meaningful state the operator should see ("Attachments (0)"). This is a real correctness gap for the zero-attachment case — the block is suppressed instead of showing the empty manifest.

**Usability Issues**
- `EmailSourceSection.tsx:70-73` header icon `Mail` lacks `aria-hidden` (it's decorative; most other icons in the file pass `aria-hidden`). Minor inconsistency.
- `EmailSourceSection.tsx:176-191` Preview/Download controls render only when `canPreview` (requires `caseId && attachment_id`). On a record without a parent case, attachments list but have no download — the manifest comment explains this is intended (manifest still listed). Acceptable; no dead control.

**Simplicity Opportunities**
- Clean, well-labeled, good last-place positioning of the tamper-detection body hash (`:213-227`).

**Top 3 Actionable Recommendations**
1. Handle the zero-attachment audit case (`:134`): either render an explicit "Attachments (0) — none" state or change how the empty manifest is conveyed, so an attachment-less email isn't silently blanked on an audit-bearing field.
2. Add `aria-hidden` to the decorative header `Mail` icon (`:71`).
3. Otherwise ship as-is.

---

### EmailOrderEntrySection
**Context**
- Card Name: Email Order Intake — classification badge + composite confidence + constraints pipeline + floor checks + validations + recommended action + autonomy (Layer-2 enrichment).
- Primary Goal: Show which compliance preconditions (floors) passed/failed and the resulting classification/recommendation.
- Target Audience: CSAs / compliance reviewers.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- `EmailOrderEntrySection.tsx:41-49` `CLASSIFICATION_BADGE` is a `Record<EmailOrderEntryClassification, …>` keyed by the four known classifications, with a runtime `?? neutral` fallback at `:61`. Because the type is the closed enum, a new backend classification would be a TS-level gap; the runtime fallback saves it (raw label, neutral badge). Consistent with the slice's forward-compat pattern. OK.
- `EmailOrderEntrySection.tsx:198-199` `recommended_action` and `:114,130` `floor_status` etc. are rendered directly. `recommended_action` is shown raw (e.g. an action code) with no humanization, unlike OverrideChooserDialog which `replace(/_/g," ")`s action codes — inconsistent action-code presentation across the slice.
- `EmailOrderEntrySection.tsx:155-158` Validations block: `value={data.validation_failures.length > 0 ? data.validation_failures : null}` — manual length check feeding `EvidenceBlock`. `EvidenceBlock.isPresent` already treats `[]` as absent (EvidenceBlock.tsx:95), so the ternary is redundant but harmless. Minor.

**Usability Issues**
- `EmailOrderEntrySection.tsx:224-243` `FloorRow` is well done for WCAG (icon + text + `sr-only` state). However it shows up to FOUR redundant glyphs per row: leading `Icon` (CheckCircle2/ShieldX), trailing `AlertTriangle` (fail) or `ShieldCheck` (pass), plus the text state. Three icons + text for one boolean is visually noisy. Consider one icon + text.
- `EmailOrderEntrySection.tsx:103-121` the Constraints pipeline and the Floor checks (`:126-148`) present the SAME four floor booleans twice (graphical pipeline then textual grid). The comment justifies it (audit users read text), but it's substantial duplication of the identical data on one card.

**Simplicity Opportunities**
- Collapse the dual floor representation (pipeline + grid) or make the textual grid a disclosure under the pipeline, reducing the card's vertical weight.
- `FloorRow` (`:224`): drop the redundant trailing pass/fail glyph.

**Top 3 Actionable Recommendations**
1. Reduce `FloorRow` to a single status icon + text (`:224-243`).
2. Consolidate the Constraints pipeline + Floor checks so the four booleans aren't rendered twice (`:103-148`).
3. Humanize `recommended_action` (`:199`) to match action-code formatting elsewhere.

---

### OrderEntrySection
**Context**
- Card Name: Extracted order — header fields + line items + per-line/extraction confidence + validation flags (Layer-2, preview-only).
- Primary Goal: Read-only review of the extracted order form for ERP submission.
- Target Audience: CSAs verifying extraction accuracy.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- `OrderEntrySection.tsx:108-114` `unit_price` is `tier="audit-bearing"`. A line with an absent unit_price triggers the dev warning and renders nothing in that cell — but the row's qty/material still render, producing a line with a silently missing price on a financial review surface. For a per-line price this may warrant the AUDIT_CONTEXT_MISSING posture at the section level rather than a per-cell silent omission. Verify intended behaviour.
- `OrderEntrySection.tsx:92-131` `line_items.map` with no empty-state. A present extraction with zero line items renders "Line items (0)" and an empty list — no "no lines extracted" hint.
- `OrderEntrySection.tsx:28-33,108-114` `formatUsd` uses `Intl.NumberFormat` USD, while the rest of the slice uses `fmtPrice` (shared.tsx). Two currency formatters with different output (`formatUsd` shows the currency symbol/grouping per Intl; `fmtPrice` is `$` + abs value). Inconsistent money rendering across the detail pane. Note `fmtPrice` uses `Math.abs` and `formatUsd` does not — they disagree on negatives.

**Usability Issues**
- `OrderEntrySection.tsx:135-162` validation flags render `f.severity` text colored by `flagClasses` plus an `AlertTriangle` — but the triangle is used for ALL severities including INFO/default (`:146`), so an informational flag gets a warning glyph. Icon should track severity.
- `OrderEntrySection.tsx:101` material name uses `truncate` with no title/tooltip — same readability concern as EvidenceGrid descriptions.

**Simplicity Opportunities**
- Reuse `fmtPrice` (or promote `formatUsd`) to a single shared currency helper so the pane is consistent and the negative-handling discrepancy disappears.

**Top 3 Actionable Recommendations**
1. Reconcile currency formatting (`formatUsd` vs shared `fmtPrice`) into one helper (`:28`).
2. Revisit the audit-bearing tier on per-line `unit_price` (`:108`) so a missing price isn't silently blanked mid-row; add a zero-line empty state (`:92`).
3. Make the validation-flag icon track severity (`:146`) and add a tooltip to truncated material names (`:101`).

---

### KnowledgeGraphSection
**Context**
- Card Name: Knowledge Graph — radial SVG entity diagram + accessible relationships list (Layer-2, preview-only).
- Primary Goal: Show derived entity/relationship structure with diagram + text parity.
- Target Audience: Analysts exploring entity context.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- `KnowledgeGraphSection.tsx:50-66` `layout` places non-root nodes on a single ring with no overlap/edge-crossing handling. For a graph with many nodes or long labels (`:124-132`, fontSize 9, no truncation), labels will overlap and run outside the 320px viewBox. Diagram legibility degrades with node count. Needs visual verification at realistic node counts.
- `KnowledgeGraphSection.tsx:35-48` `kindColor` maps 4 known kinds to design-token colors with a default fallback — allowed visual mapping. No legend, though: the diagram colors nodes by kind but there's no key explaining order/customer/material/sap_doc colors. The relationships list (`:143`) carries labels, so parity exists, but the diagram's color encoding is unexplained.
- `KnowledgeGraphSection.tsx:143-148` relationships list has no empty-state; an edge-less graph (nodes but no edges) renders "Relationships" header with an empty list.

**Usability Issues**
- `KnowledgeGraphSection.tsx:90-136` the SVG is `role="img"` with a single aria-label ("Entity graph of N nodes") — good that the accessible list provides parity. But individual SVG nodes/labels aren't focusable/interactive; this is acceptable since the list is the keyboard surface.
- No truncation on node labels (`:124-132`) or relationship labels (`break`/`truncate` present only on the list at `:170,179`). Long order/material labels will clip in the SVG.

**Simplicity Opportunities**
- Add a small color legend (kind → color) so the diagram's encoding is self-explanatory; otherwise the colors are decorative-looking.

**Top 3 Actionable Recommendations**
1. Add a kind→color legend (`:35-48` consumers) and handle/truncate long node labels in the SVG (`:124-132`).
2. Add empty-states for zero nodes and zero edges (`:143`).
3. Verify radial layout legibility at realistic node counts; consider de-overlap or capping displayed nodes.

---

### OverrideChooserDialog
**Context**
- Dialog Name: Override resolution — SOX-audited override form (action + reason category + mandatory-when-OTHER notes).
- Primary Goal: Let a manager+ pick an explicit resolution action differing from the recommendation, with audited justification.
- Target Audience: Managers/admins (RBAC-gated).

**Overall Verdict:** Pass

**Correctness Issues**
- Guardrail #2 clean: all option values come from `allowedActions`/`allowedReasonTags` props sourced upstream from `health` (`:81,87`); zero enum literals. Cluster grouping via `clustersForIntent` with flat-list fallback (`:119,134-153`).
- `OverrideChooserDialog.tsx:158-162` submit predicate requires action + reasonTag + (notes when required). `notesRequired` defaults to true when no reason selected (`:158`) — good gate. Server re-asserts (`:24`). Solid.
- `OverrideChooserDialog.tsx:119-120` `allowedSet` is rebuilt each render and is a dep of the `reasonGroups` memo (`:146`) — a new `Set` identity every render defeats the memo (it recomputes each render). Functionally correct, minor wasted work. Wrap `allowedSet` in `useMemo` keyed on `allowedReasonTags`.

**Usability Issues**
- `OverrideChooserDialog.tsx:230-237` the confirm button is `variant="destructive"` (red). An override isn't inherently destructive — it's a deliberate authorized action. Red framing may over-signal danger for a routine manager override; consider `brand` with the audit copy carrying the gravity. Needs design intent confirmation.
- `OverrideChooserDialog.tsx:204-219` Notes label toggles "(required)/(optional)" and `aria-required` tracks it — good dynamic affordance. The textarea has no error/validation message when empty-but-required; the only feedback is the disabled submit. A brief inline hint would aid discoverability of why submit is disabled.

**Simplicity Opportunities**
- Clean, well-scoped controlled form. The Combobox upgrade for both selects is consistent and keyboard-complete.

**Top 3 Actionable Recommendations**
1. Memoize `allowedSet` (`:120`) so `reasonGroups`/`reasonItems` memos actually cache.
2. Reconsider the `destructive` button variant (`:231`) vs the nature of an authorized override.
3. Add an inline reason/notes validation hint so a disabled submit explains itself (`:204-219`).

---

### shared.tsx (shared helpers)
**Context**
- Module: Shared collapsible primitives (`CollapsibleHeader`, `CollapsibleSection`), `useHashOpen`, `fmtPrice`, `Layer2OpenContext`, HITL/cosign lifecycle constants.
- Primary Goal: One definition of the expand/scroll/telemetry mechanics + price formatting + UX lifecycle grouping shared across detail sub-components.
- Target Audience: (developer-facing) — UX impact via the behaviours it standardizes.

**Overall Verdict:** Needs Minor Tweaks

**Correctness / UX-affecting Issues**
- `shared.tsx:218-220` `fmtPrice` applies `Math.abs(n)` — it ALWAYS strips the sign. This is the root cause of the delta sign-loss in HeaderRibbon (`:99-103`) and ContextStrip (`:80`): a negative delta and a positive delta render identically. For a financial surface this is a real partial-truth/legibility risk; the sign is meaningful evidence. Either remove `Math.abs` here or have callers pass the sign/direction explicitly.
- `shared.tsx:96-136` `CollapsibleHeader` renders a `<button aria-expanded>` but the corresponding expandable region has no `id`/`aria-controls` linkage in the consumers — screen readers announce expanded/collapsed but not which region. Minor ARIA completeness gap that affects every section using the header.
- `shared.tsx:53-59` `HITL_LIFECYCLE_STATES` is a hardcoded `Set` of lifecycle string literals (`PENDING_REVIEW`, `ESCALATED`, etc.). The doc comment (`:40-52`) explicitly argues this is a UI-side UX classification, not a backend enum gate, and notes the values themselves still come from `health` at render time. This is defensible per the stated Guardrail #1 carve-out, BUT it does mean a new HITL-relevant lifecycle state added in asoe2 will NOT auto-expand Agent Analysis until this Set is updated — a soft coupling worth flagging for the "zero UI changes" test. Similarly `COSIGN_LIFECYCLE_STATE` (`:38`). Document/justify, or source these groupings from health if the backend can express them.
- `shared.tsx:72-93` `useHashOpen` disables `exhaustive-deps` and keys only on `id`; `onMatch`/`ref` are assumed stable. If a caller passes a non-stable `onMatch`, stale-closure behaviour is possible. Callers in this slice pass inline arrows recreated each render (e.g. EvidenceGrid:54) — the effect won't re-bind to the new closure, so it captures the first render's `onMatch`. Functionally OK today because the closures only call stable setters, but it's a latent footgun.

**Usability Issues**
- `shared.tsx:199-214` `CollapsibleSection` mounts children only when open (`:212`) — good for perf, but means in-section anchors inside a collapsed section don't exist in the DOM until opened; `useHashOpen` handles this by opening first then scrolling next frame (`:189-197`). Coherent.

**Simplicity Opportunities**
- `fmtPrice` and the two ad-hoc currency formatters in OrderEntrySection (`formatUsd`) and EmailSource (`formatBytes` is separate) should be consolidated; a single money helper that preserves sign would fix multiple findings at once.

**Top 3 Actionable Recommendations**
1. Fix `fmtPrice` sign handling (`:218`) — this single helper drives the delta sign-loss findings in HeaderRibbon and ContextStrip.
2. Add `id`/`aria-controls` linkage between `CollapsibleHeader` buttons and their regions (`:104`) for complete expand/collapse a11y across all sections.
3. Document (or health-source) the `HITL_LIFECYCLE_STATES` / `COSIGN_LIFECYCLE_STATE` literal coupling (`:38-59`) against the "zero UI changes for a new state" guardrail test.

---

## Cross-cutting issues (most important for this slice)

1. **Empty/zero vs loading states are conflated across multiple sections.** EvidenceGrid renders "Loading line items…" permanently for a genuinely zero-line record (`EvidenceGrid.tsx:106-110`) and shows `"—"` as the count chip; EntitiesSection (`:45`), OrderEntrySection (`:92`), and KnowledgeGraphSection (`:143`) render "(0)" headers with empty lists and no terminal empty-state; DiagnosticsSection's Evidence tab shows nothing when `trace` is null (`:349`). On a SOX-relevant surface, "loading" and "deliberately empty" and "fetch failed" must read distinctly.

2. **Inconsistent value formatting (money + action codes) across the pane.** `fmtPrice` (shared, `Math.abs`-stripped sign) vs `formatUsd` (Intl, signed) disagree on negatives and symbol style; the recurring `Math.abs` in `fmtPrice` silently drops delta direction in HeaderRibbon and ContextStrip — a legibility/partial-truth risk on financial evidence. Action codes are humanized (`replace(/_/g," ")`) in OverrideChooserDialog and the cosign reason, but rendered raw in the cosign `pending.action`, EmailOrderEntrySection `recommended_action`. Consolidate into shared sign-preserving money + action-label helpers.

3. **Keyboard/ARIA gaps on the primary interaction surfaces.** EvidenceGrid table rows are mouse-only selectable (no `tabIndex`/role/key handler, `:130-151`); DiagnosticsSection Trace Evidence tabs lack `role="tab"` semantics (`:333`); `CollapsibleHeader` buttons have `aria-expanded` but no `aria-controls` linkage to their regions (shared.tsx:104), affecting every collapsible section; the loading skeleton (ExceptionDetailPanel:437) is silent to AT. These are WCAG AA polish items concentrated on the surfaces operators use most.
