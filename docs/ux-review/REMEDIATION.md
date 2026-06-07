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

| ☐ | Finding | Location | Fix | Expert / decision | PR |
|---|---------|----------|-----|-------------------|----|
| ☐ | `text-h4` undefined font-size | `cases/error.tsx:16`, `cases/not-found.tsx:14`, `home/dashboard/inbox/settings/error.tsx:16` | → `text-heading` | | |
| ☐ | `text-status-error` undefined color class | `ErasureCertificateButton.tsx:103`, `OrderEntrySection.tsx:39`, `DraftReplySection.tsx:135,176,214` | → `text-error` | | |
| ☐ | `pl-30` undefined spacing token | `EventsTimeline.tsx:250` | use a real scale step | | |
| ☐ | Hardcoded numeric `fontSize` / RGB-hex in SVG | `PipelineDAG.tsx`, `EventsTimeline.tsx`, `GravitationalOrbs.tsx` | tokens | | |
| ☐ | **Guard:** CI lint that fails on Tailwind classes not resolvable to a token | new `tests/architectural/*` | prevents recurrence | | |

## Batch 2 — T9 + Guardrail #2: enum→display maps
Maps keyed off backend enums must have a `default` fallback (icon+text) and must
not hardcode enum values.

| ☐ | Finding | Location | Fix | Expert / decision | PR |
|---|---------|----------|-----|-------------------|----|
| ☐ | Hardcoded intent enum keys (Guardrail #2) | `ActivityIndicator.tsx:20-41` | source from data, not literals | | |
| ☐ | Map missing `default` → blank on new enum | `EventsTimeline.tsx` `statusIndicator` | add default fallback | | |
| ☐ | Classifier maps missing default | `ClassificationHistoryPanel.tsx` | add default fallback | | |
| ☐ | "skipped" state icon-only (no text) | `WaterfallStepper.tsx` | icon + text | | |
| ☐ | `verdict === "GREEN" ? …` color switch | `dashboard/page.tsx:251-255` | use `verdictVariant()` | | |

## Batch 3 — T5: accessibility
| ☐ | Finding | Location | Fix | Expert / decision | PR |
|---|---------|----------|-----|-------------------|----|
| ☐ | No `aria-live` (named in CLAUDE.md) | `ActivityIndicator.tsx:58-63` | `aria-live="polite"` | | |
| ☐ | No `aria-busy`; loses accessible name while loading | `Button.tsx:64-68` | `aria-busy` + retain label | | |
| ☐ | No `aria-busy` on async action | `AttachmentDownloadButton.tsx:62-66`, `ErasureCertificateButton.tsx:93-97` | `aria-busy` | | |
| ☐ | Swallows download failures (no `catch`) | `AttachmentDownloadButton.tsx:49-52` | catch + user feedback | | |
| ☐ | Errors announced politely, should be assertive | `Toast.tsx:47-48` | assertive for errors | | |
| ☐ | Contradictory `role="alert"`+`aria-live="polite"` | `ErasureCertificateButton.tsx:102-105` | one consistent rule | | |
| ☐ | `outline:none` on focusable SVG, no replacement | `PipelineDAG.tsx:285` | visible focus ring | | |
| ☐ | Stray `tabIndex={0}` on static text | `ConfidenceDisplay.tsx:156` | remove | | |
| ☐ | Broken skip-link target (empty div, no `<main>`) | `home/page.tsx:191` | real `<main id>` | | |
| ☐ | Sub-44px icon-only hit targets | `Sidebar.tsx`, `NavBar.tsx` | enlarge targets | | |

## Batch 4 — T3: signed-money (fix once at the source)
| ☐ | Finding | Location | Fix | Expert / decision | PR |
|---|---------|----------|-----|-------------------|----|
| ☐ | `fmtPrice` `Math.abs` strips sign | `shared.tsx:218` | signed formatter; never sign-by-color | | |
| ☐ | Verify consumers render sign | `HeaderRibbon.tsx:99-103`, `ContextStrip.tsx:80`, `BackOrderSection.tsx:162`, `PricingWaterfall.tsx:40-42,104-109` | adopt signed helper | | |

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

## Scorecard sync
As items move to ☑, update the verdict in the matching `0X-*.md` report and the
totals in [`README.md`](./README.md#scorecard). Audit start: **42 Pass / 44
Minor / 11 Rework** across 97 components.
