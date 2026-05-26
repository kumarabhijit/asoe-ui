/**
 * PreprodIdentityBanner — PARITY-3a frontend identity affordance.
 *
 * Renders a non-dismissable banner whenever the UI is running with
 * `ASOE_AUTH_MODE !== "seed"` (i.e. real Entra-backed identities, not
 * the dev seed users). Operators need to see at a glance WHICH
 * identity their session is running as, because preprod sometimes
 * hosts shadowed real-tenant data — a wrong-identity action there is
 * SOX-relevant.
 *
 * Visual: a thin slate strip under the page header, similar in shape
 * to CaseViewBanner but tuned for an identity / environment cue.
 * Non-dismissable by design — the relationship is operational
 * context, not a transient notice.
 *
 * The banner only renders on the client (it depends on the NextAuth
 * session). When the env mode is `seed`, the component returns null
 * so dev/CI workflows see no chrome change.
 */
"use client";

import { useSession } from "next-auth/react";
import { ShieldCheck } from "lucide-react";

export interface PreprodIdentityBannerProps {
  /** Override the env-derived mode. Used by tests and Storybook;
   *  production callers should leave this undefined so the value
   *  comes from NEXT_PUBLIC_ASOE_AUTH_MODE / ASOE_AUTH_MODE. */
  modeOverride?: "seed" | "entra";
  className?: string;
}

function resolveMode(override?: "seed" | "entra"): "seed" | "entra" {
  if (override) return override;
  // NEXT_PUBLIC_ prefix is the client-readable mirror; ASOE_AUTH_MODE
  // (server-only) drives provider mounting in src/lib/auth.ts.
  const raw =
    process.env.NEXT_PUBLIC_ASOE_AUTH_MODE ??
    process.env.ASOE_AUTH_MODE ??
    "seed";
  return raw.toLowerCase() === "entra" ? "entra" : "seed";
}

export function PreprodIdentityBanner({
  modeOverride,
  className,
}: PreprodIdentityBannerProps) {
  const mode = resolveMode(modeOverride);
  const { data: session, status } = useSession();

  if (mode === "seed") return null;

  const email =
    (session?.user as unknown as { email?: string } | undefined)?.email ??
    (status === "loading" ? "Loading…" : "(no session)");

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Preprod identity"
      data-testid="preprod-identity-banner"
      className={[
        "flex items-center justify-between gap-12 px-32 py-8",
        "bg-warning/10 border-b border-warning/20",
        "text-caption text-text-secondary",
        className || "",
      ].join(" ")}
    >
      <div className="flex items-center gap-8">
        <ShieldCheck size={14} className="text-warning shrink-0" />
        <span>
          <strong className="text-text-primary">Preprod (Entra ID)</strong>{" "}
          — Logged in as:{" "}
          <strong className="text-text-primary">{email}</strong>
        </span>
      </div>
      <span className="text-caption text-text-tertiary">
        ASOE_AUTH_MODE=entra
      </span>
    </div>
  );
}
