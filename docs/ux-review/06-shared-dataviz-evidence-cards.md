# UX/QA Review — Slice 06: Shared Data-Visualization & Evidence Cards/Panes

Gap-closure pass. Reviewer: Expert QA / UX-UI Evaluator. No source code changed.
Scope: 10 reusable components that visualize the evidence O2C operators use to
authorize financially-binding, SOX-relevant decisions.

Verdict legend: Pass / Needs Minor Tweaks / Needs Rework.

---

## MetricTile
**Context** — KPI tile (metrics strip on Exception Queue page) · Goal: surface one
headline number with label + subtitle · Audience: O2C managers/analysts scanning queue health.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `tint` is applied as the icon-container `background` and then the icon `color` is
  forced to `var(--color-surface-primary)` (MetricTile.tsx:26-27). This assumes every
  caller passes a *dark/saturated* tint so a light-surface icon reads on top. If a
  caller passes a light tint (or a `--color-*-subtle` token, which is the common
  convention elsewhere in this codebase), the icon becomes light-on-light and
  effectively invisible. There is no contrast guarantee. Needs visual/manual
  verification per actual call sites, but the contract is fragile.
- `value` accepts `string | number` (MetricTile.tsx:13) and is rendered raw
  (MetricTile.tsx:38-39). No formatting/zero/empty handling — a `0` or `""` value
  renders as an empty-looking tile with no "no data" affordance. For a KPI strip a
  zero state is meaningful and should be distinguishable from missing data.

**Usability Issues:**
- The tile is not labelled as a group for assistive tech. Label + value + subtitle are
  three independent spans (MetricTile.tsx:34-46); a screen reader reads them as loose
  text with no association. Wrapping in a `role="group"` with an `aria-label`
  combining label+value (as ConfidenceDisplay does) would make each tile a single
  coherent stop.
- `value` uses `--font-size-heading` (16px, MetricTile.tsx:38) while the token set
  has a dedicated `--font-size-mono-metric` (24px) clearly intended for monospace KPI
  numbers. The headline number is under-emphasized relative to the design system's
  intent.

**Simplicity Opportunities:**
- Clean, small, single-purpose. No removable complexity.

**Top 3 Actionable Recommendations:**
1. Document/enforce the `tint` contract (must be a saturated color) or derive the icon
   color from the tint instead of hardcoding surface-primary, to prevent invisible icons.
2. Wrap the tile content in `role="group"` + composed `aria-label` for one-stop SR reading.
3. Use `--font-size-mono-metric` for `value`; add an explicit zero/empty rendering.

---

## GapBar
**Context** — Horizontal qty comparison bar (ordered vs available/max/MOQ across
back-order, over-max, MOQ exceptions) · Goal: show the shortfall/excess gap at a
glance · Audience: O2C analysts triaging quantity exceptions.

**Overall Verdict:** Needs Rework

**Correctness Issues:**
- **Mode/data contradiction is silently mis-rendered.** `isExcess` and `isShortfall`
  both require `primaryQty > secondaryQty` (GapBar.tsx:47-48). So in `shortfall`
  mode when the order is actually *short* (`primaryQty < secondaryQty`, the literal
  documented back-order case: ordered < available), `isShortfall` is `false`. The
  secondary bar then renders green "success" (GapBar.tsx:80) and the gap label reads
  "Gap" in amber — but the primary bar stays brand-colored and nothing signals the
  shortfall on the primary. The semantics in the JSDoc (GapBar.tsx:4-7) do not match
  the rendered colors. This is a correctness defect on the exact use case the
  component documents.
- **Gap percentage can mislead.** The gap label computes percentage against
  `Math.max(primaryQty, secondaryQty)` (GapBar.tsx:108) while the bars are scaled
  against `maxVal = Math.max(primaryQty, secondaryQty, 1)` (GapBar.tsx:40). For an
  MOQ shortfall the operator usually wants "X% below MOQ" (gap / secondary), not gap /
  max. The denominator choice is unexplained and arguably wrong for shortfall framing.
