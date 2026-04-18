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

export type OverrideRequest = components["schemas"]["OverrideRequest"];
export type EscalateRequest = components["schemas"]["EscalateRequest"];
export type CosignRequest = components["schemas"]["CosignRequest"];
export type HealthResponse = components["schemas"]["HealthResponse"];
export type ApproveRequest = components["schemas"]["ApproveRequest"];
export type RejectRequest = components["schemas"]["RejectRequest"];
export type ChallengeRequest = components["schemas"]["ChallengeRequest"];
export type ReanalyzeRequest = components["schemas"]["ReanalyzeRequest"];
