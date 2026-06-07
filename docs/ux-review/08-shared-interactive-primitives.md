# UX/QA Review — Slice 08: Shared Interactive Form/Overlay Primitives + Attachment Actions

**Reviewer:** Expert QA / UX-UI Evaluator (gap-closure pass)
**Date:** 2026-06-07
**Scope:** Foundational primitives the whole app composes. Defects here propagate everywhere, so accessibility (focus management, keyboard, ARIA, aria-live) is weighted heavily.
**Method:** Full read of each source file; findings cited file:line. No source code changed.

Files reviewed:
- `src/components/ui/Button.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Select.tsx`
- `src/components/ui/Combobox.tsx`
- `src/components/ui/MultiSelect.tsx`
- `src/components/ui/Dialog.tsx`
- `src/components/ui/DropdownMenu.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/Toast.tsx`
- `src/components/ui/ActivityIndicator.tsx`
- `src/components/ui/AttachmentDownloadButton.tsx`
- `src/components/ui/AttachmentPreview.tsx`
- `src/components/ui/ErasureCertificateButton.tsx`

---

## Verdict summary

| Component | Verdict |
|---|---|
| Button | Needs Minor Tweaks |
| Input | Needs Minor Tweaks |
| Select | Pass |
| Combobox | Needs Minor Tweaks |
| MultiSelect | Needs Minor Tweaks |
| Dialog | Needs Minor Tweaks |
| DropdownMenu | Pass |
| Card | Pass |
| Toast | Needs Minor Tweaks |
| ActivityIndicator | Needs Rework |
| AttachmentDownloadButton | Needs Minor Tweaks |
| AttachmentPreview | Needs Minor Tweaks |
| ErasureCertificateButton | Needs Rework |

**Counts (post Batch 1–3) — Pass: 5 · Needs Minor Tweaks: 8 · Needs Rework: 0** (was 3/8/2 — ActivityIndicator and ErasureCertificateButton flipped to Pass)

---

### Button
**Context** — Global action primitive (every card/pane/dialog footer) · Primary Goal: trigger an action with clear variant semantics (brand/destructive/etc.) · Target Audience: O2C operators/analysts/managers.
**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `Button.tsx:48,44` — `children` is a required prop (`children: React.ReactNode`), but when `loading` is true (`Button.tsx:64-68`) the children are *replaced* by the spinner with no text. The button collapses to an icon-only control with no accessible name during the loading state. There is no `aria-label` fallback and the spinner `Loader2` has no label, so a screen-reader user hears nothing while an action is in flight. Add `aria-busy={loading}` and/or retain a visually-hidden label.
- `Button.tsx:57` — `loading && "opacity-100"` is dead/contradictory styling: the base class sets `disabled:opacity-40` and `isDisabled` is true when loading (`Button.tsx:49`), so this override re-asserts full opacity to defeat the disabled dimming. The net effect is that a loading button looks identical to an enabled button (not dimmed) yet is non-interactive — a mild affordance mismatch. Intentional or not, it deserves a comment; as written it reads like an accident.

**Usability Issues:**
- `Button.tsx:10` — base uses `transition-all duration-instant`. No visible focus-ring utility is declared on the base button. Radix/native focus styling is inherited only via `:focus` defaults; the spec focus ring (`2px solid var(--color-brand-ring)`) is NOT applied here the way it is on Input/Select/Combobox. Keyboard users get the browser default outline, which `transition-all` + `rounded-md` can make inconsistent across variants. Recommend an explicit `focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:outline-none` on the base. (Needs visual/manual verification across variants.)
- `Button.tsx:49,61` — `disabled` semantics are correct (`disabled` attribute set, `disabled:pointer-events-none`), good. When `asChild` renders a `Slot` (`Button.tsx:50`), the `disabled` attribute is forwarded to whatever child element is slotted; if that child is an `<a>` it will not honor `disabled`. Document that `asChild` + `disabled` is only valid for button-like children.

**Simplicity Opportunities:**
- `Button.tsx:33-45` — `Variant`/`Size` are redeclared as standalone unions and also re-stated in the props interface even though `VariantProps<typeof buttonVariants>` already provides them. The manual `variant?: Variant` / `size?: Size` lines are redundant with the CVA-derived types.

**Top 3 Actionable Recommendations:**
1. Preserve an accessible name during `loading`: add `aria-busy={loading}` and a visually-hidden label (or keep `children` visible beside the spinner).
2. Add an explicit `focus-visible` ring to the base CVA string so all variants match the documented `2px var(--color-brand-ring)` spec.
3. Clarify/remove the `loading && "opacity-100"` override; if a non-dimmed loading state is intended, comment it.