- **Direction conveyed largely by color (WCAG 1.4.1 risk).** Whether a state is good
  or bad is encoded as brand/error on the primary bar and success/warning on the
  secondary (GapBar.tsx:61, 80). The only text cue is the word "Gap"/"Excess"
  (GapBar.tsx:108). There is no icon, and "Gap" is neutral wording that does not
  itself convey severity. Borderline color-only signalling on a financially relevant
  delta.
- **Zero-gap state hidden.** When `gap === 0` the entire gap row is omitted
  (GapBar.tsx:45, 91). A perfectly-met order shows two bars and no confirmation that
  there is no gap — ambiguous vs a render bug.

**Usability Issues:**
- Min gap bar width is clamped to 8% (`Math.max(gapPct, 8)`, GapBar.tsx:105). A
  trivially small gap is visually inflated to 8% of the row, overstating severity.
- Quantity text sits inside the filled bar right-aligned (GapBar.tsx:65, 84). When the
  bar is very short (small qty vs a large max) the number overflows onto the track
  background; contrast of `text-text-primary` over `bg-brand`/`bg-success` needs
  visual/manual verification.

**Simplicity Opportunities:**
- The dual boolean `isExcess`/`isShortfall` plus the `mode` prop is more state than
  needed; a single derived `direction` ("over"/"under"/"met") would remove the
  contradiction class of bug above.

**Top 3 Actionable Recommendations:**
1. Fix the mode logic so `shortfall` mode highlights the *under* case
   (`primaryQty < secondaryQty`) — the documented back-order/MOQ path is currently
   not colored as a shortfall at all.
2. Add an icon + explicit severity word (e.g. "Short by" / "Over by") so direction is
   not color-only; reconcile the gap-% denominator with the framing and document it.
3. Render an explicit zero-gap confirmation ("Met / no gap") instead of omitting the row.

---

## PipelineDAG
**Context** — Audit DAG of the compiled graph with taken-path highlight + clickable
edges (ADR-027 Phase D) · Goal: let auditors inspect which path a record took and the
verdict on each edge · Audience: audit users / compliance reviewers.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- **Taken-path is color-only on the edges (WCAG 1.4.1).** Taken vs un-taken edges
  differ only by stroke color (brand vs border), stroke width (2 vs 1) and opacity
  (PipelineDAG.tsx:301-310). The verdict pill distinguishes taken (filled outlined
  pill) from un-taken (bare text) (PipelineDAG.tsx:315-355), which helps, but an edge
  with *no* `verdict_label` has no non-color differentiator at all. The
  audit-critical "which path executed" signal leans on color. Add a marker
  (dash pattern, "taken" glyph) for unconditional taken edges.
- **Executed-node highlight is also color-only.** Nodes differ by stroke color/width
  and text color/weight (PipelineDAG.tsx:372-396); width 2 vs 1 is a weak
  non-color cue. Needs visual/manual verification but borderline.
- `EdgeDetailPanel` is keyboard-openable (edge `<g>` has `tabIndex`/Enter/Space,
  PipelineDAG.tsx:267-284) but on open, focus is **not** moved into the panel and the
  panel's Close button does not return focus to the originating edge. Keyboard users
  lose their place. The panel is `role="region"` (PipelineDAG.tsx:453) not a dialog,
  so this is a focus-management gap rather than a modal violation.

**Usability Issues:**
- Interactive edges set `style={{ outline: "none" }}` (PipelineDAG.tsx:285) — this
  removes the focus ring on the keyboard-focusable edge group with no visible
  replacement on focus (the `aria-pressed`/selected styling only changes on *click*,
  not on focus). This is a direct violation of the project's "focus ring required"
  accessibility rule and makes the DAG un-navigable for sighted keyboard users.
- Un-taken verdict labels are deliberately low-contrast `text-quaternary` at fontSize 9
  (PipelineDAG.tsx:344-351, comment 256-261). Intentional figure-ground, but fontSize
  9 quaternary on surface very likely fails AA for text — needs visual/manual
  verification; consider that these are still audit labels an auditor may need to read.
- SVG hardcodes `fontSize={9/10/11}` numeric literals (PipelineDAG.tsx:331, 344, 390).
  These are SVG text sizes not Tailwind classes, so they bypass the font-size token
  scale (`--font-size-label` is 10px, `caption` 11px). Minor token-discipline gap.

