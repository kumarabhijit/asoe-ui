# UX, Accessibility & Screen-clutter test strategy

Sister doc to `README.md`. Covers the test patterns that lock UX
quality (information density, motion, keyboard reachability,
screen-reader plumbing) and WCAG AA accessibility. Every
contributor adding a new page or a new top-level component reads
this once.

## Why this exists

The pyramid in `README.md` is bug-driven — every row was added to
close a specific regression class. The UX/A11y class is harder to
provoke with a single bug fix: regressions surface as "this screen
feels off", "I can't tab to the action", "the badge is unreadable
in dark mode" — and they accumulate quietly across PRs because no
test asserts the invariant. The Vercel preview is the de-facto
review, which means whichever reviewer happens to use a keyboard or
a screen-reader catches things, the rest is invisible.

This doc codifies the minimum permanent coverage so those bug
classes are loud in CI.

## What it covers — and what it deliberately does not

Covers:

* Component-level WCAG AA via `vitest-axe` on every top-level
  interactive component.
* Source-level invariants ("clutter"): z-index discipline, skip-link
  presence, status-announcer mount, ribbon CTA budget.
* Token-level color contrast on `design-tokens.css`.
* Focus management on overlay surfaces (Sidebar, Dialog).
* Route-level WCAG AA via `@axe-core/playwright` on every
  `AUTHENTICATED_ROUTES` entry.
* Three-viewport horizontal-overflow smoke.
* `prefers-reduced-motion` respect on the Sidebar transition.
* Keyboard-only operator journey from login → detail → action with
  status-announcer assertion.

Deliberately not covered (with rationale):

* **Pixel-diff visual regression.** `README.md` Gap 5 owns this and
  flags it as a deferred deliberate gap (lower leverage, threshold
  tuning is expensive). Not duplicated here.
* **Screen-reader output snapshotting.** Axe asserts the
  *attributes* that drive screen-reader behaviour; asserting the
  rendered NVDA/VoiceOver phrasing is brittle across SR versions.
  We instead assert `aria-live` regions update (`status-announcer`
  testid) which is the contract the SR consumes.
* **Mobile breakpoints.** The product is a desktop control tower;
  Maya (UX) explicitly scoped this PR to desktop viewports
  1280/1440/1920.

## The pattern per gap

### Gap A — axe coverage is uneven across components

**Symptom:** Only Badge/Button/Input/Sidebar/MetricTile and two
section components have axe sweeps. New components ship with no
a11y verification.

**Pattern:** A single `tests/accessibility/component_sweep.test.tsx`
that imports every top-level interactive component and runs
`axe(container)` against its canonical render states. New
components are added to this file as a Definition-of-Done step
(see CLAUDE.md update below).

```ts
const cases = [
  { name: "AgentReasoningCard / YELLOW analyst",
    render: () => <AgentReasoningCard verdict="YELLOW" canApprove ... /> },
  { name: "Toast / error",
    render: () => <Toast variant="error" ... /> },
  // ...
];
for (const c of cases) it(c.name, async () => {
  const { container } = render(c.render());
  expect(await axe(container)).toHaveNoViolations();
});
```

Reference: `tests/accessibility/component_sweep.test.tsx`.

### Gap B — no focus-management invariants

**Symptom:** Sidebar/Dialog open/close paths regress focus return,
focus trap, and ESC handling. Today only `role="dialog"` +
`aria-modal` are asserted (in `status_components.test.tsx`); the
behaviour around them isn't.

**Pattern:** `tests/accessibility/keyboard_focus.test.tsx`. RTL +
`@testing-library/user-event`. For Sidebar:

* Mount with `open={false}`, focus a sentinel `<button>`.
* Re-render `open={true}` — assert panel receives focus.
* `userEvent.keyboard("{Escape}")` — assert `onClose` fires.
* Tab through children — never escapes the panel while open.
* Re-render `open={false}` — assert focus returns to the sentinel
  (or to `document.body`, whichever matches the contract).

Same shape for Dialog. Skip-link verified by mounting the root
layout in isolation and tabbing once from `document.body`.

