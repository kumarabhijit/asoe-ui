/**
 * useErpProfile — exposes the currently configured ERP vendor and
 * resolver helpers for ERP-specific display labels.
 *
 * Source of truth: NEXT_PUBLIC_ASOE_ERP_VENDOR env var, parsed at
 * module load. Invalid / missing values fall back to
 * DEFAULT_ERP_VENDOR (GENERIC).
 *
 * Why a hook and not a plain function: wrapping the resolver in a
 * hook gives us a single integration point if we later move the ERP
 * preference to the /api/v1/health response or a tenant-scoped user
 * setting. Components adopt the hook once; the plumbing can change
 * without touching call sites.
 */
"use client";

import {
  DEFAULT_ERP_VENDOR,
  intentLabelFor,
  subTypeLabelFor,
  SUPPORTED_ERP_VENDORS,
  type ErpVendor,
} from "@/config/erp-label-map";

/**
 * Module-level memoised parse of the env var. Next.js inlines
 * NEXT_PUBLIC_* vars at build time, so this is a one-shot parse —
 * no reactivity needed.
 */
const RESOLVED_ERP_VENDOR: ErpVendor = (() => {
  const raw = (process.env.NEXT_PUBLIC_ASOE_ERP_VENDOR ?? "").toUpperCase();
  return (SUPPORTED_ERP_VENDORS as readonly string[]).includes(raw)
    ? (raw as ErpVendor)
    : DEFAULT_ERP_VENDOR;
})();

/**
 * Returns the currently configured ERP vendor.
 */
export function useErpProfile(): ErpVendor {
  return RESOLVED_ERP_VENDOR;
}

/**
 * Convenience hook: resolve a canonical intent code to a label for
 * the active ERP. Accepts nullable input and returns "" for null /
 * undefined so call sites can render unconditionally.
 */
export function useIntentLabel(intent: string | null | undefined): string {
  if (!intent) return "";
  return intentLabelFor(intent, RESOLVED_ERP_VENDOR);
}

/**
 * Convenience hook: resolve a canonical EDI sub_type code to a label
 * for the active ERP. Accepts nullable input.
 */
export function useSubTypeLabel(subType: string | null | undefined): string {
  if (!subType) return "";
  return subTypeLabelFor(subType, RESOLVED_ERP_VENDOR);
}
