# UX/UI Review — Exceptions Detail: Intent-Specific Enrichment Sections

**Reviewer:** Expert QA / UX-UI Evaluator
**Date:** 2026-06-06
**Slice:** Layer-2 intent-specific evidence projectors under `src/app/exceptions/`
**Audience for the surfaces:** O2C operators / analysts / managers authorizing financially-binding, SOX-relevant decisions.

Scope note: these sections are "dumb projectors" — they render backend-authoritative `analysis.*` data and must avoid client-side composition and `?? "—"`/"N/A" partial-truth fallbacks (Guardrail #6). The review weighs data formatting (currency / dates / percentages / quantities) and correct use of `EvidenceBlock` most heavily, since operators authorize money off these values.

Shared helper of note: `fmtPrice` (`shared.tsx:218`) renders `$x,xxx.xx` but uses `Math.abs(n)` — it strips the sign from negative values. Several sections rely on it for deltas/freight where sign matters; flagged per-section below.

---

### PriceHoldSection
**Context**
- Card: "Price Hold Analysis" pane. Goal: show PO vs SAP base price, signed variance, policy thresholds, recipe action + reason. Audience: pricing/credit operators deciding release vs block.

**Overall Verdict:** Pass

**Correctness Issues:**
- `fmtVariance` (`PriceHoldSection.tsx:38-42`) is reused for `tolerance_pct` and `hard_block_pct` (`:92-93`). Tolerance/hard-block are thresholds, not signed deltas, yet they render with a forced `+` sign (e.g. "+5.0%"). A threshold reading "+5.0%" is slightly odd vs a variance reading "+5.0%"; consider an unsigned percent format for thresholds. Minor correctness/semantics, not a money error.
- `fmtPrice` strips sign — fine here because `po_price`/`sap_base_price` are non-negative absolute prices. OK.
- Reason wrapped correctly in `EvidenceBlock tier="contextual"` (`:113`). No partial-truth fallback. Good.

**Usability Issues:**
- Recipe footer hardcodes `PriceHoldReleaseRecipe.py` as a literal (`:126`). This is a recipe name string in JSX. It is a display label sourced from neither props nor health. Borderline Guardrail #1 (recipe names should not be string literals); at minimum it should come from the analysis payload, since the producing recipe can change. Flag for review.
- Variance arrow column (`:80-85`) shows variance under a directionless `ArrowRight`; the arrow does not encode increase/decrease. The signed % carries the meaning, which is acceptable, but a directional cue would aid 3-second scanning.

**Simplicity Opportunities:**
- "Recipe Decision" block (`:107-112`) repeats `action.label` already shown in the header badge (`:72-74`). Two renderings of the same decision string within one card is redundant.

**Top 3 Actionable Recommendations:**
1. Source the recipe name from the payload instead of the hardcoded `PriceHoldReleaseRecipe.py` literal (Guardrail #1).
2. Use an unsigned percent format for `tolerance_pct` / `hard_block_pct` (they are thresholds, not signed deltas).
3. De-duplicate the action label between header badge and "Recipe Decision" block, or differentiate their roles.

---

### PriceAnalysisSection
**Context**
- Card: "Price Delta Analysis". Goal: visualize ERP vs PO unit price, variance %, total at risk, plus collapsible SAP context. Audience: pricing analysts.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- The header variance pill uses hardcoded numeric thresholds (`> 10`, `> 5`) to pick color (`:53-57`), and the same `> 10` drives the Variance tile highlight (`:137`). This is UI-side business logic / threshold calculation, which CLAUDE.md explicitly forbids ("no threshold calculations", Guardrail intro + §5). The recipe owns thresholds; the UI re-derives a severity band client-side. This is the most significant finding in this component.
- `variance_amount` shown via `fmtPrice` (`:113`) which strips sign — acceptable here because the copy explicitly says "below ERP" and the `isPoBelow` guard frames direction. OK but fragile.
- Currency formatting via `fmtPrice` consistent. `total_quantity.toLocaleString()` with `uom` (`:170`) good. `order_date` parsed with `new Date(...).toLocaleDateString()` (`:172`) — acceptable, but locale-dependent and will read "Invalid Date" if backend ever sends a non-ISO string (no guard). Minor.
- Contextual fields (`material_desc`, `order_date`, `contract_ref`, `promotion_ref`) correctly wrapped in `EvidenceBlock` (`:167-189`). No `?? "—"`. Good. Note: `doc_type`, `doc_number`, `sku`, `rule_id`, `root_cause_category`, `total_quantity` are rendered via raw `SapRow` without EvidenceBlock (`:163-175`) — they are audit-bearing so direct render is defensible, but inconsistent with EdiMismatch which wraps audit-bearing fields in EvidenceBlock too. See cross-cutting note.

**Usability Issues:**
- Bar widths normalize to `maxPrice` (`:35-37`); when ERP and PO are close, both bars are near-full and the visual delta is invisible — the operator must read the labels. The chart adds little signal in the common small-variance case.
- "Variance" pill says "X% variance" with no sign/direction; combined with the bar this is ambiguous about which side is higher without reading both labels.

**Simplicity Opportunities:**
- Four metric tiles (`:121-145`) restate ERP/unit, PO/unit, Variance, At-Risk which already appear in the bars + header pill. Significant duplication; consider dropping the two unit-price tiles.

**Top 3 Actionable Recommendations:**
1. Remove client-side threshold logic (`variance_pct > 10 / > 5`) for severity coloring — drive band color from a backend-provided severity field, not a UI calculation (Guardrail: no UI-side thresholds).
2. Wrap audit-bearing SAP rows in `EvidenceBlock tier="audit-bearing"` for consistency and fail-closed behavior on drift.
3. Reduce metric-tile/bar duplication to tighten the card.

---

### EdiMismatchSection
**Context**
- Card: "EDI Line Mismatch". Goal: expected vs received value, classification, recommended action, autonomy. Audience: EDI/order analysts.

**Overall Verdict:** Pass

**Correctness Issues:**
- Audit-bearing `expected_value` / `received_value` correctly wrapped in `EvidenceBlock tier="audit-bearing"` (`:94,100`) with `stringifyUnknown` coercion (`:51-56`). `notification_template` contextual via EvidenceBlock (`:120`). Exemplary adherence to Guardrail #6 — this is the reference pattern for the slice.
- Autonomy label sourced from `useHealth` via `autonomyLevelLabel` (`:135`) — Guardrail #1 compliant.
- Forward-compat neutral badge fallback for unknown classification (`:67-70`). Good.

**Usability Issues:**
- `data.recommended_action` rendered raw (`:118`). If the backend emits a code (e.g. `HARD_REJECT`) rather than prose, this reads as a bare token; depends on producer. Needs runtime/manual verification of the value shape.
- `stringifyUnknown` JSON-stringifies objects (`:52-54`); a complex object value would dump raw JSON to an operator. Acceptable as defensive coercion but ugly if it ever fires.

**Simplicity Opportunities:**
- None material. Clean, well-commented component.

**Top 3 Actionable Recommendations:**
1. Confirm `recommended_action` is human-readable prose at the source (or map to a label) so it doesn't render as a bare enum token.
2. Consider a friendlier rendering than raw JSON for object-shaped EDI values, if those occur.
3. No further changes — use this component as the slice's EvidenceBlock template.

---

### Edi850Section
**Context**
- Card: "EDI 850 Audit" with Decoded / Raw X12 / Segment Map tabs. Goal: full ANSI X12 850 PO audit view. Audience: EDI auditors. (preview-only producer.)

**Overall Verdict:** Pass

**Correctness Issues:**
- Currency via `formatUsd` using `Intl.NumberFormat` (`:57-62`) — correct, formats `total_amount`, `unit_price`, `extended_amount` (`:190,244,250`). Each wrapped in `EvidenceBlock tier="contextual"`. Good.
- Dates (`po_date`, `requested_delivery_date`) rendered raw via `String(v)` (`:145,155`) with no `toLocaleDateString` formatting — but these are EDI raw document fields (the point of an X12 audit view is verbatim fidelity), so raw is arguably correct here. Acceptable in this context, unlike the analysis sections.
- `quantity` rendered as `{line.quantity} {line.uom}` (`:236`) without `toLocaleString` — minor; large qty won't get thousands separators. Low severity for an audit dump.
- `totals.total_quantity` via `String(...)` (`:186`) — same minor formatting note.

**Usability Issues:**
- Raw X12 view (`:286-295`) is color-coded by segment group with no text legend in that view (the colors map to groups defined in `groupClass`). Color-only grouping risks WCAG 1.4.1 in the Raw view; the Segment Map view does pair color with text, so the audit meaning is recoverable. Flag the Raw view specifically.
- Copy button gives feedback ("Copied", `:283`) but failure path is a silent no-op (`:265-267`) — operator gets no indication if clipboard is blocked.

**Simplicity Opportunities:**
- Three-way view switch is justified by distinct audit needs; no trimming recommended.

**Top 3 Actionable Recommendations:**
1. Add a text legend (or `title`/aria) to the Raw X12 view so segment grouping is not color-only (WCAG 1.4.1).
2. Surface a small toast/inline message when clipboard copy fails rather than silent no-op.
3. Apply `toLocaleString` to numeric quantities for readability (low priority given audit-fidelity intent).

---

### DuplicateDetectionSection
**Context**
- Card: "Duplicate Detection". Goal: original vs duplicate order, detection confidence, method, recommended action + cancel target, autonomy. Audience: order-management operators authorizing a cancellation.

**Overall Verdict:** Pass

**Correctness Issues:**
- `confidence` is typed 0-100 (`exceptions.ts:971-972`) and passed to `ConfidenceDisplay` with `scale="percent"` (`:52-54`) — correct match; verified `ConfidenceDisplay` handles percent scale. Good.
- `days_between` rendered as `{data.days_between}d apart` (`:67`) — fine, integer days.
- `created_date` via `new Date(...).toLocaleDateString()` (`:149`) — acceptable.
- `total_value` via `fmtPrice` (`:153`) — non-negative order value, sign-stripping irrelevant. OK.
- Audit-bearing fields (`recommended_action`, `cancellation_target`, `autonomy_applied`) wrapped in `EvidenceBlock tier="audit-bearing"` (`:89,98,112`); `detection_method` contextual (`:74`). No partial-truth fallbacks. Strong Guardrail #6 compliance.

**Usability Issues:**
- `order.status` rendered as a raw `Badge` value (`:161`) — status string passed verbatim; relies on backend prose. Minor.
- Cancel target is high-stakes (drives a cancellation) and is styled in `text-error` (`:102`) which is good emphasis, but it sits as a small caption under the recommended action; given the financial weight, it could warrant stronger prominence.

**Simplicity Opportunities:**
- None material. Well-structured.

**Top 3 Actionable Recommendations:**
1. Consider elevating the cancellation-target prominence — it is the single most consequential field for this exception type.
2. Confirm `order.status` is operator-readable prose.
3. No further changes needed.

---

### OrderComparisonSection
**Context**
- Card: "Order Comparison". Goal: N-way side-by-side order comparison with matching/differing field badges and line tables. Audience: operators confirming a duplicate.

**Overall Verdict:** Pass

**Correctness Issues:**
- `orders`, `matching_fields`, `differing_fields` all audit-bearing and wrapped in `EvidenceBlock tier="audit-bearing"` (`:49,64,82`). Empty arrays count as absent per `isPresent`, fails closed. Good.
- `total_value` via `fmtPrice` (`:123`) and `unit_price` (`:152`) — non-negative, OK. `qty.toLocaleString()` (`:151`) good. `created_date` localized (`:122`). Consistent formatting.
- Field name humanization via `f.replace(/_/g, " ")` (`:58,73`) — purely cosmetic on field-name strings, not data composition. Acceptable.

**Usability Issues:**
- `OrderComparisonCard` uses `index > 0` to label "Duplicate" vs "Original" (`:99`) — a positional/UI inference about which order is the duplicate. This is a small piece of UI-side semantics not backed by an explicit backend flag; if the backend ordering ever changes, the labels flip. Borderline Guardrail #6 (deriving meaning from position rather than authoritative data). Flag.
- Dynamic grid columns `repeat(${orders.length}, 1fr)` (`:86`) via inline style — for >3 orders the cards get cramped with horizontal-scroll tables nested inside. Needs visual verification at higher N.

**Simplicity Opportunities:**
- `MetaRow`/table structure is clean; no trimming needed.

**Top 3 Actionable Recommendations:**
1. Drive the "Original/Duplicate" label from an authoritative backend flag rather than array index position (Guardrail #6 — avoid UI-derived semantics on a SOX surface).
2. Verify layout at N>3 orders (cramped columns + nested scroll tables).
3. Otherwise solid.

---

### ChangeAnalysisSection
**Context**
- Card: "Change Analysis". Goal: Layer-1 decision panel + Layer-2 constraint checks, lifecycle bar, requested changes, scenarios. Audience: operators evaluating order-change requests. (preview-only producer.)

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `decision.confidence` typed as plain `number` (`exceptions.ts:641`) and rendered `Math.round(decision.confidence * 100)%` (`:144`) — assumes 0-1 scale. This is the canonical pattern elsewhere, but unlike DuplicateDetection it does NOT use `ConfidenceDisplay` and there's no calibration/band treatment. Inconsistent with the slice's confidence rendering and bypasses the accessible `ConfidenceDisplay`. Flag.
- `formatDelta` (`:51-54`) correctly produces signed currency with a proper minus glyph (`−`) and `formatUsd` on absolute — good, sign preserved (better than `fmtPrice`).
- `revenue_impact_usd` / `financial_delta_usd` via `formatUsd`/`formatDelta` (`:155,279`) wrapped in `EvidenceBlock tier="contextual"`. Good.
- `statusVariant` maps `WARNING -> error` (red) and `CONDITIONAL -> warning` (amber) (`:33-41`). The semantic inversion (a status literally named "WARNING" rendering in the error/red token, while "CONDITIONAL" gets the warning/amber token) is confusing and could mislead an operator on severity. Correctness/semantics finding.
- `check.detail`, `check.status` rendered raw; `check.metric`, `check.system_ref` via EvidenceBlock (`:237,240`). `change_items` and `sap_actions` wrapped in EvidenceBlock (`:87,165`). Good coverage.

**Usability Issues:**
- `ci.from_value` / `ci.to_value` rendered raw (`:100,102`) — if these are money/qty they're unformatted (depends on backend type, they appear to be strings). Needs verification.
- Constraint `check.status` badge renders the raw status string (`:233`) e.g. "PASS"/"CONDITIONAL" — bare enum tokens shown to operator; acceptable but terse.

**Simplicity Opportunities:**
- Three count badges in header (pass/conditional/warning, `:69-71`) plus per-constraint status badges is some redundancy but provides a useful summary; keep.

**Top 3 Actionable Recommendations:**
1. Render `decision.confidence` through `ConfidenceDisplay` for consistency + accessibility (band + icon + text), matching DuplicateDetection.
2. Fix the `statusVariant` semantic inversion — a status named "WARNING" should not map to the error/red token while "CONDITIONAL" takes amber.
3. Confirm `change_items` from/to values are pre-formatted by backend (esp. if money/qty).

---

### BackOrderSection
**Context**
- Card: "Back-Order / OOS Analysis". Goal: inventory gap, DC inventory, substitutes/production/inbound-PO (conditional on resolved_action), ranked resolution options. Audience: supply/fulfillment operators. Most sophisticated conditional-field handling in the slice.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- Excellent use of `EvidenceBlock tier="conditional"` with `predicateHolds` driven by `predicateHolds()` against `resolved_action` (`:49-63, 141-264`), including correct pre-/post-disposition semantics. This is the reference implementation for conditional evidence. Strong.
- Resolution option scoring uses hardcoded thresholds `>= 0.8 / >= 0.5` for color (`scoreColor`/`scoreBg`, `:301-305`). These are UI-side severity bands on a 0-1 score — same threshold-calculation concern as PriceAnalysis, though lower stakes (visual band on a backend-provided composite score). Flag.
- `freight_delta_per_unit` rendered with explicit `+` sign then `fmtPrice(wh.freight_delta_per_unit)` (`:162`). Because `fmtPrice` uses `Math.abs`, a NEGATIVE freight delta is shown as a positive dollar amount with no `-` (the `+` prefix is conditioned on `> 0`, so negatives get no sign at all): e.g. `-$0.30/u` would render as `$0.30/u` — a freight SAVING shown as a bare cost. The color goes green (`text-success`) so direction is recoverable by color, but the numeric value loses its sign. **Money-formatting correctness finding.**
- `sub.price_delta_pct` correctly signed via explicit `+`/native `-` from `toFixed` (`:255`). `acceptance_rate * 100` percent (`:257`) good. `at_risk` via `fmtPrice` (`:98`) non-negative OK.
- Dates (`atp_date`, production `date`, inbound `eta`) localized (`:96,198,224`) — good.

**Usability Issues:**
- DC inventory count `1 + alternateCount` (`:110`) — when alternates are collapsed post-disposition, count is 1; correct, but the "(1 location)" reading while an ALT_DC list exists but is gated could momentarily confuse. Minor.
- Resolution-option score dimensions rendered `capitalize` from object keys (`:347`) — relies on backend key names being presentable; e.g. `eta_days` would show "Eta_days". Needs verification.

**Simplicity Opportunities:**
- Dense card; the multi-dimensional score bars (`:343-360`) are information-rich but could overwhelm. Acceptable given the decision complexity.

**Top 3 Actionable Recommendations:**
1. Fix `freight_delta_per_unit` sign loss — negative (savings) deltas render as positive dollars due to `fmtPrice`'s `Math.abs`. Use a signed currency formatter (like `formatDelta` in ChangeAnalysis).
2. Move resolution-score color banding off hardcoded UI thresholds toward a backend-provided band where feasible.
3. Verify score-dimension key names render presentably (avoid raw snake_case keys via `capitalize`).

---

### DeliveryDelaySection
**Context**
- Card: "Delivery Delay Analysis". Goal: planned-vs-projected timeline, category/rule/carrier, at-risk + affected lines, delay reason, SLA, alternate options. Audience: logistics operators.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `data.alternate_options ?? []` (`:125`) — this is a `?? []` defaulting on an array field, used to drive local selection state and the `.length > 0` render gate (`:248`). This is a fallback-to-empty rather than EvidenceBlock handling. It does not render a dash/"N/A", and an empty array is structurally equivalent to absent (so the section omits cleanly), so it is NOT a partial-truth display violation — but it is a roll-your-own absence path instead of EvidenceBlock. Minor inconsistency; acceptable since absence => render nothing.
- `at_risk` handled via `EvidenceBlock tier="conditional"` with a custom `notRequiredLabel` citing a gateway gap + deadline (`:194-211`) — exactly the grandfather-clause pattern the Verdict prescribes. Excellent.
- `data.route` rendered inline with `data.route ? (...) : null` (`:182-184`) — a raw conditional inside the carrier EvidenceBlock children rather than its own EvidenceBlock. It renders nothing when absent (no dash), so not a partial-truth violation, but `route` is composed into the carrier row rather than projected independently. Borderline; acceptable.
- `extra_cost` in `OptionCard` uses `fmtPrice(option.extra_cost)` and `fmtPrice(Math.abs(...))` with explicit copy "freight"/"saved"/"No freight impact" (`:72-76`) — sign is conveyed by COPY + color, and `Math.abs` is applied deliberately. This is correct and well-handled (contrast with BackOrder's freight bug). Good.
- Dates via `fmtDate` (`Intl`-ish `toLocaleDateString` with options, `:23-27`) — consistent and good.
- Timeline bar overrun width is a fixed heuristic (`Math.min(40, Math.max(6, daysLate*5))`, `:36`) — purely visual scaling, not a data value, acceptable.

**Usability Issues:**
- `delay_category` rendered raw monospace (`:163`) — bare category token to operator. Minor.
- The 2-col context grid (`:159`) mixes a hardcoded Category cell with EvidenceBlock cells; when several contextual cells omit, the grid can leave uneven gaps. Needs visual verification.

**Simplicity Opportunities:**
- Clean. No trimming needed.

**Top 3 Actionable Recommendations:**
1. Consider routing `alternate_options` through EvidenceBlock for consistency (currently `?? []`), though current behavior is compliant.
2. Verify the 2-col context grid layout when contextual cells (Rule/Carrier) structurally omit (possible uneven gaps).
3. Confirm `delay_category` is operator-readable prose.

---

### MOQSection
**Context**
- Card: "Min Order Qty Analysis". Goal: shortfall gap bars, SAP V4082 block detail, AI round-up plan + totals, SAP execution steps, HITL callout. Audience: order-management operators.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- **Client-side aggregation of audit-relevant numbers (Guardrail #6 violation).** `roundedTotal` and `deltaTotal` are computed in the UI by reducing over `round_up_plan` (`:29-30`) and displayed as the TOTAL row (`:181,184`). The section is summing financially-relevant quantities client-side rather than rendering a backend-provided total. This is exactly the "UI composes/derives values" pattern the guardrails reject for a SOX surface — the total an operator authorizes should come from the backend, not a UI `reduce`. Strongest finding in this component.
- Block-detail outer card render gate uses a raw boolean OR of five fields (`:105-106`) to decide whether to mount the card; inner fields then use EvidenceBlock. The gate itself is fine (it's a presence test, not a dash), and inner fields are EvidenceBlock-wrapped. OK.
- `sap_steps` gated by `(data.sap_steps?.length ?? 0) > 0` (`:196`) — `?? 0` on a length check, not a display fallback; renders nothing when absent. Acceptable, and the comment correctly flags it as UI-only legacy. OK.
- Quantities use `toLocaleString` consistently (`:66,81,92,178,...`). `at_risk` via `fmtPrice` (`:92`) non-negative OK. Deltas shown `+{delta}` only when `> 0` else `"0"` (`:285`) — quantities, sign handling fine.
- HITL callout (`:243-247`) hardcodes policy prose: "24-hour timeout", "Sales Manager approval", "KNMT waiver". These are policy/threshold statements baked into the UI. Per CLAUDE.md, policy lives in the backend; hardcoding policy text risks drift from actual recipe policy. Flag.

**Usability Issues:**
- Round-up row has a class conflict: `text-text-primary line-through text-text-tertiary` (`:275`) — two text-color utilities on one element; the later wins, harmless but sloppy.

**Simplicity Opportunities:**
- The HITL callout duplicates policy that the backend enforces; consider replacing with backend-provided guidance.

**Top 3 Actionable Recommendations:**
1. Stop computing `roundedTotal`/`deltaTotal` via client-side `reduce`; render a backend-provided total (Guardrail #6 — no UI composition of audit numbers).
2. Replace hardcoded HITL policy prose (timeouts, approval tiers) with backend-sourced policy text to avoid drift.
3. Clean the conflicting text-color utilities on the ordered cell.

---

### OverMaxSection
**Context**
- Card: "Over Max Analysis". Goal: exceedance gap bars, block info, order lines, AI trim plan + totals, HITL callout. Audience: order-management operators.

**Overall Verdict:** Needs Rework

**Correctness Issues:**
- **Ad-hoc `"—"` partial-truth fallbacks — direct Guardrail #6 violation.** Order-lines table renders `line.max_line_qty != null ? ... : <span>—</span>` (`:166-170`) and the even-layer cell `line.is_even_layer_item ? ... : <span>—</span>` (`:179-183`). These are exactly the `data.field ?? "—"` partial-truth patterns the compliance rule forbids; they should use `EvidenceBlock` (structural omission or labelled placeholder). This is the clearest concrete violation in the slice for `max_line_qty`, which is an audit-relevant per-line limit. The even-layer `—` is lower-stakes but the same anti-pattern.
- **Client-side aggregation (Guardrail #6).** `trimmedTotal`/`deltaTotal` computed via UI `reduce` over `trim_plan` (`:28-29`) and shown as TOTAL (`:221,224`) — same composition-of-audit-numbers problem as MOQSection.
- Block-info fields (`block_status`, `block_reason`, `contract_ref`) correctly EvidenceBlock-wrapped (`:104-122`). Good — which makes the `—` usage in the lines table an inconsistency within the same file.
- Quantities `toLocaleString` consistent; `at_risk` via `fmtPrice` non-negative OK; trim deltas signed with `-` prefix where `> 0` (`:224,275`). Fine.
- HITL callout hardcodes policy: "$10,000", "VIP accounts", "Sales Manager review" (`:233-234`) — hardcoded threshold/policy text, same concern as MOQSection.

**Usability Issues:**
- "Excess: OK" rendering (`:176`) mixes a numeric concept with a status word in one column; mildly inconsistent but readable.

**Simplicity Opportunities:**
- HITL callout policy text should come from backend.

**Top 3 Actionable Recommendations:**
1. Replace the two `<span>—</span>` fallbacks (`max_line_qty`, `is_even_layer_item`) with `EvidenceBlock` — this is a direct partial-truth violation on an audit surface.
2. Remove client-side `reduce` totals; render backend-provided trim totals (Guardrail #6).
3. Replace hardcoded dollar/policy thresholds in the HITL callout with backend-sourced text.

---

### PalletConfigSection
**Context**
- Card: "Pallet Configuration Analysis". Goal: KPI strip, per-line pallet fill bars, AI suggested plan table. Audience: logistics/warehouse operators.

**Overall Verdict:** Pass

**Correctness Issues:**
- KPI tiles: `total_ordered_cases`/`loose_cases_total` rendered raw (audit-bearing), `extra_labor_est_hrs`/`freight_waste_pct` correctly EvidenceBlock-wrapped as contextual UI-only legacy fields (`:49-68`). No `—`. Good Guardrail #6 handling.
- `delta` formatting `:135`: `delta > 0 ? "+"+delta : delta === 0 ? "0" : delta.toString()` — signed correctly for negatives (toString keeps `-`). Quantities; OK.
- `pallet_fill_pct.toFixed(0)%` (`:207`) and fill-bar width `Math.min(pallet_fill_pct, 100)` (`:204`) — percent handled fine.
- Fill-bar color thresholds (`>=95/75/50`) and violation color are visual band logic on backend percentages (`:175-185`) — UI-side banding; lower stakes (visual), same minor concern as elsewhere.
- `violation_type` compared to literal string `"Broken Layer"` (`:183`) to choose color — a hardcoded string literal compared against a data field. This is a soft Guardrail #1/#6 concern (UI branching on a specific data value); other categories silently fall to the warning style. Flag.

**Usability Issues:**
- Suggested-plan `reason` is `truncate`d (`:139`) with no tooltip/title — operators lose the full reasoning for a suggested quantity change. For decision evidence, truncation without expand is a legibility gap.
- 7-column suggested-plan grid (`:106`) is dense; `description` is hidden below `sm` (`:123`). Needs visual verification on narrow panes.

**Simplicity Opportunities:**
- KPI strip is appropriately compact.

**Top 3 Actionable Recommendations:**
1. Add a `title`/tooltip (or expand) to the truncated `reason` so decision rationale isn't lost.
2. Avoid branching color on the literal `"Broken Layer"` string; drive violation severity from a backend severity field.
3. Verify the 7-column plan table on narrow detail panes.

---

### SapDataSection
**Context**
- Card: "SAP data". Goal: SAP system, validation status, order value, SAP doc number. Audience: operators verifying the SAP order of record. (preview-only producer.)

**Overall Verdict:** Pass

**Correctness Issues:**
- `order_value_usd` audit-bearing, EvidenceBlock-wrapped, formatted via `Intl` currency with `maximumFractionDigits: 0` (`:24-30, 52-56`) — clean whole-dollar order value. Good.
- `sap_doc_number` contextual via EvidenceBlock (`:61`). `system`/`validation_status` rendered raw as audit-bearing (`:46-47`). No `—`. Fully Guardrail #6 compliant — alongside EdiMismatch, the cleanest in the slice.

**Usability Issues:**
- `validation_status` rendered as plain text, not a status badge/icon (`:47`). Validation status is inherently a status indicator; per WCAG 1.4.1 and the project's status-indicator convention it would benefit from icon + text (and a semantic color), though as plain text it does not rely on color, so it is technically compliant. Minor enhancement.
- `order_value_usd` rounds to whole dollars (no cents) — appropriate for an order-value summary; verify operators don't need cents for reconciliation. Minor.

**Simplicity Opportunities:**
- Minimal and focused; nothing to remove.

**Top 3 Actionable Recommendations:**
1. Render `validation_status` as a status badge (icon + text + semantic color) to match the platform's status-indicator convention.
2. Confirm whole-dollar rounding of order value is acceptable for reconciliation use.
3. Otherwise exemplary; keep as an EvidenceBlock reference.

---

## Slice Summary

**Verdict counts:**
- Pass: 7 — PriceHoldSection, EdiMismatchSection, Edi850Section, DuplicateDetectionSection, OrderComparisonSection, PalletConfigSection, SapDataSection
- Needs Minor Tweaks: 5 — PriceAnalysisSection, ChangeAnalysisSection, BackOrderSection, DeliveryDelaySection, MOQSection
- Needs Rework: 1 — OverMaxSection

**Cross-cutting issues (highest priority — data-formatting & partial-truth):**

1. **Partial-truth `"—"` fallbacks bypassing EvidenceBlock.** `OverMaxSection.tsx:166-170` (`max_line_qty`) and `:179-183` (`is_even_layer_item`) render hardcoded `<span>—</span>` instead of `EvidenceBlock`. This is the explicit compliance anti-pattern (Guardrail #6) and the only hard violation in the slice; `max_line_qty` is an audit-relevant per-line limit. The rest of the slice handles absence correctly via EvidenceBlock — this file is the outlier.

2. **Client-side composition of audit numbers via `reduce`.** `MOQSection.tsx:29-30` and `OverMaxSection.tsx:28-29` compute TOTAL round-up/trim quantities and deltas in the UI by reducing over plan arrays, then display them as authoritative totals. Operators authorize off these totals; Guardrail #6 says the UI must not synthesize values — totals should be backend-provided. (Related but lower-stakes: UI-side severity-band thresholds in `PriceAnalysisSection:53-57`, `BackOrderSection:301-305`, `PalletConfigSection:175-185` re-derive severity client-side, which the "no UI threshold calculations" rule discourages.)

3. **Signed-money formatting bug from `fmtPrice`'s `Math.abs`.** `shared.tsx:218` strips the sign from currency. `BackOrderSection.tsx:162` renders `freight_delta_per_unit` such that a negative (freight saving) shows as a positive dollar amount with no minus sign (direction survives only via green color — a WCAG color-only reliance risk too). DeliveryDelay and ChangeAnalysis avoid this by using copy/`formatDelta`; BackOrder does not. Adopt a single signed-currency helper (like ChangeAnalysis's `formatDelta`) wherever a value can be negative, and verify other `fmtPrice` call sites only ever receive non-negative values.

Secondary recurring themes: hardcoded policy/threshold prose in HITL callouts (`MOQSection:243-247`, `OverMaxSection:233-234`); inconsistent confidence rendering (`ChangeAnalysisSection:144` bypasses `ConfidenceDisplay`); and several bare enum/status tokens rendered raw to operators (verify backend supplies prose).
