# UX Review 07 — Shared Chrome, Status Indicators, Banners, Badges & Per-Route Page States

**Reviewer:** QA / UX-UI Evaluator (gap-closure pass)
**Scope:** Reusable chrome/status/banner/badge components + bespoke per-route
error/loading states. Source-only review; no code changed.
**Audience for the surfaces under review:** O2C operators / analysts / managers
(domain experts, not developers).

Legend for verdicts: **Pass** / **Needs Minor Tweaks** / **Needs Rework**.
Runtime contrast/pixel claims are flagged "needs visual/manual verification".

---

## CaseViewBanner
**Context** — App chrome strip (under page header on `/inbox`, `/exceptions`) · Goal: make explicit that a legacy view is a filtered projection of `/cases` and offer navigation · Audience: operators landing on a legacy queue surface.
**Overall Verdict:** Pass

**Correctness Issues:**
- None functional. Minor semantic nit: the JSDoc and tokens call this an "info-blue strip" (`CaseViewBanner.tsx:11`, `:42`), but `--color-info` resolves to `#5A4BD6` (a violet/brand-purple) in light mode and `#8B7CF7` in dark (`design-tokens.css:141`, `:353`). The banner reads as purple, not blue. Cosmetic only — no fix required, but the comment is misleading for future maintainers.

**Usability Issues:**
- Two redundant routes to the same destination: the inline `/cases` link (`CaseViewBanner.tsx:52-57`) and the trailing "Open in /cases" link (`:61-66`) both go to `casesHref`. Not wrong, but duplicative; the trailing CTA is the stronger affordance, the inline link competes with it.
- Color-only-status concern does **not** apply — this is a `role="note"` informational banner, not a status indicator. The `LayoutList` icon (`:48`) plus full text copy satisfies non-color signalling regardless.
- `role="note"` with `aria-label="Case-view relationship"` (`:38-39`) is appropriate; it is correctly *not* an `aria-live` region (the relationship is permanent, not announced). Good.
- The inline `/cases` link text is itself the literal route string ("`/cases`"), which reads as developer jargon to an O2C operator. "the unified case list" would be friendlier; the literal slash-path leaks implementation vocabulary. **Needs visual/manual verification** with real operators, but flagging.

**Simplicity Opportunities:**
- Collapse the two links to one CTA, or make the inline mention plain (non-link) text and keep only the trailing "Open in /cases" actionable (`:52-66`).

**Top 3 Actionable Recommendations:**
1. Fix the "info-blue" comment (`:11`, `:42`) — the token is purple; either change copy or accept and document.
2. De-duplicate the two `/cases` links; keep the trailing CTA as the single affordance.
3. Reword operator-facing copy away from literal route strings ("`/cases`") toward plain language.

---

## PreprodIdentityBanner
**Context** — Environment/identity chrome strip (preprod only) · Goal: make the current Entra identity unmistakable because wrong-identity actions in preprod are SOX-relevant · Audience: operators on shadowed real-tenant preprod data.
**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- The double-cast on session email is fragile: `(session?.user as unknown as { email?: string } | undefined)?.email` (`PreprodIdentityBanner.tsx:54`). This is exactly the kind of `as` assertion CLAUDE.md's Definition of Done flags ("no type assertions without justification"). If `useAuth`/typed session exists, prefer it; otherwise add a one-line justification comment. Functionally works, but it's a typing smell on a SOX-relevant surface.
- Fallback chain `session?.user.email ?? (status === "loading" ? "Loading…" : "(no session)")` (`:53-55`) is a presentational fallback, not a Guardrail-#6 data-composition fallback, so it's allowed — but the `(no session)` branch silently renders a non-dismissable identity banner that says the environment is Entra yet shows no user. On a wrong-identity-is-SOX surface, "(no session)" should arguably be a louder, error-styled state, not the same muted warning strip.