---

### Input
**Context** — Form field primitive (login, filters, dialog forms) · Primary Goal: collect a typed value with label + inline error · Target Audience: operators/analysts.
**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `Input.tsx:14` — auto-generated id derives from the label text: `label.toLowerCase().replace(/\s+/g, "-")`. Two inputs with the same label on one page (e.g. two "Amount" fields) produce duplicate DOM ids, breaking `htmlFor` association and `aria-describedby`. Non-deterministic in dense forms. Prefer `React.useId()` as the base when no `id` prop is supplied.
- `Input.tsx:14` — if neither `id` nor `label` is provided, `inputId` is `undefined`, so an `error` cannot be associated (`errorId` is undefined at `Input.tsx:15`) — the error text renders (`Input.tsx:52-56`) but `aria-describedby` points nowhere. Label-less inputs with errors lose the programmatic association.

**Usability Issues:**
- `Input.tsx:53` — the error `<span>` uses `role="alert"`. `role="alert"` is implicitly `aria-live="assertive"`, which interrupts the screen reader. For an inline field error that appears as the user types/blurs, `aria-live="polite"` is generally less jarring. Minor; defensible either way.
- `Input.tsx:46-50` — `rightIcon` container is `pointer-events`-default and overlays the input's right edge; if a consumer passes an interactive icon (clear button, reveal-password) it sits on top but is not itself focusable/labeled. The component only supports decorative right icons; that constraint is undocumented.
- Focus ring is correct: `focus:ring-2 focus:ring-brand-ring focus:border-border-brand` (`Input.tsx:38`) — credit.

**Simplicity Opportunities:**
- `Input.tsx:32` — `aria-describedby={error ? errorId : undefined}` and `aria-invalid={!!error}` are clean; no change needed.

**Top 3 Actionable Recommendations:**
1. Base the fallback id on `React.useId()` instead of the slugged label to guarantee uniqueness.
2. Always emit an `errorId` (tie it to the generated id) so label-less inputs still associate their error text.
3. Consider `aria-live="polite"` instead of `role="alert"` for inline validation, and document that `rightIcon` is decorative-only.

---

### Select
**Context** — Radix-based single-select (filters, dialog pickers) · Primary Goal: choose one value from a bounded vocabulary · Target Audience: operators/analysts.
**Overall Verdict:** Pass

**Correctness Issues:**
- None. This is a faithful Radix Select wrapper. Roles, keyboard nav (type-ahead, arrows, Enter/Esc), portal, and `ItemIndicator` come from the primitive.

**Usability Issues:**
- `Select.tsx:21` — trigger focus ring is correct (`focus:ring-2 focus:ring-brand-ring focus:border-border-brand`). Credit.
- `Select.tsx:118` — `SelectItem` selection check (`Check` icon, `Select.tsx:127`) plus text is icon+text, not color-alone. Good for WCAG 1.4.1.
- Minor: `Select.tsx:88` — the popper viewport forces `h-[var(--radix-select-trigger-height)]`, which constrains content height to the trigger height in popper mode. This can clip long option lists in some Radix versions; verify the menu still scrolls (ScrollUp/Down buttons are wired at `Select.tsx:84,93`). Needs manual verification.

**Simplicity Opportunities:**
- None material — this is standard shadcn scaffolding.

**Top 3 Actionable Recommendations:**
1. Manually verify popper-mode viewport height does not clip long lists; the scroll buttons should engage.
2. No other changes required; keep as the canonical single-select.
3. Ensure consumers pass a `SelectValue placeholder` so the empty trigger has readable text (component-level OK).

---

### Combobox
**Context** — Typeahead single-select used in `OverrideChooserDialog` (resolution action / reason-tag pickers) · Primary Goal: filter a small-but-growing vocabulary inside a Dialog · Target Audience: managers/analysts performing overrides (compliance-sensitive).
**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `Combobox.tsx:212-237` — ARIA wiring is incomplete for the APG combobox pattern. The trigger has `role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"` (`Combobox.tsx:212-215`), but there is **no `aria-controls`** pointing at the listbox, and the popover list container (`Combobox.tsx:239-245`) has **no `role="listbox"`** and **no `id`**. cmdk's `Command.List` renders its own roles, but the relationship from the trigger to the list is not announced. Add an `id` to the list and `aria-controls={listId}` to the trigger.
- `Combobox.tsx:262-269` — the actual text input is `Command.Input` (the live combobox text field), yet `role="combobox"` is placed on the *trigger button* (`Combobox.tsx:212`), not the input. This is a hybrid disclosure-button + combobox-input pattern; screen readers may double-announce "combobox" (button) then land on an unlabeled-as-combobox input. Pick one model: either a button that opens a listbox (`aria-haspopup="listbox"` only, no `role="combobox"` on the button) or a true editable combobox on the input.