**Simplicity Opportunities:**
- `humanizeNode` is duplicated here (PipelineDAG.tsx:167-172) and in EventsTimeline
  (EventsTimeline.tsx:93-98) verbatim. Extract to a shared util.

**Top 3 Actionable Recommendations:**
1. Remove `outline:none` on focusable edges and add a visible focus indicator
   (`--color-brand-ring`); this is currently a hard keyboard-a11y failure.
2. Give taken edges a non-color differentiator (e.g. solid vs dashed, or a small
   "✓ taken" marker) so the audit path survives color-blindness/grayscale.
3. Manage focus into/out of `EdgeDetailPanel` (focus panel on open, restore to edge on
   Close); de-duplicate `humanizeNode`.

---

## PricingWaterfall
**Context** — Vertical condition-chain timeline for a line item's price build-up
(BASE → CONTRACT → TPR → UOM → RESULT/ERROR) · Goal: show how the final price was
derived, step by step · Audience: O2C pricing analysts authorizing price corrections.

**Overall Verdict:** ~~Needs Rework~~ → **Pass** ✅ (remediated Batch 4 — signed `fmtSignedPrice`/`fmtMoney`, negative RESULT signed, `step.record` guarded)

**Correctness Issues:**
- **Signed-money bug (the flagged class).** `fmtPrice` strips the sign with
  `Math.abs` (PricingWaterfall.tsx:40-42). A negative pricing adjustment (a discount /
  TPR markdown) is the *most* decision-relevant figure in a pricing dispute. The
  component partially compensates by prefixing "+" for positive non-BASE/RESULT steps
  (PricingWaterfall.tsx:109) and by coloring negative values amber
  (PricingWaterfall.tsx:104-105) — but **a negative value renders with no minus sign
  and direction is conveyed by color only**. e.g. a −$3.50 discount shows as "$3.50"
  in amber. This is both a correctness defect (missing sign on money) and a WCAG
  1.4.1 color-only-meaning defect on a SOX-relevant figure.
- The "+" prefix excludes `RESULT` and `BASE` types (PricingWaterfall.tsx:109) but a
  `RESULT` step that is itself negative (a net credit) would render unsigned with no
  amber either (RESULT forces success-green at line 106), fully hiding the sign.
- `step.record` is optional in the type (`record?: string`, exceptions.ts:323) but is
  rendered unconditionally inside a `<code>` (PricingWaterfall.tsx:96). When absent
  an empty code chip renders (empty bordered pill) — a minor empty-state artifact.

**Usability Issues:**
- `running != null` total prefixes "=" then the abs-value running total
  (PricingWaterfall.tsx:113-119) — same sign-stripping issue applies to the running
  subtotal, so a running negative subtotal is also unsigned.
- Empty-state copy "Waterfall data available after audit." (PricingWaterfall.tsx:47)
  is reasonable, but it is plain italic tertiary text with no icon — acceptable, not a
  status indicator.

**Simplicity Opportunities:**
- The inline `style` color ternary (PricingWaterfall.tsx:103-107) duplicates the
  error/result/amber logic already encoded in the surrounding class names; could be
  consolidated.

**Top 3 Actionable Recommendations:**
1. **Stop using `Math.abs` for money.** Render the real sign (`-$3.50` / `+$3.50`)
   for every value and running subtotal so direction is never color-only — this is the
   single most important fix in the slice.
2. Guard `step.record` rendering behind a presence check to avoid an empty code chip.
3. Ensure negative `RESULT` values are signed and not forced into the positive/green
   treatment.

---

## WaterfallStepper
**Context** — Real-time per-node pipeline progress driven by WebSocket events, with an
optional trace-replay control · Goal: show the agent pipeline working live · Audience:
operators watching an exception resolve.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `formatDuration(0)` returns "" because `if (!ms)` treats 0 as falsy
  (WaterfallStepper.tsx:80-84). A genuinely 0ms (sub-millisecond, rounded) node shows
  no duration. Minor.
- `dataSummary` reads `data.intent`, `data.shadow_verdict`, `data.selected_recipe`,
  `data.final_status` (WaterfallStepper.tsx:88-115) — these are runtime enum values
  rendered as raw strings, which is permitted (display, not a hardcoded option list).
  No guardrail issue. Correct to note it stays default-safe.

