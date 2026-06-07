# ASOE UI — UX/UI Remediation Tracker

Living checklist for fixing the findings in [`README.md`](./README.md) and
reports `01`–`08`. **The remediation session updates this file as it works** —
tick items, set status, and record the expert decision + PR for each.

- **Status legend:** ☐ Todo · ◐ In progress · ☑ Done · ⊘ Deferred (with reason)
- **Rule:** every fix traces to a finding (with `file:line`) and ships with a
  regression test that fails on the parent commit (CLAUDE.md test strategy).
- **Authority:** no production env (local/preview/pre-prod only); compliance
  **sign-off** is waived for this work. Engineering gates (build, tests,
  Guardrail #2/#6, a11y) still apply.
- **Ambiguity:** resolve via an expert subagent; record the decision in the
  "Expert / decision" column, not by pausing for the owner.

---

## Batch 1 — T8: undefined tokens & typo'd CSS classes (safe, mechanical)
Classes that name a non-existent token render unstyled at runtime.

| ☑ | Finding | Location | Fix | Expert / decision | PR |
|---|---------|----------|-----|-------------------|----|
| ☑ | `text-h4` undefined font-size | `cases/error.tsx:16`, `cases/not-found.tsx:14`, `home/dashboard/inbox/settings/error.tsx:16` | → `text-heading` | Mechanical token-map; no expert needed | #222 |
| ☑ | `text-status-error` undefined color class | `ErasureCertificateButton.tsx:103`, `OrderEntrySection.tsx:39,41`, `DraftReplySection.tsx:135,176,214` | → `text-error` (+ `text-status-warning`→`text-warning` found alongside) | Mechanical token-map | #222 |
| ☑ | `pl-30` undefined spacing token | `EventsTimeline.tsx:250` | → `pl-32` (nearest scale step) | Mechanical token-map | #222 |
| ☑ | Hardcoded numeric `fontSize` / RGB-hex in SVG | `PipelineDAG.tsx` (3 `fontSize`) | → `style={{fontSize:"var(--font-size-label/caption)"}}` | EventsTimeline had none; GravitationalOrbs colour/motion deferred to **Batch 5** (full rework) to avoid double-touch | #222 |
| ☑ | **Guard:** CI lint that fails on Tailwind classes not resolvable to a token | `tests/architectural/token_class_resolution.test.ts` | spacing steps derived from `--space-*`; font-alias + `-status-` namespace denylists. Caught 4 latent extras (`gap-14`,`px-14`,`py-14`,`text-h2`) → fixed | Guard scans raw text (catches cn()/cva()) | #222 |

## Batch 2 — T9 + Guardrail #2: enum→display maps
Maps keyed off backend enums must have a `default` fallback (icon+text) and must
not hardcode enum values.

| ☑ | Finding | Location | Fix | Expert / decision | PR |
|---|---------|----------|-----|-------------------|----|
| ☑ | Hardcoded intent enum keys (Guardrail #2) | `ActivityIndicator.tsx:20-41` | Templated copy: intent-specialised nodes inject `intentLabelFor(intent)`; neutral copy when no intent. New intent → zero UI change | Reconciles Guardrail #2 (no literals) + #4 (domain-aware) — no conflict, no expert needed | #222 |
| ☑ | Map missing `default` → blank on new enum | `EventsTimeline.tsx` `statusIndicator` | added `default` → neutral `Circle` indicator | Mirrors `verdictVariant` default | #222 |
| ☑ | Classifier maps missing default | `ClassificationHistoryPanel.tsx` | `classifierIcon/Variant()` fallbacks (neutral + `CircleHelp`); **also fixed latent double-icon** by routing through Badge `icon` prop | Found Badge auto-adds `DEFAULT_ICONS` → every badge had 2 icons; `icon` prop is the intended API | #222 |
| ☑ | "skipped" state icon-only (no text) | `WaterfallStepper.tsx` | added visible "Skipped" text cue (WCAG 1.4.1) | | #222 |
| ☑ | `verdict === "GREEN" ? …` color switch | `dashboard/page.tsx:251-255` | new `variantColorVar(verdictVariant(verdict))` in `Badge.tsx`; removed enum literals | Colour-mapper colocated with other variant mappers (allowed location) | #222 |

## Batch 3 — T5: accessibility
| ☑ | Finding | Location | Fix | Expert / decision | PR |
|---|---------|----------|-----|-------------------|----|
| ☑ | No `aria-live` (named in CLAUDE.md) | `ActivityIndicator.tsx:58-63` | `role="status"` + `aria-live="polite"`; dot `aria-hidden` | | #222 |
| ☑ | No `aria-busy`; loses accessible name while loading | `Button.tsx:64-68` | `aria-busy` + **retain label** (spinner alongside children; guarded for `asChild`/Slot single-child) | Updated the test that asserted the bug (children-hidden) | #222 |
| ☑ | No `aria-busy` on async action | `AttachmentDownloadButton`, `ErasureCertificateButton` | `aria-busy={busy||undefined}` | | #222 |
| ☑ | Swallows download failures (no `catch`) | `AttachmentDownloadButton.tsx:49-52` | added `catch` → `role="alert"` error surfaced | | #222 |
| ☑ | Errors announced politely, should be assertive | `Toast.tsx:47-48` | error/warning → `role="alert"`+`assertive`; success/info → `status`+`polite` | | #222 |
| ☑ | Contradictory `role="alert"`+`aria-live="polite"` | `ErasureCertificateButton.tsx:102-105` | keep `role="alert"` only (implies assertive); same rule applied to the new Attachment error | One consistent rule: role=alert, no aria-live | #222 |
| ☑ | `outline:none` on focusable SVG, no replacement | `PipelineDAG.tsx:285` | removed inline `outline:none` → global `:focus-visible` ring (globals.css) shows | Reuse global ring, not a bespoke one | #222 |
| ☑ | Stray `tabIndex={0}` on static text | `ConfidenceDisplay.tsx:156` | removed | | #222 |
| ☑ | Broken skip-link target (empty div, no `<main>`) | `home/page.tsx:191` | real `<main id="main-content">` wrapping both content blocks | | #222 |
| ☑ | Sub-44px icon-only hit targets | `Sidebar.tsx`, `NavBar.tsx` | `min-w/h-[44px]` (WCAG 2.5.5); NavBar keeps 32px visual avatar inside a 44px hit box + focus ring | 44px (AAA 2.5.5) over 24px floor (AA 2.5.8) since audit asked | #222 |

## Batch 4 — T3: signed-money (fix once at the source)
| ☑ | Finding | Location | Fix | Expert / decision | PR |
|---|---------|----------|-----|-------------------|----|
| ☑ | `fmtPrice` `Math.abs` strips sign | `shared.tsx:218` | **kept** `fmtPrice` as magnitude-only (defensive; 18 sites stay ≥0); added canonical `fmtSignedPrice` (+/-) and `fmtMoney` (sign, no +) in `@/lib/format` | **Expert subagent** (frontend-arch + compliance): don't blanket-remove `Math.abs` (regresses 18 magnitude sites); add signed helpers, switch only the 6 delta sites | #222 |
| ☑ | Verify consumers render sign | `HeaderRibbon:101`, `ContextStrip:80`, `BackOrderSection:162`, `PricingWaterfall` | adopted `fmtSignedPrice` (deltas) / `fmtMoney` (BASE/RESULT magnitudes incl. negative RESULT); removed manual `+`/`Math.abs`; colour reinforces a textual sign | PriceAnalysis `variance_amount` left as magnitude (type doc says "Absolute"; direction is in the sentence) — out of scope. PricingWaterfall also got the `step.record` empty-chip guard → flips Rework→Pass | #222 |

## Batch 5 — remaining "Needs Rework" items (each its own regression test)
| ☐ | Item | Location | Notes | Expert / decision | PR |
|---|------|----------|-------|-------------------|----|
| ☐ | GapBar shortfall branch unreachable | `GapBar.tsx:47-48` | both branches need `primary > secondary` | | |
| ☐ | OverMax partial-truth + UI totals (Guardrail #6) | `OverMaxSection.tsx:28-29,166-183` | EvidenceBlock + backend totals | | |
| ☐ | GravitationalOrbs motion/tokens/dark-mode/aria | `GravitationalOrbs.tsx` | `prefers-reduced-motion`, tokens, `aria-hidden` | | |
| ☐ | ChromeBoundary missing `home` tab | `ChromeBoundary.tsx` (`NAV_TABS`) | `/home` highlights nothing | | |
| ☐ | Dashboard fabricated `RECENT_ACTIVITY` + no fetch-error state | `dashboard/page.tsx:40-47,72-74` | **see scaffolding note** | | |
| ☐ | Login: hardcoded SSO list, "any password", fake counts | `login/page.tsx:27,46-48,272-280` | **see scaffolding note** | | |
| ☐ | Auth callback fixed `jane@acme.com` identity | `auth/callback/page.tsx:21-27` | **see scaffolding note** | | |
| ☐ | Cases `[id]` dead 404 path + `agentCount={3}` + missing kbd nav | `cases/[id]/page.tsx:40,94,110` | parity w/ workspace | | |
| ☐ | `error.tsx` leaks raw `error.message` | all four route `error.tsx:17-19` | use `error.digest` | | |

## Batch 6 — Minor sweep (opportunistic, low-risk)
Pick up remaining "Needs Minor Tweaks" items per slice (see reports `01`–`08`)
where the fix is isolated. Skip anything that grows beyond a small diff and log
it here as ⊘ Deferred with a reason.

---

## ⚠️ Scaffolding judgment calls
Items marked **see scaffolding note** (demo auth identity, dashboard mock
activity, "enter any password" copy) may be **deliberate preview/pre-prod
scaffolding** because there is no real backend/prod. For each, an expert
subagent decides:
- **(a) Fix properly**, or
- **(b) Keep but gate behind an explicit preview/pre-prod flag and label it
  non-live in the UI.**

Do **not** silently remove scaffolding the preview build depends on. Record the
choice in the table's "Expert / decision" column and the PR body.

## Decision log
_(Append expert decisions here as they're made: date · item · expert · outcome · rationale.)_

- **2026-06-07 · Batch 1 (T8) · self (mechanical)** — Undefined token classes
  are pure token-mapping with no design ambiguity, so no expert subagent was
  spawned. Mapping rules: `text-h4`→`text-heading`, `text-h2`→`text-title`,
  `text-status-{error,warning}`→`text-{error,warning}`, off-scale spacing
  (`pl-30`,`*-14`) → nearest valid `--space-*` step, SVG numeric `fontSize` →
  `var(--font-size-*)`. GravitationalOrbs colour/motion/dark-mode left to Batch 5
  (it needs a full rework, not a one-line token swap — touching it twice would
  churn the diff). The new guard derives its valid spacing scale from
  `design-tokens.css`, so it stays in sync if the scale changes.

- **2026-06-07 · Batch 2 (T9/Guardrail #2) · self (frontend-arch)** —
  `ActivityIndicator` posed a real Guardrail #2 (no hardcoded enum literals) vs
  Guardrail #4 (domain-aware messages) tension. Resolution: **templated copy** —
  intent-specialised nodes hold a function of the humanised intent label
  (`intentLabelFor`), so messages name the specific intent WITHOUT branching on
  literals. Both guardrails satisfied, so no conflict / no escalation. While
  fixing `ClassificationHistoryPanel`'s missing fallback I found a latent bug:
  `Badge` always renders `DEFAULT_ICONS[variant]`, and the panel ALSO passed its
  icon as children → every classifier badge rendered two icons. Fixed properly
  by routing the (fallback-aware) icon through Badge's `icon` prop — the API the
  other six callers already use. No backend (`asoe2`) change: all display-mapping
  is UI-side; backend enum contracts unchanged.

- **2026-06-07 · Batch 3 (T5 a11y) · self (accessibility/WCAG)** — Two judgment
  calls. (1) Button "retain label while loading": the spinner used to *replace*
  children, losing the accessible name (WCAG 4.1.2). Fix renders the spinner
  alongside children + `aria-busy`; guarded with `!asChild` because Radix `Slot`
  requires a single child. The existing test asserted the buggy behaviour
  (children hidden) and was corrected to the new contract. (2) Hit targets:
  WCAG 2.5.8 (AA) only needs 24px and the 32px controls already passed, but the
  audit explicitly flagged sub-44px, so I took the stronger 2.5.5 (AAA) 44px
  target, preserving the 32px visual avatar inside a 44px hit box. Erasure/
  Attachment error rule unified on `role="alert"` (implies assertive) with no
  `aria-live` (the prior pairing was contradictory). asoe2 backend untouched.

- **2026-06-07 · Batch 4 (T3 signed money) · expert subagent (frontend-arch +
  compliance)** — A SOX-relevant change across 24 `fmtPrice` call sites. The
  subagent inventoried every site, classified 18 as MAGNITUDE (always ≥0, abs is
  harmless/defensive) and 6 as SIGNED DELTA (the bug), and checked the TS sign
  conventions. Recommendation followed: do **not** strip `Math.abs` from
  `fmtPrice` (would regress the 18 magnitude sites); instead add canonical
  `fmtSignedPrice`/`fmtMoney` (`@/lib/format`, `Intl` `signDisplay`) and switch
  only the delta sites, keeping colour as reinforcement of a now-textual sign.
  PricingWaterfall's own `Math.abs` helper was removed and BASE/RESULT use
  `fmtMoney` so a negative RESULT keeps its minus. `asoe2` untouched (no contract
  change — the fields already carry the sign; the UI was hiding it).

## Review checkpoints
- **After Batch 2 (3 commits)** — ran `/code-review` (high) over `1fc6faa..HEAD`,
  typecheck, full vitest (1788 pass), and `npm run build`. No correctness
  findings. Verified dashboard verdict-colour parity (GREEN/YELLOW/RED unchanged;
  only unknown verdicts shift red→neutral, which is correct), single-icon badge
  parity, and no import cycle from `erp-label-map`. asoe2 backend untouched
  (display-mapping only) → local/preview/pre-prod parity intact.

## Scorecard sync
As items move to ☑, update the verdict in the matching `0X-*.md` report and the
totals in [`README.md`](./README.md#scorecard). Audit start: **42 Pass / 44
Minor / 11 Rework** across 97 components.