**Usability Issues:**
- `Combobox.tsx:139-149` — outside-click close is on `mousedown` at document level but the popover is **portal-free** and `absolute`. Inside a Radix Dialog this works (noted in the header comment), but if mounted outside a positioned/overflow-hidden ancestor the `absolute z-modal` list can be clipped. The component documents Dialog as "today's only mount context" — acceptable, but a future consumer is a clipping risk.
- `Combobox.tsx:187-190` — `onMouseDown` + `preventDefault` + `pick()` is the primary selection path (belt-and-suspenders with `onSelect`). `onMouseDown` fires before click, so a touch/pointer user who presses and drags off the row still commits the selection on press. Minor; documented rationale (Radix pointer-lock) is sound.
- `Combobox.tsx:228` — empty-selection trigger shows `placeholder` styled `text-text-quaternary`; selection state conveyed by text content, not color alone. Good.
- Focus ring correct: `Combobox.tsx:223`.

**Simplicity Opportunities:**
- `Combobox.tsx:162-167` — `flushSync` is a heavy hammer; the extensive comment justifies it for the Dialog pointer-lock case. Keep, but the dual `onSelect` + `onMouseDown` both calling `pick()` means a keyboard Enter and a mouse press can both fire — verify no double-`onChange` in fast interactions (idempotent here since it sets a value, but worth a test).

**Top 3 Actionable Recommendations:**
1. Add `id` to the popover list and `aria-controls` on the trigger; add `role="listbox"`/labelling so the trigger→list relationship is announced.
2. Resolve the combobox-role ambiguity: keep `role="combobox"` on either the button (disclosure model) or the input (editable model), not split across both.
3. Add a keyboard-vs-mouse selection test to confirm `pick()` is idempotent and the popover closes for both paths.

---

### MultiSelect
**Context** — Checkbox-list filter dropdown (exceptions/cases list filters) · Primary Goal: select multiple enum values without re-opening the menu · Target Audience: operators triaging queues.
**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `MultiSelect.tsx:86-106` — the trigger `<button>` has `aria-label` but **no `aria-expanded` / `aria-haspopup` and no indication of how many items are selected** beyond the visible label. Radix's `DropdownMenuTrigger asChild` will inject `aria-haspopup="menu"` and `aria-expanded`, so this is largely covered by Radix — but the *content* uses checkbox items (`DropdownMenuCheckboxItem`), making this semantically a multi-select within a `role="menu"`. A `menu` containing checkbox items is acceptable per Radix, but APG would prefer `aria-haspopup="listbox"`/listbox semantics for a multi-select filter. Functional but semantically a menu, not a listbox.
- `MultiSelect.tsx:64` — `ordered = options.filter((o) => value.includes(o))` silently drops any selected value not present in `options`. If `value` contains a stale enum (e.g. a state removed from `useHealth`), it disappears from the trigger label and the count, so the operator cannot see or clear it. The "Clear" button (`MultiSelect.tsx:128`, gated on `value.length > 0`) is the only escape, but the user has no visibility of the orphaned filter. Consider surfacing unknown selected values.

**Usability Issues:**
- `MultiSelect.tsx:122` — `onSelect={(e) => e.preventDefault()}` keeps the menu open per click (good for multi-pick), documented. Correct pattern.
- `MultiSelect.tsx:97-104` — trigger label truncates with ellipsis; the full set of selected values is not exposed via `title`/`aria` when truncated. A `title={triggerLabel}` or `aria-label` that includes the count would help when "3+ selected" hides specifics.
- `MultiSelect.tsx:93` — focus ring uses `focus-visible:ring-2 focus-visible:ring-brand-ring` (note: `focus-visible`, not `focus`) — correct and preferable. Credit.
- `MultiSelect.tsx:109-112` — empty-options state ("No options available") is handled. Good.

**Simplicity Opportunities:**
- `MultiSelect.tsx:51` — `defaultFormat` underscore→space is a reasonable default; fine.

