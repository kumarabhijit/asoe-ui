# Full-stack local dev (asoe-ui ↔ asoe2 sandbox)

By default `asoe-ui` runs in **mock mode** — it serves the in-repo `MOCK_*`
fixtures and needs no backend (this is what the Vercel preview uses). To run
the UI against a real local backend, stand up the **asoe2 sandbox** and flip
the live-backend switch.

## 1. Run the asoe2 sandbox backend

In a sibling checkout of `kumarabhijit/asoe2`:

```bash
cd ../asoe2
pip install -r tests/sandbox/requirements-sandbox.txt
PYTHONPATH=. python tests/sandbox/seed.py            # build sandbox.db from the catalog
ASOE_ENV=sandbox PYTHONPATH=. uvicorn api.app:create_app --factory --port 8000
```

The seed is generated from `fixtures/scenarios/catalog.yaml` (RFC Decision A);
`/api/v1/health` serves the governed intent / lifecycle / shadow-verdict enums
the UI dropdowns source via `useHealth`.

## 2. Point the UI at it

```bash
cp .env.local.example .env.local
# in .env.local:
#   NEXT_PUBLIC_API_URL=http://localhost:8000
#   NEXT_PUBLIC_USE_REAL_API=1
npm run dev
```

With `NEXT_PUBLIC_USE_REAL_API=1` the API client (`src/lib/api.ts`) calls the
sandbox instead of returning mocks. Unset it (or set `0`) to return to mock
mode.

## Scenario catalog ↔ mocks

The sandbox seed and the UI mock layer derive from the **same** declarative
source, `asoe2/fixtures/scenarios/catalog.yaml`:

| Step | Command | Reads | Writes |
|---|---|---|---|
| Sync snapshot (the only cross-repo read) | `npm run sync:scenario-catalog` | `../asoe2/fixtures/scenarios/catalog.yaml` | `tests/contract/snapshots/scenario_catalog.yaml` |
| Generate mocks | `npm run gen:mock-data` | the committed snapshot | `src/lib/mock-data/__generated__/scenario_catalog.ts` |
| Drift gate (CI) | `npm run verify:scenario-catalog` | the committed snapshot | — (fails on diff) |

CI / Vercel never read `../asoe2`; they run only `verify:scenario-catalog`
against the committed snapshot. Refresh the snapshot with
`sync:scenario-catalog` when the asoe2 catalog changes.

> **Not yet adopted (Guardrail #2).** The generated
> `__generated__/scenario_catalog.ts` is a *parallel* artifact that proves the
> generate-then-diff pipeline. The app still consumes the hand-authored
> `src/lib/mock-data/exceptions.ts` + `order-analyses.ts` because the catalog
> is intentionally coarser than today's `MOCK_ORDER_ANALYSES` evidence (and
> omits recipe names by design). Adoption happens once the catalog reaches
> parity — generate, diff against the current mocks, adopt only at parity.
