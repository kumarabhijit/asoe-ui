# V&V Audit Report — asoe-ui (frontend)

**Date:** 2026-06-06
**Scope:** Contract drift and UI-fidelity gaps in the order-analysis
evidence payload (backend OpenAPI → `src/types/generated.ts` →
`src/types/exceptions.ts` → `src/lib/api.ts` mock layer → section
components).
**Method:** Static cross-reference of the hand-written `*AnalysisData`
types against the OpenAPI-generated truth and the backend Pydantic
schemas, plus structural inspection of the section renderers. Existing
tests were treated as non-authoritative; the fixed defect is locked with a
regression test that throws on the parent commit.

Guardrail discipline (CLAUDE.md §3, §6, §7): the UI type was **aligned to**
the backend contract (not pruned), and no audit-bearing field was removed.

---

## FIXED

### F1 — `OverMaxLine.max_line_qty` null-render crash + type/contract drift — **HIGH (runtime crash)**

**Files:** `src/types/exceptions.ts`, `src/app/exceptions/OverMaxSection.tsx`

**Discrepancy.** The backend contract is
`api/schemas.py::OverMaxLine.max_line_qty = Optional[float] = None`, and the
OpenAPI-generated type agrees (`generated.ts:3134`:
`max_line_qty?: number | null`). The hand-written UI type declared
`max_line_qty: number` (non-null), and `OverMaxSection.tsx:165` called
`line.max_line_qty.toLocaleString()` **unguarded**.

**Root cause.** The UI type was *stricter* than the backend contract, so
the type checker could not catch the hazard. When the backend emits `null`
for a line with no per-line cap (a legal contract state), the per-line
table throws `TypeError: Cannot read properties of null (reading
'toLocaleString')`, which unmounts the **entire** exception detail surface —
a passing test suite while the real screen goes blank, exactly the
"semantic regression" class in scope.

**Fix.**
1. `exceptions.ts` — `max_line_qty: number | null`, with a doc comment
   pointing at the backend `Optional[float]` source and a renderer
   null-guard contract. This is contract *alignment*, not pruning — the
   field remains present.
2. `OverMaxSection.tsx` — null-guard the cell: render the formatted value
   when present, otherwise an em-dash placeholder consistent with the
   section's existing `is_even_layer_item` absence pattern.

**Regression test.** `tests/components/OverMaxSection.test.tsx`
- `does not crash when max_line_qty is null (backend Optional[float])` —
  expands the (collapsed) Order Lines table and asserts no throw.
- `formats a present per-line cap` — asserts the present-value path.

Parent-commit verification (CLAUDE.md gate):
```
git stash push -- src/app/exceptions/OverMaxSection.tsx
npx vitest run tests/components/OverMaxSection.test.tsx
# → "TypeError: Cannot read properties of null (reading 'toLocaleString')" (FAIL)
git stash pop   # fix restored → 2/2 pass
```
`tsc --noEmit` clean; the mock fixtures (plain numbers) remain valid under
the widened type.

---

## TRIAGED — NO CHANGE (with rationale)

Real findings that are **guardrail-protected** or **by-design**. Recorded,
not silently "fixed", because the correct remediation lives upstream or
would violate CLAUDE.md.

### T-UI — Raw (unclamped) `composite_confidence` may exceed `[0,1]`
The backend recipe deliberately echoes the raw confidence for audit (see
asoe2 report T2). The UI type documents `[0,1]`. A display-side clamp in
the confidence renderer is the right fix, but it is a behavioural change to
a SOX-relevant surface and should land with its own focused test and
compliance sign-off rather than be bundled here. **Tracked.**

### Guardrail #6 partial-truth fallbacks (`?? ""`, `: "0"`, literal `"—"`)
Confirmed instances: `DiagnosticsSection.tsx` (`a.table ?? ""`),
`DraftReplySection.tsx` (fabricated `author: "reply-draft-recipe"` /
`authored_at: ""` on the audit substrate), `MOQSection` / `OverMaxSection`
/ `PalletConfigSection` (`delta > 0 ? … : "0"`), `KnowledgeGraphSection`
(`kind ?? ""`). These mask absent fields and should route through
`<EvidenceBlock>`. They are genuine Guardrail #6 violations but each is a
distinct behavioural change on an audit surface needing its own regression
lock; batching them risks unreviewable scope. **Tracked as a follow-up
remediation set**, severity MEDIUM (audit-fidelity, not crash).

### UI types stricter than backend defaults (`unit_cost`, `at_risk`, `uom`, pallet legacy fields)
`generated.ts` marks several fields `@default` (backend substitutes `0`/`""`
for absent values) while the UI type makes them required. Per Guardrail #7
these are **not** pruned. The pallet-only fields (`at_risk_total`,
`extra_labor_est_hrs`, `freight_waste_pct`) have no backend producer and
render only in mock mode — tracked against the registry, not removed.
**No change** — registry-tracked gaps.

### Dropped audit-bearing props (`MOQAnalysisData.unit_cost`, top-level `sku`)
Present in type + mock but never rendered by `MOQSection`. Fidelity gap;
the fix is additive rendering through `<EvidenceBlock>`. **Tracked**,
severity LOW.

---

## Test execution

- `tests/components` + `tests/architectural` → 116 files, 1043 pass / 12
  skip, after the fix.
- `tsc --noEmit` → clean.