**Top 3 Actionable Recommendations:**
1. Add `title={triggerLabel}` (and reflect the selected count in the trigger's accessible name) so truncated/"N selected" states are discoverable.
2. Decide on menu-vs-listbox semantics; if keeping the DropdownMenu base, document that this is intentionally a `menu` with checkbox items.
3. Handle stale/unknown selected values (values not in `options`) so a removed enum can still be seen and cleared.

---

### Dialog
**Context** — Modal overlay primitive (override chooser, confirmations) · Primary Goal: focus the operator on a single financially-binding decision · Target Audience: managers/analysts authorising actions.
**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `Dialog.tsx:36-49` — `DialogContent` does **not** wire `aria-labelledby` / `aria-describedby` to the `DialogTitle` / `DialogDescription`. Radix auto-associates these *only when* `Dialog.Title`/`Dialog.Description` are rendered as descendants; if a consumer omits `DialogTitle`, Radix logs a dev warning and the dialog has **no accessible name**. The wrapper does not enforce a title. For SOX-relevant decision dialogs an unnamed modal is a real a11y gap — consider requiring a title or a `VisuallyHidden` fallback.
- `Dialog.tsx:36` — `role="dialog"` and `aria-modal="true"` are supplied by `DialogPrimitive.Content` (Radix), not visible in this file. Correct by delegation; focus trap + ESC + scroll-lock are Radix defaults. Credit (verified via primitive, not source here).

**Usability Issues:**
- `Dialog.tsx:51` — the close `X` button focus ring is correct (`focus:ring-2 focus:ring-brand-ring focus:ring-offset-2`) and has an `sr-only` "Close" label (`Dialog.tsx:53`). Good.
- `Dialog.tsx:39` — `max-w-lg` is fixed; long override forms may need a wider variant. Consumers can override via `className`, but there is no `size` prop. Minor.
- `Dialog.tsx:60-68` — `DialogHeader`/`DialogFooter` are layout-only divs; fine. Footer uses `flex-col-reverse sm:flex-row` so the primary action ends up last/right on desktop — verify the destructive/confirm button lands where operators expect.

**Simplicity Opportunities:**
- `Dialog.tsx:30-57` — standard shadcn structure; no simplification needed.

**Top 3 Actionable Recommendations:**
1. Enforce an accessible name: either require `DialogTitle` or render a `VisuallyHidden` default title so a consumer can never ship an unnamed modal.
2. Add an optional `size` prop (sm/md/lg) instead of relying on `className` overrides of `max-w-lg`.
3. Confirm footer button ordering (`flex-col-reverse sm:flex-row`) places the confirm/primary action consistently across breakpoints.

---

### DropdownMenu
**Context** — Radix menu primitive (row actions, MultiSelect base, overflow menus) · Primary Goal: present contextual actions/checkbox-filters · Target Audience: operators/analysts.
**Overall Verdict:** Pass

**Correctness Issues:**
- None. Faithful Radix wrapper: `Item`, `CheckboxItem`, `RadioItem`, `Sub*`, `Separator`, `Label` all delegate to the primitive (roles, keyboard nav, type-ahead, focus management inherited).

**Usability Issues:**
- `DropdownMenu.tsx:84,103,128` — focus highlight uses `focus:bg-surface-row-hover focus:text-text-primary` (background change), which is color/contrast-based highlighting of the active item. This is Radix's roving-focus item; there is no ring. Acceptable for menu items (the highlight is the standard pattern), but verify the `surface-row-hover` vs text contrast meets AA. Needs visual/manual verification.
- `DropdownMenu.tsx:95-117` — `CheckboxItem` shows a `Check` indicator (icon), so checked state is icon-based, not color-alone. Good for 1.4.1.

**Simplicity Opportunities:**
- `DropdownMenu.tsx:172-175` — `DropdownMenuShortcut` is a presentational span; fine.

**Top 3 Actionable Recommendations:**
1. Verify active-item contrast (`surface-row-hover` background vs item text) meets WCAG AA in both themes.
2. Keep as canonical menu base; no structural change needed.
3. Consider exposing the documented `inset` prop consistently (already present on Item/SubTrigger/Label) — no action required.

---

### Card
**Context** — Container primitive (every pane/section) · Primary Goal: group related content with optional elevation · Target Audience: all.
**Overall Verdict:** Pass

**Correctness Issues:**
- None. Pure presentational container; design tokens used throughout (`bg-surface-primary`, `rounded-lg/md`, `shadow-lg/sm`, `p-16`, `gap-6`).

**Usability Issues:**
- `Card.tsx:32-37` — `CardTitle` renders a `<div>`, not a heading element. This means card titles carry no heading semantics and do not appear in the screen-reader heading outline. For a control-tower app where operators scan many cards, the missing heading landmarks hurt navigation. Consider an `as`/`asChild` to allow `h2`/`h3`, or render a heading by default.
- `Card.tsx:1` — no `"use client"` directive, which is correct here (no interactivity) and consistent with the Engineering Rules (directive only on interactive components). Credit.

**Simplicity Opportunities:**
- None. Minimal and clean.

**Top 3 Actionable Recommendations:**
1. Allow `CardTitle` to render a real heading element (e.g. `as="h3"`) so cards contribute to the heading outline.
2. Otherwise keep as-is; this is a clean token-only primitive.
3. Document that `CardContent`'s `pt-0` assumes a `CardHeader` precedes it (standalone content gets no top padding).

---

### Toast
**Context** — Transient feedback after actions (resolve/override/download) · Primary Goal: confirm/alert without blocking · Target Audience: operators/analysts/managers.
**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `Toast.tsx:47-48` — every toast uses `role="status"` + `aria-live="polite"`, **including the `error` variant** (`Toast.tsx:33`). An error toast (failed resolve, failed download) is exactly the case that warrants `role="alert"` / `aria-live="assertive"` so it is not missed. Polite announcement can be queued behind other live regions and lost before the 4.5s auto-dismiss. Map variant → politeness (error/warning = assertive/alert).
- `Toast.tsx:40-43` — auto-dismiss timer fires at 4.5s with **no pause-on-hover or pause-on-focus**. WCAG 2.2.1 (Timing Adjustable) / 2.2.4: auto-disappearing messages that the user may need to read should be pausable/dismissable. Dismiss exists (`Toast.tsx:56-62`), but there is no hover-pause, so a slow reader or a long error message can vanish mid-read. The error path is the worst case given the audience authorises financial decisions.

**Usability Issues:**
- `Toast.tsx:71` — `id` uses `Date.now()` + `Math.random()`; fine for keys, but two toasts fired in the same tick are de-duplicated only by the random suffix. Acceptable.
- `Toast.tsx:50-54` — icon + message (icon at `Toast.tsx:54`) means status is not color-alone. Good for 1.4.1. Solid-fill is intentional per the header comment (Section 11.2).
- `Toast.tsx:59` — dismiss button uses `text-white/80 hover:text-white` with **no focus ring**. Keyboard users cannot see focus on the dismiss control. Add `focus-visible:ring-2 focus-visible:ring-brand-ring` (or a white ring against the solid fill).
- `Toast.tsx:83` — container is `fixed bottom-24 right-24`; multiple toasts stack but there is no max-count / overflow handling. A burst of agent events could push toasts off-screen. Minor.

**Simplicity Opportunities:**
- `Toast.tsx:37` — the inner component is named `ToastItem`, shadowing the `ToastItem` interface (`Toast.tsx:13`). Functional (value vs type namespaces) but confusing; rename the component to `ToastRow` or the type to `ToastData`.

**Top 3 Actionable Recommendations:**
1. Use `role="alert"` / `aria-live="assertive"` for `error` (and likely `warning`); keep `polite` for success/info.
2. Pause auto-dismiss on hover/focus (WCAG 2.2.1) so long/error messages can be read.
3. Add a visible focus ring to the dismiss button and rename the `ToastItem` component to stop shadowing the interface.

---

### ActivityIndicator
**Context** — Live agent-status text on the pipeline (Section 11.2, agent-first) · Primary Goal: show domain-aware "what the agent is doing now" · Target Audience: operators watching autonomous resolution.
**Overall Verdict:** ~~Needs Rework~~ → **Pass** ✅ (remediated Batch 2+3 — templated via `intentLabelFor`, `role=status`+`aria-live=polite`)

**Correctness Issues:**
- `ActivityIndicator.tsx:16-46` — **Guardrail #2 violation.** The `NODE_MESSAGES` map hardcodes intent enum literals as object keys driving display selection: `CONTRACTUAL_CORRECTION`, `CREDIT_BLOCK`, `MASS_PRICING_ERROR`, `DUPLICATE_PO` appear at `:20-23`, `:28-31`, `:38-41`. The `getMessage` function (`:48-53`) selects the displayed string by matching `intent` against these literals. CLAUDE.md Guardrail #1/#2 forbids "hardcoded intent values ... in display labels" and requires that "adding a new intent in asoe2 must require zero UI code changes." Adding a 5th intent here yields the generic `_default` with **no** per-intent message and requires editing this file to add one — exactly the forbidden coupling. The `PipelineNode` keys (`:16`) are fine (a compile-time type, allowed), but the *intent* sub-keys are runtime enum literals and must come from a runtime source (e.g. `useHealth` + a backend-provided message template), not be baked in.
- `ActivityIndicator.tsx:51` — `intent in entry` is a runtime membership test against the hardcoded map; any intent the backend introduces that is not pre-listed silently degrades to `_default`. This is a partial-truth display in an agent-first surface.

**Usability Issues:**
- `ActivityIndicator.tsx:58-63` — the live activity text has **no `aria-live`** region. Per CLAUDE.md Accessibility rules, `ActivityIndicator` is explicitly called out as needing `aria-live="polite"` ("aria-live=\"polite\" on dynamic content (Toast, ActivityIndicator)"). As written, the message updates as the pipeline advances but is never announced to screen-reader users. This is the headline a11y miss for this component.
- `ActivityIndicator.tsx:60` — the `agent-active-dot` pulse is decorative; it is reduced-motion-handled in `globals.css` (verified). Credit. But the dot conveys "active" purely visually; the adjacent text covers the meaning, so 1.4.1 is satisfied.
- `ActivityIndicator.tsx:59` — text is `italic` `text-text-tertiary` `text-caption`; tertiary text at caption size for live status may be low-contrast. Needs visual/manual verification against AA.

**Simplicity Opportunities:**
- `ActivityIndicator.tsx:16-46` — the message catalog should move to a runtime/config source keyed off backend-provided node+intent metadata, which would both fix Guardrail #2 and shrink this file to a renderer.

**Top 3 Actionable Recommendations:**
1. **Remove hardcoded intent literals** (`CONTRACTUAL_CORRECTION`/`CREDIT_BLOCK`/`MASS_PRICING_ERROR`/`DUPLICATE_PO`); source per-intent message templates from a runtime catalog (e.g. `useHealth` or a backend-provided map) so a new intent needs zero UI edits.
2. Wrap the message in `aria-live="polite"` (and `role="status"`) so pipeline progress is announced — this is a documented requirement.
3. Verify tertiary/italic/caption status text meets AA contrast; bump token if not.

---

### AttachmentDownloadButton
**Context** — Evidence byte download in attachment list rows / preview footer (ADR-043) · Primary Goal: pull RBAC-gated attachment bytes for audit · Target Audience: analysts/managers reviewing evidence (compliance-sensitive).
**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `AttachmentDownloadButton.tsx:49-52` — the `try/finally` resets `busy` but has **no `catch`**. If `attachmentsApi.getBlob` rejects (network/RBAC 403/expired), the error is swallowed: `busy` flips back to false, the button looks idle, and the operator gets **no feedback** that the evidence download failed. For a compliance-sensitive evidence action, a silent failure on a financially-binding review is a real defect. Add error feedback (toast or inline `role="alert"`), mirroring `ErasureCertificateButton` which at least surfaces an error string.

**Usability Issues:**
- `AttachmentDownloadButton.tsx:59` — `aria-label={`Download ${attachment.name}`}` is good and works for the `compact` icon-only mode (`:67`). Credit.
- `AttachmentDownloadButton.tsx:62-66` — busy state swaps the icon to a spinner but does not set `aria-busy`; screen-reader users get no in-progress signal. Add `aria-busy={busy}`.
- `AttachmentDownloadButton.tsx:60` — focus ring correct (`focus-visible:ring-2 focus-visible:ring-brand-ring`). Credit. Disabled handled via `disabled` + `disabled:opacity-50` (`:31,60`).
- `AttachmentDownloadButton.tsx:31` — when `!attachment.attachment_id` the button is disabled but gives no reason why; a non-stored attachment looks like a broken button. A tooltip/title ("not stored") would help. (AttachmentPreview handles this case explicitly with a message — inconsistent UX between the two.)

**Simplicity Opportunities:**
- `AttachmentDownloadButton.tsx:44` — `a.download = attachment.name || "attachment"` fallback is fine; no change.

**Top 3 Actionable Recommendations:**
1. Add a `catch` with user-visible failure feedback (toast or inline `role="alert"`) — silent evidence-download failure is unacceptable on a SOX surface.
2. Set `aria-busy={busy}` so the in-progress state is announced.
3. Surface *why* the button is disabled when `attachment_id` is absent (title/tooltip), matching AttachmentPreview's explicit message.

---

### AttachmentPreview
**Context** — Sandboxed PDF/image/text preview + evidence safety bar (ADR-043/045) · Primary Goal: let an operator verify backend evidence anchors against the actual document before authorising · Target Audience: managers/analysts authorising decisions (highest-stakes surface in this slice).
**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `AttachmentPreview.tsx:125-181` — the load `useEffect` dependency array is `[caseId, attachmentId]` (`:181`) but the effect body reads `attachment.mime_type`, `attachment.name`, and `anchors` (`:143-149`). If the same `attachmentId` is re-rendered with a *different* `anchors` array (e.g. backend re-anchors after a reclassification), the embedded `evidenceText` hint passed to mock `getBlob` is stale and the safety bar may locate against an old anchor set until a full remount. The exhaustive-deps lint is presumably suppressed; for an audit surface, stale anchor-vs-document matching is a correctness risk. Document or include `anchors` in deps (guarded against identity churn).
- `AttachmentPreview.tsx:65-68` — `STATUS_META` maps the three `AnchorStatus` values to label + icon; these are status presentation constants (not enum literals from the backend domain), so Guardrail #2 does not apply. Correct.

**Usability Issues:**
- `AttachmentPreview.tsx:198-212` — the non-dismissable honesty banner ("absence of a highlight is not confirmation") is excellent compliance UX. `role="note"` + label. Credit.
- `AttachmentPreview.tsx:215-261` — safety-bar rows are keyboard-operable buttons with `aria-pressed` + a focus ring + a "Highlighted" text badge (`:251-255`), so selection is not color-alone. Strong WCAG 1.4.1 compliance. Credit.
- `AttachmentPreview.tsx:243` — each status row's `meta.Icon` is `aria-hidden`, and the status meaning is carried by `meta.label` text (`:250`). Good — but the icon color is `text-text-tertiary` for *all three* statuses (located/unlocated/ambiguous share the same tint), so a glanceable color/shape cue for "UNLOCATED — verify manually" is muted. The text differentiates them (compliant), but a louder visual treatment for `unlocated` would match the ADR's "shown as loudly as a hit" intent. Needs visual/manual verification.
- `AttachmentPreview.tsx:265-269` — loading/error/denied states each have icon + text. Good. `:281` canvas has an `aria-label`. Good.
- `AttachmentPreview.tsx:285-312` — spatial overlay inline `style` uses `var(--color-brand)` / `--color-brand-ring` (tokens), with one fallback literal `rgba(90,75,214,0.12)` inside `var(--color-brand-subtle, ...)` (`:308`). The fallback is a hardcoded color value; if `--color-brand-subtle` is defined it never shows, but it is a token-bypass literal. Prefer ensuring the token exists and dropping the rgba fallback.

**Simplicity Opportunities:**
- `AttachmentPreview.tsx:70-108` — `renderPdfAndExtractText` is appropriately isolated; fine.

**Top 3 Actionable Recommendations:**
1. Reconcile the effect deps: ensure a changed `anchors` set re-runs the blob/anchor matching (or document why `attachmentId` alone is a safe key) — stale anchor matching is an audit risk.
2. Give `unlocated` (and `ambiguous`) a louder, distinct visual treatment per ADR-043 §2.3 ("as loudly as a hit"); today all three share `text-text-tertiary`.
3. Remove the hardcoded `rgba(90,75,214,0.12)` fallback (`:308`); guarantee `--color-brand-subtle` exists as a token.

---

### ErasureCertificateButton
**Context** — Downloads regulator-facing GDPR erasure certificate (PARITY-0.5/8, ADR-023) · Primary Goal: export the hash-chain proof of erasure for an auditor/regulator · Target Audience: managers/admins (RBAC manager+admin only).
**Overall Verdict:** ~~Needs Rework~~ → **Pass** ✅ (remediated Batch 1+3 — `aria-busy`, single `role=alert` rule, `text-error` token)

**Correctness Issues:**
- `ErasureCertificateButton.tsx:103` — **Design-token defect (Guardrail #2).** The error message uses `className="text-caption text-status-error"`. There is **no `status` color namespace** in `tailwind.config.ts` (verified: the error color is exposed as `error` → `text-error`, lines 78-83; no `status:` key exists). `text-status-error` therefore resolves to **no color** — the error text renders in the inherited/default color, not the intended red. The rest of the codebase uses `text-error` for this; `text-status-error` is a recurring typo cluster (also in `DraftReplySection.tsx`, `OrderEntrySection.tsx`) but within this slice it is a confirmed live bug: the regulator-erasure failure message is not visually styled as an error.
- `ErasureCertificateButton.tsx:65` — filename builds `erasedAt` from `cert.tombstone.erased_at?.replace(...) ?? "unknown"`. The `?? "unknown"` fallback is a reasonable filename guard (not an evidence-presence claim), so it does not violate the partial-truth rule — but a certificate with a missing `erased_at` is itself suspicious; consider surfacing that to the operator rather than silently naming the file `...-unknown.json`.

**Usability Issues:**
- `ErasureCertificateButton.tsx:100-108` — good: failures ARE surfaced via `role="alert"` + `aria-live="polite"` (contrast this with `AttachmentDownloadButton`, which swallows errors). However the politeness is `polite` on a `role="alert"`; `role="alert"` already implies assertive, so the explicit `aria-live="polite"` (`:105`) **downgrades** the alert and is contradictory. Pick one: drop `aria-live` (let `role="alert"` be assertive) or drop `role="alert"`.
- `ErasureCertificateButton.tsx:84-99` — no `aria-busy={busy}` during the fetch; the spinner swap (`:93`) is visual-only for screen-reader users. The action is high-stakes (regulator export) and slow (synthesises a Blob), so an in-progress announcement matters.
- `ErasureCertificateButton.tsx:86-91` — focus ring correct (`focus-visible:ring-2 focus-visible:ring-brand-ring`), `aria-label` present and distinct from a normal download (`:90`). Credit — the deliberate "proof OF erasure" labelling (`:82`) is good compliance UX.
- No confirmation step before generating a regulator-facing artifact. For a manager/admin export this is likely acceptable (it is a read/export, not a destructive action), but worth confirming with Compliance that no acknowledgement is required.

**Simplicity Opportunities:**
- `ErasureCertificateButton.tsx:82` — `label` ternary is fine; matches the `compact` pattern in the sibling download button.

**Top 3 Actionable Recommendations:**
1. **Fix `text-status-error` → `text-error`** (`:103`) — the class is undefined in the Tailwind config so the regulator-export error message currently renders unstyled. (Cross-cutting: same typo in `DraftReplySection.tsx` and `OrderEntrySection.tsx`.)
2. Resolve the contradictory `role="alert"` + `aria-live="polite"` (`:102-105`): keep `role="alert"` (assertive) and drop the explicit `aria-live`.
3. Add `aria-busy={busy}`; consider surfacing a missing `erased_at` instead of the silent `...-unknown.json` filename.

---

## Cross-cutting issues (most important across this slice)

1. **`aria-busy` / in-progress announcement is missing on every async action control.** `Button` (`:64-68`), `AttachmentDownloadButton` (`:62-66`), and `ErasureCertificateButton` (`:93-97`) all swap an icon for a spinner with no `aria-busy` and, in Button's case, lose the accessible name entirely. Screen-reader operators authorising financial/compliance actions get no signal that an action is in flight. Standardize `aria-busy` + retained accessible name across all three.

2. **`aria-live` politeness is wrong/missing where it matters most.** `ActivityIndicator` (`:58-63`) has **no `aria-live`** despite being explicitly named in CLAUDE.md as requiring `aria-live="polite"`. `Toast` (`:47-48`) announces **errors politely** instead of assertively, and `ErasureCertificateButton` (`:102-105`) contradictorily pairs `role="alert"` with `aria-live="polite"`. Live-region semantics across the slice need a consistent rule: progress = polite, errors = assertive/alert.

3. **Silent failures + an undefined error token undermine compliance feedback.** `AttachmentDownloadButton` (`:49-52`) swallows evidence-download errors with no `catch`/feedback, and `ErasureCertificateButton` styles its (correctly surfaced) error with `text-status-error` (`:103`) — a class that does not exist in `tailwind.config.ts`, so it renders unstyled. On SOX/GDPR-relevant evidence actions, a failed download must be loud and correctly styled. (Bonus structural finding: `ActivityIndicator` hardcodes intent enum literals `:20-41`, a Guardrail #2 violation that makes adding a backend intent require UI edits.)