**Usability Issues:**
- Color-only-status: this is the most important banner in the slice for "unmistakable." It currently uses `bg-warning/10` + `text-warning` `ShieldCheck` icon + the text "Preprod (Entra ID)" (`:64-77`). Text + icon present, so WCAG 1.4.1 holds. **However** the visual weight is *thin and muted* (10% warning tint, caption text) — for a banner whose entire purpose is "you cannot miss which identity you are," the treatment is under-emphasized. **Needs visual/manual verification**, but the design intent (unmistakable) and the chosen styling (subtle) are in tension.
- `ShieldCheck` (a reassuring "verified/safe" icon, `:71`) semantically conflicts with a *warning*-tinted banner whose job is caution ("you might be acting as the wrong identity"). A `ShieldAlert` or `ShieldQuestion` would better match the warning semantics.
- `aria-live="polite"` + `role="status"` (`:59-60`): correct for an identity readout that may resolve from "Loading…" to an email. Good. But because it is `aria-live`, when the email resolves the SR will re-announce the whole banner — acceptable, low frequency.
- The trailing `ASOE_AUTH_MODE=entra` text (`:78-80`) is raw env-var syntax surfaced to operators — developer leakage. An operator does not need the env-var name.

**Simplicity Opportunities:**
- Drop the `ASOE_AUTH_MODE=entra` debug string (`:78-80`) or move it behind a dev-only flag; it adds noise to an operator-facing banner.

**Top 3 Actionable Recommendations:**
1. Replace `ShieldCheck` with a caution icon (`ShieldAlert`) to match the warning intent (`:71`).
2. Elevate visual weight (stronger tint/border or a distinct error treatment for the `(no session)` branch) so the banner is genuinely "unmistakable" (`:53-55`, `:64-68`).
3. Remove or dev-gate the raw `ASOE_AUTH_MODE=entra` string and replace the `as unknown as` cast with a typed session accessor (`:54`, `:78-80`).

---

## ChromeBoundary
**Context** — Minimal authenticated chrome wrapper for App Router boundary files (loading/error/not-found) · Goal: keep NavBar present on boundary surfaces until the D5 layout refactor · Audience: operators who hit a slow/failed route.
**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- `NAV_TABS` is duplicated here (`ChromeBoundary.tsx:38-43`) with a comment claiming it is "Kept in sync with `src/config/nav-tabs.ts` (single source of truth)" — but it is a *hand-copied literal*, not an import. This is a drift hazard: the single-source-of-truth claim is unenforced. If `nav-tabs.ts` exports the list, import it; otherwise the comment is aspirational.
- `NAV_TABS` contains `inbox / cases / dashboard / settings` — there is **no `home` tab** — yet `home/error.tsx` and `home/loading.tsx` pass `activeTab="home"` (`home/error.tsx:14`, `home/loading.tsx:6`). The result: on `/home` boundary surfaces, no tab is highlighted (the `activeTab` matches nothing). Either `home` should be a tab, or `/home` boundaries should pass a sensible active tab. This is a real correctness gap in the chrome contract that CMT-3 is supposed to guarantee.