### Gap C — design-token contrast can drift below WCAG AA

**Symptom:** A brand colour tweak or a status-subtle palette change
silently drops the contrast ratio below 4.5:1. Caught only when a
user complains.

**Pattern:** `tests/accessibility/design_tokens_contrast.test.ts`.
Pure-TS: parse `src/styles/design-tokens.css` with a regex, build a
map of token → hex, compute WCAG 2.1 contrast for the pairs that
ship in production:

| Foreground token | Background token | Min ratio | Use |
|---|---|---|---|
| `--color-text-primary` | `--color-bg-primary` | 4.5 | Body text |
| `--color-text-secondary` | `--color-bg-primary` | 4.5 | Subhead |
| `--color-text-tertiary` | `--color-bg-primary` | 3.0 | UI labels |
| `--color-brand` | `--color-bg-primary` | 3.0 | Brand on white (UI) |
| `--color-error` | `--color-error-subtle` | 4.5 | Error badges |
| `--color-success` | `--color-success-subtle` | 4.5 | Success badges |
| `--color-warning` | `--color-warning-subtle` | 4.5 | Warning badges |

The same pairs are also asserted against the dark-mode override
block (`[data-theme="dark"]` selector).

No external deps. The WCAG formula and the small regex parser live
in the test file.

### Gap D — "screen clutter" is enforceable as source invariants

**Symptom:** Designs degrade by accretion — a fifth badge added to
a row, a raw `z-index: 9999`, a new CTA next to two existing CTAs.
None of these break tests but each one chips at scanability.

**Pattern:** `tests/architectural/ux_clutter_invariants.test.ts`.
Source-grep at L0 (cheap, deterministic):

1. **Z-index discipline.** No `.tsx` or `.css` outside
   `design-tokens.css` contains a literal `z-index: <number>`.
   Allowed: `z-[var(--z-modal)]`, `style={{ zIndex: "var(--z-modal)" }}`,
   `className="z-modal"` (the Tailwind shortcut for the named token).
2. **Skip-link is wired.** `src/app/layout.tsx` contains
   `<a href="#main-content" class="skip-to-main">`.
3. **Every authenticated page has a landmark.** For each
   `AUTHENTICATED_ROUTES` entry, the source file contains
   `<main id="main-content"` or
   `<section id="main-content"` in a non-comment region.
4. **StatusAnnouncer is mounted at the providers root.**
   `src/app/providers.tsx` references `<StatusAnnouncer`.
5. **Ribbon CTA budget.** `HeaderRibbon.tsx` exports a constant
   `MAX_PRIMARY_ACTIONS` (currently 3) and the test asserts the
   constant matches the design system rule (≤ 3). Catches a
   regression where someone adds a fourth primary button.

Reference for the pattern: `tests/architectural/cases_workspace_render_guard.test.ts`.

### Gap E — no route-level axe sweep

**Symptom:** Component-level axe passes (Gap A) but the page-level
composition violates heading order, landmark uniqueness, or
duplicate IDs once the components are wired together.

**Pattern:** `tests/browser/a11y-route-sweep.spec.ts`. Playwright
+ `@axe-core/playwright`. For each `AUTHENTICATED_ROUTES` entry,
login → goto → `new AxeBuilder({ page }).analyze()` →
filter `serious | critical` → assert empty. `moderate` and `minor`
remain informational until the page-level cleanup catches up (an
allowlist field in the test is reserved for known-debt items).

We bias to `serious | critical` initially so the gate is
non-flaky from day one; promoting `moderate` to gating is a
follow-on once the existing inventory is at zero.

### Gap F — viewport overflow and motion preference

**Symptom:** A new component widens a row past 1280px, producing
horizontal body scroll — invisible to anyone on a 27" monitor.
Or a new animation ignores `prefers-reduced-motion`.

**Pattern:** `tests/browser/viewport-and-motion.spec.ts`.

* Viewport overflow: for each route in
  `AUTHENTICATED_ROUTES`, set viewport to 1280×800 / 1440×900 /
  1920×1080, navigate, assert `document.documentElement.scrollWidth
  <= document.documentElement.clientWidth + 1` (the +1 absorbs
  sub-pixel rounding).
