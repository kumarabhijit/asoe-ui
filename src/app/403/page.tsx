/**
 * /403 — PARITY-3a no-role-for-tenant landing page.
 *
 * The middleware redirects authenticated identities here when their
 * `roles` claim is empty for the active tenant. The user IS valid in
 * Entra ID, they just don't have an ASOE role assigned. We do NOT
 * force a sign-out — losing the identity context here makes the audit
 * trail less useful when an admin investigates "who tried to access
 * what".
 *
 * The `from` query param carries the originally requested path so an
 * operator can paste the URL into a support ticket without retyping.
 */
"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function ForbiddenInner() {
  const params = useSearchParams();
  const from = params.get("from") ?? "/";
  const { data: session } = useSession();
  const email =
    (session?.user as unknown as { email?: string } | undefined)?.email ??
    "your account";

  return (
    <main
      id="main-content"
      className="min-h-screen flex items-center justify-center px-32 py-64 bg-canvas"
    >
      <Card className="w-full max-w-lg p-32 flex flex-col gap-16">
        <div className="flex items-center gap-12">
          <ShieldAlert size={28} className="text-warning" />
          <h1 className="text-title text-text-primary">No access to this tenant</h1>
        </div>
        <p className="text-body text-text-secondary">
          You are signed in as <strong>{email}</strong>, but no ASOE roles
          are assigned to that identity for this tenant. Ask your tenant
          admin to add you to the appropriate Entra ID group.
        </p>
        <p className="text-caption text-text-tertiary">
          Requested: <code>{from}</code>
        </p>
        <div className="flex gap-12 mt-8">
          <Link href="/">
            <Button variant="neutral">Go home</Button>
          </Link>
          <Button
            variant="ghost"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </Button>
        </div>
      </Card>
    </main>
  );
}

export default function ForbiddenPage() {
  return (
    <Suspense fallback={null}>
      <ForbiddenInner />
    </Suspense>
  );
}