**Usability Issues:**
- `prefersReducedMotion()` is read once inside the `canReplay` `useMemo`
  (WaterfallStepper.tsx:139-147) with `nodes` as the only meaningful dep. If the user
  toggles the OS reduced-motion setting after mount, the replay button visibility does
  not update (no `matchMedia` change listener). Edge case, but the comment promises
  reduced-motion is respected.
- The live "started" state uses `ActivityIndicator` (text, WaterfallStepper.tsx:263)
  plus a pulse dot — good, not color-only. Completed/failed use icon+color
  (WaterfallStepper.tsx:59-62) — good. Skipped uses a dashed ring + Minus icon
  (WaterfallStepper.tsx:69-74) but **no text label** distinguishing "skipped"; the
  node label just dims to quaternary (WaterfallStepper.tsx:249). A SR/low-vision user
  cannot tell skipped from pending. Add a "skipped" textual cue.
- The whole stepper has no list semantics / `aria-live` region, yet it is the
  real-time progress surface. State changes are announced only implicitly via
  ActivityIndicator's own `aria-live`. Consider wrapping in an ordered list for
  structure.

**Simplicity Opportunities:**
- `displayNodes` replay synthesis (WaterfallStepper.tsx:184-197) is reasonably
  contained. No major reduction available.

**Top 3 Actionable Recommendations:**
1. Add a visible/SR text label for the "skipped" state (icon-only today fails the
   icon+text rule).
2. Fix `formatDuration` to render "0ms" instead of "" for zero durations.
3. Add a `matchMedia('change')` listener so the reduced-motion replay gate stays live;
   give the stepper list semantics.

---

## ConstraintsPipeline
**Context** — Left-to-right SVG flow of floor checks → validations → classification for
email order entry · Goal: show which gates the inbound order passed/breached as a
sequence · Audience: O2C operators reviewing email-order classification.

**Overall Verdict:** Pass (with one minor item)

**Correctness Issues:**
- Pure projector; reads only `floor_status` booleans + `validation_failures` length +
  `classification` (ConstraintsPipeline.tsx:83-122). No synthesis, Guardrail #6
  respected. The classification tone map has an explicit default-fallback to neutral
  with the raw token as caption (ConstraintsPipeline.tsx:113-120), satisfying
  Guardrail #1. Correct.
- Pass/fail meaning is **not** color-only: each node renders its caption text
  ("Passed"/"Breached"/"N issues"/label) inside the SVG (ConstraintsPipeline.tsx:234-243)
  and there is a complete `sr-only` `<ul>` mirror (ConstraintsPipeline.tsx:252-265).
  Good WCAG 1.4.1 handling. Note: there is no *icon* (✓/✗) drawn in the SVG despite
  the JSDoc art showing them (ConstraintsPipeline.tsx:13-15) and the comment claiming
  "pass/fail nodes carry icons" (ConstraintsPipeline.tsx:25) — the text caption carries
  the meaning instead, so it is compliant, but the doc overstates. Minor doc/impl drift.

**Usability Issues:**
- SVG `fontSize={11/10}` numeric literals (ConstraintsPipeline.tsx:228, 238) bypass the
  font-size token scale (same SVG-text caveat as PipelineDAG). Minor token discipline.
- Caption text color carries severity (ConstraintsPipeline.tsx:204-211) but is paired
  with the literal word, so acceptable.

**Simplicity Opportunities:**
- The three parallel ternary ladders for fill/stroke/captionColor
  (ConstraintsPipeline.tsx:188-211) could be a single status→token lookup map for
  readability. Optional.

**Top 3 Actionable Recommendations:**
1. Either draw the ✓/✗ icons the JSDoc/comment promise, or update the comment so it
   doesn't claim icons that aren't rendered.
2. Collapse the fill/stroke/caption ternaries into one status→token map.
3. (Optional) move SVG font sizes to reference the token scale values.

---