* Reduced motion: open browser context with
  `reducedMotion: "reduce"`, open the Sidebar, assert the panel
  transition duration drops to the reduced-motion branch
  (`design-tokens.css` exposes
  `--duration-fast` / `--duration-normal` and a
  `@media (prefers-reduced-motion: reduce)` block sets them to
  `0ms` — the test reads `getComputedStyle` on the panel).

### Gap G — screen-reader announcement regression on actions

**Symptom:** Disposition actions (Approve / Override / Escalate)
must announce via the `aria-live` `StatusAnnouncer`. Today the
component is mounted but no test asserts the wiring from action
button → announcement.

**Pattern:** `tests/browser/keyboard-only-journey.spec.ts`.
Single spec that logs in, navigates to /cases via Tab+Enter only,
selects a record, triggers an action, asserts the
`[data-testid="status-announcer"]` text changes within 2s of the
action. Mouse never moves; every input is a keyboard event. This
single test bundles two invariants (keyboard reachability +
announcement) which is the cheapest way to lock both without
adding a flaky two-spec coupling.

## Reference impls

| Pattern | Reference |
|---|---|
| Component axe sweep | `tests/accessibility/component_sweep.test.tsx` |
| Focus management | `tests/accessibility/keyboard_focus.test.tsx` |
| Design-token contrast | `tests/accessibility/design_tokens_contrast.test.ts` |
| Source-level UX clutter | `tests/architectural/ux_clutter_invariants.test.ts` |
| Route-level axe | `tests/browser/a11y-route-sweep.spec.ts` |
| Viewport + motion | `tests/browser/viewport-and-motion.spec.ts` |
| Keyboard-only journey | `tests/browser/keyboard-only-journey.spec.ts` |

## CI wiring

No new workflow. The specs land in existing path-filtered jobs:

* `tests/accessibility/**` and `tests/architectural/**` are picked
  up by `.github/workflows/vitest.yml` (mock-mode gate).
* `tests/browser/**` is picked up by
  `.github/workflows/browser-e2e.yml`.

The Playwright specs add `@axe-core/playwright` to
`devDependencies`. No browser binary change is needed — axe runs
in-page via injected JS.

## Definition-of-Done update

CLAUDE.md "Definition of Done" gains one line:

> * When adding a new top-level interactive component under
>   `src/components/ui/` or a new page under `src/app/`, add a
>   case to `tests/accessibility/component_sweep.test.tsx` (for
>   components) or to `AUTHENTICATED_ROUTES` (for pages). The
>   route axe sweep then exercises it automatically.

## Known shortfalls (recorded explicitly)

Tracked exceptions to the gating thresholds, kept here so a
future contributor sees the rationale rather than discovering the
failure mode by accident. Each entry is marked `it.todo` in the
corresponding test so the test surfaces the gap without flipping
the build red.

* **Dark-mode brand button: white on `--color-brand`
  (#8B7CF7) → 3.32:1**, below the 4.5:1 AA small-text floor.
  Above the 3:1 AA-large-text floor, so it functions on
  large/bold button labels. The brand-on-dark-bg legibility
  constraint (brand text on `--color-surface-page` must stay
  ≥ 3:1) prevents simply darkening brand. Follow-on:
  token-darkening pass that finds a hue with L ≤ 0.18 (white
  contrast ≥ 4.5:1) while keeping L ≥ 0.15 (brand-on-dark-bg
  contrast ≥ 3:1). Tracked in
  `tests/accessibility/design_tokens_contrast.test.ts` ::
  `KNOWN_SHORTFALL`.

## Roadmap (not in this PR)

* **Visual regression baselines** — `README.md` Gap 5; deferred.
* **`moderate` axe rules gating** — once the current page-level
  inventory at `serious|critical` is zero across two consecutive
  releases, promote.
* **Mobile viewport sweep** — out of scope while the product is
  desktop-only.
* **Screen-reader output snapshots** — brittle; revisit if axe
  proves insufficient.
