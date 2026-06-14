/**
 * Contracts — shared request/response DTOs sourced from the backend
 * OpenAPI schema (asoe2/openapi/asoe2.openapi.json) via openapi-typescript.
 *
 * Phase 2 #9: drift-proof the frontend/backend contract.
 *
 * Do not hand-edit types re-exported from `./generated`. If you need a
 * shape change:
 *   1. change the Pydantic model in asoe2/api/schemas.py
 *   2. python scripts/export_openapi.py
 *   3. cd ../asoe-ui && npm run generate-types
 *   4. commit all three files together
 *
 * Both sides have drift tests that fail CI when any of those steps is
 * skipped.
 *
 * We alias a small, intentional surface rather than re-exporting
 * everything — the UI-facing boundary is narrow, and aliasing keeps
 * error messages + IDE hovers readable.
 */

import type { components } from "./generated";

// Phase 3: OverrideRequest / ApproveRequest / RejectRequest removed —
// their endpoints were deleted and all dispositions flow through
// DispositionRequest on PATCH /disposition (sub_type discriminated).
export type EscalateRequest = components["schemas"]["EscalateRequest"];
export type CosignRequest = components["schemas"]["CosignRequest"];
export type DispositionRequest = components["schemas"]["DispositionRequest"];
// HealthResponse intentionally NOT aliased here. The canonical UI type is the
// JSDoc-rich, transition-tolerant interface in `./exceptions` (looser
// `lifecycle_states: string[]`, optional fields with "[] until backend ships"
// fallbacks) which every consumer imports. Drift against the backend schema is
// gated on `./generated` by the OpenAPI drift tests. A second alias here was
// dead code (no importer) and a divergence risk — removed (consolidation).
export type ChallengeRequest = components["schemas"]["ChallengeRequest"];
export type ReanalyzeRequest = components["schemas"]["ReanalyzeRequest"];