## EventsTimeline
**Context** — Operator-first list of only the nodes that executed for a record, with
halt emphasis and expandable decision/policy/gateway detail (ADR-027 Phase C) · Goal:
show the executed path + halt reason and let the operator drill in · Audience:
operators/auditors reviewing a record's traversal.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `verdictVariant` (EventsTimeline.tsx:76-89) hardcodes a set of business verdict
  strings (`green/yellow/red/breach/no_recipe/required_gw_fail/...`). The doc frames it
  as a visual-mapping with a default fallback, which is the *allowed* pattern under
  Guardrail #1 — but this list embeds closed-set business tokens (`no_recipe`,
  `cross_check_disagreement`) directly in a `.tsx`. It is defensible (default branch
  renders unknown verdicts neutrally), yet it is the kind of literal list that drifts
  from the backend. Borderline; flag for review, not a hard violation.
- `statusIndicator` (EventsTimeline.tsx:45-66) has no `default`/fallback branch — it
  switches on `completed | halted | errored` and returns `undefined` for any other
  status. If the contract ever adds a status, the row renders no indicator (and React
  renders nothing) with no neutral fallback. Add a default.

**Usability Issues:**
- **`pl-30` is not a defined spacing token.** Used on the expanded detail container
  (EventsTimeline.tsx:250). The token scale jumps 24 → 32 (tailwind.config.ts:118-119);
  there is no `--space-30`/`space-30` mapping, so `pl-30` is either an arbitrary/invalid
  utility or silently no-ops. Concrete token-discipline defect.
- The expand control is a `<button>` with `aria-expanded` (EventsTimeline.tsx:205-212)
  — good. But when a row is **not** expandable, the same element is still a `<button>`
  with `cursor` default and no `aria-expanded` (set to `undefined`); fine, though a
  non-expandable row arguably shouldn't be a button at all (it has no action).
- Halt row uses `bg-error-subtle/40` opacity-modifier on a token color
  (EventsTimeline.tsx:202). Acceptable (Tailwind alpha on a CSS-var color), but verify
  the resulting tint reads in dark mode — needs visual/manual verification.
- Decision payload renders raw `JSON.stringify` in a `<pre>` (EventsTimeline.tsx:266-276).
  For an operator (domain expert, not developer) raw JSON is jargon-heavy; acceptable
  as Layer-2 forensic detail but worth noting as the least operator-friendly surface.

**Simplicity Opportunities:**
- `humanizeNode` duplicated with PipelineDAG (see that entry). Extract shared util.
- `fmtDuration` here (`.toFixed(2)`) and WaterfallStepper's `formatDuration`
  (`.toFixed(1)`) diverge in precision — inconsistent duration formatting across two
  pipeline surfaces the same operator sees. Unify.

**Top 3 Actionable Recommendations:**
1. Replace `pl-30` with a valid token (`pl-24` or `pl-32`).
2. Add a `default` branch to `statusIndicator` (neutral indicator) so an unmapped
   status still renders something.
3. Unify `humanizeNode` and duration-formatting helpers across EventsTimeline /
   WaterfallStepper / PipelineDAG.

---

## ConfidenceDisplay
**Context** — Single cross-case confidence renderer (bar / inline / prominent) ·
Goal: render a model confidence score honestly (calibrated vs raw) · Audience: every
operator authorizing an agent recommendation.

**Overall Verdict:** Pass

**Correctness Issues:**
- Band is never color-only: band label text + percentage are always rendered, plus a
  composed root `aria-label` stating value/band/calibration (ConfidenceDisplay.tsx:93,
  176-182). Strong WCAG 1.4.1 compliance.
- The honesty posture is well-handled: `calibrated` undefined/false frames the score as
  a "model score" with a *visible* (not aria-only) marker across all three variants
  (ConfidenceDisplay.tsx:131-132, 153-164, 180-181). This directly addresses the
  documented 2026-06 rendered-experience finding. Correct and audit-aligned.
- `prominent` preserves the raw producer value for audit fidelity
  (ConfidenceDisplay.tsx:141, 149-151). Good.

**Usability Issues:**
- The `prominent` calibration note wrapper has `tabIndex={0}`
  (ConfidenceDisplay.tsx:156) making a *static text* div keyboard-focusable with no
  role and no action. This creates a confusing focus stop for keyboard users (focus
  lands on non-interactive text). Its inner content is `aria-hidden` while the parent
  group already carries the aria-label, so the tab stop adds nothing. Remove the
  `tabIndex`.