**Usability Issues:**
- Boundary chrome intentionally omits `userName`, `agentCount`, etc. (`:21-25` comment, `:58-62`). Reasonable for a transitional surface, but the missing **agent count** weakens the "agent-first / system status visible everywhere" guardrail (CLAUDE.md #4) precisely on a surface (error/loading) where an operator most wants reassurance the system is alive. Acceptable trade-off given the D5 note, but worth flagging.
- No skip-link / focus management on boundary mount; on an error boundary, moving focus to the `role="alert"` heading would help SR users. (Handled per-page, see below.)

**Simplicity Opportunities:**
- Import `NAV_TABS` from the config instead of re-declaring it (`:38-43`) — removes the drift surface entirely.

**Top 3 Actionable Recommendations:**
1. Resolve the `home` mismatch: either add a `home` entry (or sensible active hint) so `/home` boundaries highlight correctly (`:38-43` vs `home/*:6/14`).
2. Replace the hand-copied `NAV_TABS` literal with an import from `src/config/nav-tabs.ts` to honor the single-source-of-truth comment.
3. Consider surfacing agent count on boundary chrome to preserve the agent-first signal.

---

## HotkeyCheatsheet
**Context** — `?`-triggered modal overlay listing keyboard shortcuts (mounted on `/cases`) · Goal: surface otherwise-invisible hotkeys · Audience: power operators.
**Overall Verdict:** Pass

**Correctness Issues:**
- None found. `role="dialog"` + `aria-modal="true"` + `aria-label` (`:68-70`), focus on open (`:47-49`), focus restore on close via `useFocusRestoreOnClose` (`:55`), Escape + backdrop close (`:42-45`, `:62`) are all present and correct.

**Usability Issues:**
- Focus is moved to the panel container on open (`:48`) and the panel is `tabIndex={-1}` with a visible focus ring (`:71-72`) — good. The dialog is **not a focus trap**, however: Tab can move focus out of the overlay to background content behind the backdrop. For a true `aria-modal` dialog, focus should be trapped within. Minor for a read-only cheatsheet, but it is a real `aria-modal` contract gap.
- Backdrop is `bg-black/15` (`:63`) — quite light; combined with no focus trap, the modality is weakly signalled visually. **Needs visual/manual verification.**
- Color-only-status: N/A (not a status surface). Shortcut keys use `<kbd>` with text (`:104-106`) — accessible.
- The hint line uses `py-px` and `px-2` on the inline `<kbd>` (`:116`) which differs from the list `<kbd>` styling (`px-6 py-1`, `:104`) — minor inconsistency in the same component.

**Simplicity Opportunities:**
- Two slightly different `<kbd>` treatments (`:104` vs `:116`) could share one class constant.

**Top 3 Actionable Recommendations:**
1. Add a focus trap so Tab cycles within the dialog (honors `aria-modal="true"`, `:69`).
2. Unify the two `<kbd>` stylings into one shared class (`:104`, `:116`).
3. Consider a slightly stronger backdrop for clearer modality (needs visual verification, `:63`).

---

## StatusAnnouncer
**Context** — Single canonical app-wide `aria-live` region for SOX-relevant status transitions · Goal: announce status changes to SR users independent of Toast · Audience: screen-reader operators.
**Overall Verdict:** Pass

**Correctness Issues:**
- None. `role="status"` + `aria-live="polite"` + `aria-atomic="true"` + `sr-only` (`:102-118`) is the correct combination. The microtask debounce (`:70-80`) correctly collapses rapid announcements to avoid SR spam, and the unmount cleanup (`:84-89`) avoids committing onto a dead setter. The no-op default context (`:48-53`) lets components call `useStatusAnnouncer` without a provider — sensible.

**Usability Issues:**
- The visually-hidden styling is an **inline `style` object** (`:107-117`) rather than the `sr-only` Tailwind utility that the `className` already applies (`:106`). Both are present, so it's belt-and-suspenders; functionally fine, but the inline literals (`width: 1`, `margin: -1`, `clip: "rect(0,0,0,0)"`) duplicate what `sr-only` does. Not a token violation (these are the canonical sr-only values, not design tokens), but redundant.
- `aria-live="polite"` is correct for "Exception resolved"-class messages. Note: a genuinely *urgent* halt ("RED — execution blocked") would be `polite` here too and could be delayed behind an in-progress utterance. If any RED/blocked transition must interrupt, a separate `assertive` region would be needed. Flag for product, not a defect.

**Simplicity Opportunities:**
- Drop the inline `style` block and rely on the `sr-only` class alone (`:106` already applied), or vice-versa — keeping both is redundant (`:107-117`).

**Top 3 Actionable Recommendations:**
1. Remove the redundant inline sr-only `style` (the `sr-only` class is already applied) (`:106`, `:107-117`).
2. Confirm with product whether any RED/blocked transition needs an `assertive` companion region.
3. No further action — solid implementation.

---

## SlaBandAnnouncer
**Context** — `aria-live` announcer for SLA *band transitions* on the selected case · Goal: tell SR users when the SLA chip changes band (comfortable/at_risk/breached) without per-minute spam · Audience: screen-reader operators dwelling on a case.
**Overall Verdict:** Pass

**Correctness Issues:**
- None. Re-baselining on `caseId` change (`:79-81`), suppressing the initial announcement (`:76-82`), suppressing `none`-band transitions (`:54-55`), and announcing only true band changes (`:84-90`) are all correct and well-reasoned. `role="status"` + `aria-live="polite"` + `aria-atomic` + `sr-only` (`:94-99`) matches WCAG 4.1.3 intent cited in the header.

**Usability Issues:**
- The `labels` map (`:56-62`) is a hardcoded mapping of band → human string. SLA bands (`comfortable / at_risk / today / breached / none`) are a UI-presentational taxonomy from `@/types/cases` (`SlaBand`), not a backend enum sourced from `useHealth`, so this is **not** a Guardrail #2 violation — it's the sanctioned "visual mapping with a default" pattern, and the `SlaBand` union gives compile-time exhaustiveness. Noting it explicitly so it isn't mis-flagged.
- `aria-atomic="true"` on a message that always includes the case id (`:87`) means the SR re-reads "Case CASE-123: SLA at risk" in full each time — correct and desirable here.
- One edge: if `sla.band` and `caseId` change in the same render (operator switches to a case that is already at a different band), the effect re-baselines silently (`:79-81`) — correct, but means an operator who switches *into* an already-breached case hears nothing. That is the documented intent ("don't read out the SLA whenever the operator opens a new case"), so acceptable; the *visual* breached chip carries it.

**Simplicity Opportunities:**
- Minor: `bandTransitionLabel` returns `labels[next]` and ignores `prev` except for the guard (`:54-55`, `:63`). The `prev` param is only used for the `none` guard; could be simplified, but readability is fine as-is.

**Top 3 Actionable Recommendations:**
1. No correctness changes needed.
2. (Optional) confirm with UX that switching *into* an already-breached/at-risk case needs no SR announcement (current intentional silence).
3. Leave as-is; this is a model implementation of "announce the meaningful change, not the tick."

---

## ThemeToggle
**Context** — NavBar Light/Dark/System tri-state theme picker · Goal: let users pick theme, default system · Audience: all users.
**Overall Verdict:** Pass

**Correctness Issues:**
- None. Hydration handling via `mounted` (`:48-55`) avoids SSR mismatch; `currentTheme` falls back to "system" pre-mount (`:54`). Correct per next-themes.

**Usability Issues:**
- Accessible: trigger `aria-label` includes current theme post-mount (`:62-66`); options use `role="menuitemradio"` + `aria-checked` (`:88-89`); active item shows a `Check` (icon, `:94-99`) **and** is conveyed by `aria-checked` — so selection state is not color-only. Good.
- Trigger icon is purely decorative (`aria-hidden`, `:77`) with the state carried in the label — correct.
- Pre-mount the `aria-label` is just "Change theme" without current state (`:62-66`); acceptable since state is unknown server-side.
- Minor: the active-state `Check` is the only in-menu indicator of current selection; relies on the menu being opened to see it. The trigger icon (Sun/Moon, `:55`) reflects *resolved* theme, not the *selected* mode (e.g. "System" resolving to dark shows a Moon, not a Monitor). Slightly ambiguous but matches next-themes convention.

**Simplicity Opportunities:**
- None material.

**Top 3 Actionable Recommendations:**
1. No changes required; accessible and correct.
2. (Optional) consider reflecting selected *mode* vs resolved theme in the trigger for clarity.
3. n/a.

---

## Logo
**Context** — Brand mark (NavBar + auth/landing) · Goal: identify ASOE · Audience: all.
**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues:**
- **Hardcoded visual values (Guardrail #2 — design tokens only).** The size map uses raw pixel literals for both box dimensions and, critically, **font sizes**: `title: "text-[15px]"`, `"text-[20px]"`, `"text-[24px]"` (`Logo.tsx:10-12`). Font sizes must come from the `display/title/heading/subhead/body/caption/label` scale, not arbitrary `text-[Npx]` values. `w-[32px]`/`h-[40px]` box sizes are borderline (arbitrary px, though sizing not color/typography); the `text-[15px]` typography literals are the clear violation.
- This is the only component in the slice that breaks the tokens-only rule.

**Usability Issues:**
- No `aria-label`/`role` on the logo wrapper and the `Layers` icon is not marked `aria-hidden` (`:21-22`). The visible "ASOE" text (`:24-26`) gives an accessible name when the logo is read, but if the logo is wrapped in a link elsewhere (NavBar links it to `/home`), the decorative icon adds noise. Minor.
- `showTagline` renders "Agentic System of Engagement" at `text-body` (`:28-32`) — fine.

**Simplicity Opportunities:**
- Map the three title sizes onto existing tokens (e.g. `subhead`/`heading`/`title`) instead of `text-[Npx]` literals (`:10-12`).

**Top 3 Actionable Recommendations:**
1. Replace `text-[15px]/[20px]/[24px]` with scale tokens (`:10-12`) — Guardrail #2.
2. Mark the decorative `Layers` icon `aria-hidden` (`:22`).
3. (Optional) move box px dimensions to spacing/size tokens for consistency.

---

## GravitationalOrbs
**Context** — Decorative animated canvas background (auth/landing) · Goal: ambient brand visual · Audience: all (pre-auth).
**Overall Verdict:** Needs Rework

**Correctness Issues:**
- **Hardcoded color literals throughout (Guardrail #2).** The orb palette is raw RGB arrays — `[0, 122, 255]`, `[88, 86, 214]`, `[0, 199, 190]`, etc. (`GravitationalOrbs.tsx:51-53`) — and the background fill is a hex literal `"#F8FAFC"` (`:75`). The comment claims these "use ASOE brand/category palette," but they are *copied numeric values*, not `var(--color-brand)` references. If the brand tokens change, this diverges silently. Canvas can't read CSS vars directly, but the values should be read from `getComputedStyle` on the design tokens rather than inlined.
- The hardcoded `#F8FAFC` page background (`:75`) is the **light** `surface-page` only. In **dark mode** this canvas paints a light background behind the auth UI — a guaranteed dark-mode visual break. The component has no theme awareness at all.

**Usability Issues:**
- **No `prefers-reduced-motion` guard.** The `requestAnimationFrame` loop (`:70-276`) runs unconditionally — continuous orbital animation, particle trails, pulsing. This is a WCAG 2.3.3 (Animation from Interactions) / vestibular-safety concern; users with reduced-motion preference get a perpetually animating background with no opt-out. This is the headline defect.
- The canvas has no `aria-hidden` and no `role` (`:285-289`); as a decorative element it should be `aria-hidden="true"` so SR users don't encounter an empty interactive-looking canvas.
- `mousemove` parallax listener (`:40-47`) runs continuously; combined with the always-on rAF this is a battery/perf cost on a pre-auth screen.

**Simplicity Opportunities:**
- Read palette + background from computed design-token values once at mount instead of inlining RGB/hex (`:51-53`, `:75`).
- Early-return a static (or no) render when `matchMedia('(prefers-reduced-motion: reduce)')` matches.

**Top 3 Actionable Recommendations:**
1. Add a `prefers-reduced-motion: reduce` guard that disables the animation loop (and ideally renders a static frame) (`:70`, `:276`).
2. Make it theme-aware: read background + palette from design tokens / `resolvedTheme` so dark mode doesn't get a light `#F8FAFC` canvas (`:51-53`, `:75`).
3. Add `aria-hidden="true"` to the canvas (`:285-289`).

---

## VerdictDot
**Context** — Compact R/A/G audit-verdict indicator for 360px queue rows · Goal: scannable per-row audit verdict · Audience: operators scanning a case queue.
**Overall Verdict:** Pass

**Correctness Issues:**
- None. Color tokens bound to `--color-error/warning/success` (`:34-38`) — no literals. Guardrail #2 respected.

**Usability Issues:**
- **WCAG 1.4.1 satisfied:** the single letter R/A/G (`:67`) is the non-color carrier alongside the dot, and `role="img"` + `aria-label="Audit verdict: Red"` (`:53-54`) gives SR users the spoken form. Strong example.
- One subtlety: the letter *and* the dot share the same hue (`:60`, `:65`) — so the visible text relies on the color token having sufficient contrast against the row background. At `sm` the letter is `text-label` (10px) in warning yellow (`--color-warning: #E5C100`) on a light surface — amber-on-white small text is a classic contrast-failure risk. **Needs visual/manual verification** of the amber letter contrast specifically; the green/red are likely fine.
- Letter-only encoding (R/A/G) is an abbreviation an operator must learn; the `aria-label` spells it out for SR users but sighted users see only the initial. Acceptable in a dense queue, and tooltip/legend presumably elsewhere.

**Simplicity Opportunities:**
- None; the component is appropriately minimal.

**Top 3 Actionable Recommendations:**
1. Verify amber (`A`) letter contrast at `text-label` size against light *and* dark surfaces (`:60`, token `#E5C100`).
2. Ensure a legend/tooltip exists somewhere so R/A/G is learnable (out of this file's scope).
3. Otherwise no changes — exemplary 1.4.1 handling.

---

## PolicyHitBadge
**Context** — Distinguishes L1 rule-derived vs L2 LLM-derived compliance hits · Goal: let a reviewer tell, at a glance, which compliance concerns came from the AI second-opinion · Audience: compliance reviewers / operators.
**Overall Verdict:** Pass

**Correctness Issues:**
- None. Pure projector — slices the `LLM_SHADOW:` prefix and renders the string the backend stamped (`:42-45`); no composition (Guardrail #6 respected). Tokens only (`bg-brand/10`, `border-brand/20`, `:65-66`).

**Usability Issues:**
- **WCAG 1.4.1 satisfied:** LLM-derived hits get a text "AI" pill (`:77-78`) — the source is text-not-color, and the `aria-label="AI second-opinion concern: …"` (`:62`) carries it for SR. Good.
- Asymmetry worth noting: the **rule-based** branch (`:47-58`) has **no `aria-label` and no visible source marker** — it's just mono text. That's intentional (the absence of the AI pill = rule-based), but an SR user hearing the bare concern name has *no* cue that it's a deterministic rule hit vs an AI hit; they only get a positive signal for the AI case. For symmetry/clarity a rule-based hit could carry `aria-label="Policy rule: <name>"`. Minor.
- The `·` middot separator (`:80`) is decorative; it's inside the labelled span so SR may read it. Minor; consider `aria-hidden` on the separator.

**Simplicity Opportunities:**
- Add a symmetric `aria-label` to the rule-based branch so both paths announce their source (`:47-58`).

**Top 3 Actionable Recommendations:**
1. Give the rule-based branch an `aria-label` identifying it as a policy rule, for SR symmetry (`:47-58`).
2. Mark the `·` separator `aria-hidden` (`:80`).
3. Otherwise solid — keep the AI pill text-not-color treatment.

---

## ComplianceHitCountChip
**Context** — Persistent compliance-hit count chip for the slim case-header strip · Goal: ensure compliance presence is never invisible after the hits section moves to the audit rail · Audience: operators on a case detail.
**Overall Verdict:** Pass

**Correctness Issues:**
- None. Returns `null` at `count <= 0` (`:31`) — correct Guardrail #6 zero-state (absence is the zero state, no synthesised placeholder). Singular/plural handled (`:36`).
- Relies on `Badge` spreading `aria-label` via `{...props}` (`Badge.tsx:137`) — verified that Badge does spread `...props` onto the span, so the `aria-label` on `ComplianceHitCountChip` (`:36`) reaches the DOM. Correct.

**Usability Issues:**
- **WCAG 1.4.1 satisfied:** the chip shows a numeric count (`:39`) plus a `ShieldAlert` icon plus `warning` variant; the number is the non-color carrier and `aria-label="N compliance hits"` (`:36`) is the SR form. Good.
- The icon is `aria-hidden` (`:38`) and the count alone is announced via the chip's `aria-label` — but note the `aria-label` *replaces* the children for SR, so the bare `{count}` text node (`:39`) is not separately read. Correct, no double-announce.
- The chip is non-dismissible by design (no close button) — matches the ADR intent. Good.

**Simplicity Opportunities:**
- None; tightly scoped.

**Top 3 Actionable Recommendations:**
1. No changes required.
2. (Future) wire the deferred click-to-scroll-to-rail so the chip is also an affordance, not just a status (documented as Phase 2b).
3. n/a.

---

## Badge
**Context** — Base status pill primitive (tinted bg + colored text + default icon) used across queue/detail surfaces · Goal: render status with icon+text per WCAG 1.4.1 · Audience: all operator surfaces.
**Overall Verdict:** Pass

**Correctness Issues:**
- None. The `verdictVariant` / `lifecycleVariant` / `rootCauseVariant` / `categoryVariant` / `inboxStatusVariant` mappers (`:52-119`) each `switch` on a backend string with a `default` fallback — this is the **explicitly sanctioned** visual-mapping pattern (CLAUDE.md Guardrail #2 "Allowed"), not a hardcoded-enum violation, because adding a new backend enum value falls through to `neutral` and requires zero changes here. Correctly does not gate *behavior* on these strings.

**Usability Issues:**
- **WCAG 1.4.1 satisfied by construction:** every variant has a `DEFAULT_ICON` (`:122-129`) so a status is never color-only unless a caller explicitly passes `icon={null}`/empty. One gap: a caller can pass `icon={null}` and Badge would render `displayIcon = null` (`:132` — `icon !== undefined` is true for `null`), producing a color-only badge with text. Since the *text children* are still present, 1.4.1 (which forbids color as the *sole* means) is technically still met by the text label. So acceptable, but worth a comment that `icon={null}` is allowed only when meaningful text children exist.
- The icon sits *before* the text with `gap` (`:14`, `:27-28`); fine.
- Minor: `lifecycleVariant` maps several distinct states (`PENDING_REVIEW`, `ESCALATED`, `AUDITING`, …) all to `warning` (`:66-72`) — visually collapses meaningfully different lifecycle states into one color. The *text label* (passed as children by the caller) disambiguates, so not a 1.4.1 issue, but operators lose at-a-glance differentiation among warning-class states. By design / acceptable.

**Simplicity Opportunities:**
- None; the mapper-with-default pattern is clean and consistent across all five mappers.

**Top 3 Actionable Recommendations:**
1. No changes required — this is the reference status primitive.
2. (Optional) document that `icon={null}` is only valid alongside text children (`:132`).
3. (Optional) consider distinct icons (not just shared variant color) for high-stakes lifecycle states if at-a-glance differentiation is desired.

---

## Per-route error/loading states

These eight files are near-identical templates wrapping `ChromeBoundary`,
parameterised only by `activeTab` and the page-name copy. They are reviewed as
a group; per-file verdicts follow. **One systemic defect affects all four
`error.tsx` files.**

### Systemic findings (apply to all error/loading files)
1. **Undefined font-size token `text-h4` (Guardrail #2) — all four `error.tsx`.** Every error heading uses `text-h4` (`home/error.tsx:16`, `dashboard/error.tsx:16`, `inbox/error.tsx:16`, `settings/error.tsx:16`). The Tailwind fontSize scale defines only `display/title/heading/subhead/body/caption/label` (verified in `tailwind.config.ts:17-23`); there is **no `h4` key** and no `--font-size-h4` token (`design-tokens.css` has `subhead`, `caption`, `label`, etc.). `text-h4` therefore produces **no font-size class at all** — the heading falls back to the browser/inherited size. This is both a token violation and a real rendering bug. Should be `text-heading` (or `text-subhead`).
2. **Raw error text leaked to operators — all four `error.tsx`.** Each renders `{error?.message || "An unexpected error occurred."}` (`*/error.tsx:17-19`). Surfacing `error.message` verbatim to O2C operators can leak stack/internal/PII detail and is meaningless to a domain user. Prefer a friendly fixed message and surface `error.digest` (already typed in the props, `:10`) for support correlation instead of the raw message. The fallback string is good; the raw `error.message` path is the concern.
3. **Retry affordance is a text link, not a button-styled control — all four `error.tsx`.** `reset()` is wired to a `<button>` (good, it *is* a button element, `:20-27`) but styled as `text-brand hover:underline` (`:23`) — visually a link. For a primary recovery action this under-signals affordance; a button treatment would read as the obvious next step. Keyboard/SR are fine (`aria-label="Retry loading <page>"`, real `<button>`). Minor.
4. **Loading vs error distinction is clear** — loading files use `role="status"` + `aria-live="polite"` + "Loading <page>…" (`*/loading.tsx:7`), error files use `role="alert"` + heading + retry. The two states are unmistakably different and each is accessible. Good.
5. **No focus management on error mount** — none of the error boundaries move focus to the `role="alert"` region (`:15`). `role="alert"` will be announced by SR (live region), so this is acceptable, but moving focus to the retry button or heading would improve keyboard recovery. Minor.
6. **Loading state is text-only, no skeleton** — all loading files show a plain "Loading…" line (`*/loading.tsx:7`). Acceptable and accessible, but a skeleton matching each page's layout would reduce layout shift and feel faster. These are bespoke files but currently all identical except copy — the "bespoke per route" intent isn't really realised (no per-route skeletons). Enhancement, not a defect.
7. **`/home` activeTab mismatch (see ChromeBoundary)** — `home/error.tsx:14` and `home/loading.tsx:6` pass `activeTab="home"`, which matches no tab in `ChromeBoundary`'s `NAV_TABS`; the `/home` boundary chrome highlights nothing.

### home/error.tsx
**Overall Verdict:** Needs Minor Tweaks — `text-h4` undefined token (`:16`), raw `error.message` leak (`:17-19`), `activeTab="home"` matches no tab (`:14`).

### home/loading.tsx
**Overall Verdict:** Pass (with one nit) — accessible loading state; only issue is `activeTab="home"` matching no NavBar tab (`:6`).

### dashboard/error.tsx
**Overall Verdict:** Needs Minor Tweaks — `text-h4` (`:16`), raw `error.message` (`:17-19`).

### dashboard/loading.tsx
**Overall Verdict:** Pass — `role="status"` + `aria-live` correct (`:7`).

### inbox/error.tsx
**Overall Verdict:** Needs Minor Tweaks — `text-h4` (`:16`), raw `error.message` (`:17-19`).

### inbox/loading.tsx
**Overall Verdict:** Pass.

### settings/error.tsx
**Overall Verdict:** Needs Minor Tweaks — `text-h4` (`:16`), raw `error.message` (`:17-19`).

### settings/loading.tsx
**Overall Verdict:** Pass.

**Top 3 Actionable Recommendations (page states):**
1. Replace `text-h4` with a real scale token (`text-heading`) in all four `error.tsx` files — fixes both the token violation and the silent no-font-size bug.
2. Stop rendering raw `error.message`; show a friendly message + `error.digest` for support correlation.
3. Fix the `/home` `activeTab` mismatch (add a `home` tab or pass a valid active hint) and give the retry control a button affordance.

---

## Summary verdict counts (this slice)

Reusable components (13):
- **Pass (8):** CaseViewBanner, HotkeyCheatsheet, StatusAnnouncer, SlaBandAnnouncer, ThemeToggle, VerdictDot, PolicyHitBadge, ComplianceHitCountChip, Badge — *(9 listed; CaseViewBanner is a marginal Pass)*
- **Needs Minor Tweaks (3):** PreprodIdentityBanner, ChromeBoundary, Logo
- **Needs Rework (1):** GravitationalOrbs

Per-route page states (8):
- **Pass (4):** home/loading, dashboard/loading, inbox/loading, settings/loading
- **Needs Minor Tweaks (4):** home/error, dashboard/error, inbox/error, settings/error
- **Needs Rework (0)**

(Counting Badge in the Pass group, reusable Pass = 9.)