- `inline` variant uses `role="img"` with an aria-label (ConfidenceDisplay.tsx:171-174)
  while `bar`/`prominent` use `role="group"`. `role="img"` collapses the inner content
  to a single image node for SR, which is fine for the compact chip; minor
  inconsistency but defensible per-variant.

**Simplicity Opportunities:**
- Very clean. `confidenceBandMeta` re-export (ConfidenceDisplay.tsx:240-246) is a small
  escape hatch documented as "rare" — acceptable.

**Top 3 Actionable Recommendations:**
1. Remove `tabIndex={0}` from the static calibration-note div in `prominent` — it is a
   keyboard trap-stop on non-interactive text.
2. (Optional) Add a short tooltip/title on the calibration marker so the full caveat is
   reachable in compact variants without relying on the aria-label.
3. (Optional) Document why `inline` uses `role="img"` vs `group` to prevent future drift.

---

## EvidenceBlock
**Context** — Canonical Layer-2 evidence primitive enforcing three presence states
(present / structurally-omitted / "Context Not Required for Resolution") · Goal: be the
single place that decides WHETHER to render an audit field · Audience: every section
component (indirectly the operator).

**Overall Verdict:** Pass

**Correctness Issues:**
- The three states are implemented cleanly and in the right precedence:
  conditional+!predicate → labelled placeholder (EvidenceBlock.tsx:115-125); present →
  render children (EvidenceBlock.tsx:128-130); audit-bearing absent → dev warning then
  null (EvidenceBlock.tsx:138-149); contextual/other absent → null
  (EvidenceBlock.tsx:149). Matches the Verdict's three named states exactly.
- `isPresent` mirrors the backend `_populated` definition (undefined/null/empty
  string/array/object all absent, EvidenceBlock.tsx:92-100). One edge: a value of
  `0` (number) or `false` (boolean) is correctly treated as **present** (only the
  string/array/object/null/undefined branches return false). Good — a zero price or a
  `false` boolean flag is real audit data and must render. Worth an explicit test if
  not already covered.
- The "Context Not Required for Resolution" placeholder carries `role="note"` +
  `aria-label` (EvidenceBlock.tsx:116-119) so it is announced as the deliberate skip it
  represents. Correct accessibility framing.

**Usability Issues:**
- The placeholder text is operator-facing jargon: "Context Not Required for Resolution"
  (EvidenceBlock.tsx:107) is precise but dense for a non-developer. It is overridable
  via `notRequiredLabel`, so callers can soften it; acceptable as a default given the
  compliance provenance.
- The dev-only `console.warn` (EvidenceBlock.tsx:140-144) is correct (fail-closed,
  silent in prod). No user-facing impact.

**Simplicity Opportunities:**
- Minimal and single-purpose by design. Nothing to remove. This is the model the other
  components should defer to for absence handling (notably PricingWaterfall/GapBar do
  their own ad-hoc empty handling instead).

**Top 3 Actionable Recommendations:**
1. Add/confirm a unit test that `0` and `false` count as present (the one subtle branch
   in `isPresent`).
2. (Optional) Soften the default `notRequiredLabel` wording, or pair it with a small
   info icon, for the operator audience.
3. Encourage adoption: PricingWaterfall and GapBar empty/zero states should route
   through this primitive rather than bespoke "available after audit" / omitted-row text.

---

## ClassificationHistoryPanel
**Context** — Append-order audit strip of classification events (HUMAN/MODEL/RULE
badge, supergroup, intent, reason) on the case detail surface · Goal: show who/what
classified the case and why, over time · Audience: operators/auditors reviewing
classification provenance, including redacted partner views.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- Loading/error/empty states all handled: spinner with `role="status"`/`aria-live`
  (ClassificationHistoryPanel.tsx:77), `role="alert"` error
  (ClassificationHistoryPanel.tsx:90), and empty → render null per Guardrail #6
  (ClassificationHistoryPanel.tsx:96). Correct.
- `CLASSIFIER_ICON` / `CLASSIFIER_VARIANT` are keyed by `ClassifierType`
  (ClassificationHistoryPanel.tsx:34-47) — a closed UI enum. If the backend adds a
  classifier type, `CLASSIFIER_ICON[e.classifier_type]` and `CLASSIFIER_VARIANT[...]`
  return `undefined` (no default-fallback), so the Badge variant goes undefined and the
  icon is blank (ClassificationHistoryPanel.tsx:120-124). Unlike the verdict mappers
  elsewhere, there is no default branch. Add fallbacks for forward-compatibility.
- Partner redaction handled correctly: `classifiedByLabel` strips `internal:` / `user:`
  prefixes (ClassificationHistoryPanel.tsx:55-64); reason/model_version guarded on
  presence (ClassificationHistoryPanel.tsx:148, 159). Good.

**Usability Issues:**
- **Raw timestamp rendered.** `<time>{e.classified_at}</time>`
  (ClassificationHistoryPanel.tsx:143) prints the raw ISO string as the visible label.
  For an audit strip the operator sees an unformatted machine timestamp; the `dateTime`
  attr is correct but the human-readable text should be localized/relative-formatted.
- Badge content is `{icon}` + `<span className="ml-4">{type}</span>`
  (ClassificationHistoryPanel.tsx:123-124) — icon+text, good for WCAG 1.4.1. The icons
  carry `aria-hidden` (ClassificationHistoryPanel.tsx:35-37) so the text carries
  meaning. Correct.
- Heading uses `--font-size-heading` `<h2>` (ClassificationHistoryPanel.tsx:105) inside
  what may be a sub-panel; verify heading-level order on the case page so the document
  outline isn't skipped — needs manual verification.

**Simplicity Opportunities:**
- `taxonomy_version` is always shown (ClassificationHistoryPanel.tsx:156-157) while
  `model_version` is conditional; both are dense provenance tokens. Acceptable for an
  audit strip but visually busy — could be tucked behind a details affordance.

**Top 3 Actionable Recommendations:**
1. Format `classified_at` for humans (localized / relative), keeping the ISO value in
   the `dateTime` attribute.
2. Add default-fallbacks to `CLASSIFIER_ICON` / `CLASSIFIER_VARIANT` so an unknown
   classifier type still renders a neutral badge + icon.
3. Verify the `<h2>` heading level fits the case-page outline; consider de-emphasizing
   the version tokens.

---

## Slice Summary

**Verdict counts (post Batch 4): 4 Pass / 5 Needs Minor Tweaks / 1 Needs Rework** (was 3/5/2 — PricingWaterfall flipped to Pass; GapBar remains Rework → Batch 5).
- Pass (3): ConfidenceDisplay, EvidenceBlock, ConstraintsPipeline
- Needs Minor Tweaks (5): MetricTile, PipelineDAG, WaterfallStepper, EventsTimeline,
  ClassificationHistoryPanel
- Needs Rework (2): GapBar, PricingWaterfall

**Top cross-cutting issues:**
1. **Signed-money / direction-by-color on financial deltas.** PricingWaterfall strips
   the sign with `Math.abs` and leans on amber to convey "negative"
   (PricingWaterfall.tsx:40-42, 104-109); GapBar conveys shortfall/excess and even
   mis-maps the shortfall case via color + a neutral "Gap" word (GapBar.tsx:47-48,
   61-108). On SOX-relevant surfaces a sign must be explicit text, never color-only.
2. **Keyboard/focus accessibility gaps on interactive viz.** PipelineDAG removes the
   focus outline on focusable edges with no replacement (PipelineDAG.tsx:285) and
   doesn't manage focus into/out of its detail panel; ConfidenceDisplay puts a stray
   `tabIndex={0}` on static text (ConfidenceDisplay.tsx:156); WaterfallStepper's
   "skipped" and EventsTimeline non-expandable rows have icon-only/no-action quirks.
3. **Token discipline + helper duplication.** `pl-30` is an undefined spacing token
   (EventsTimeline.tsx:250); SVG components hardcode numeric `fontSize` outside the
   token scale (PipelineDAG, ConstraintsPipeline); `humanizeNode` and duration
   formatters are duplicated/divergent across PipelineDAG / EventsTimeline /
   WaterfallStepper. Several mapping objects lack the default-fallback the project's
   own pattern requires (EventsTimeline `statusIndicator`, ClassificationHistoryPanel
   classifier maps).
