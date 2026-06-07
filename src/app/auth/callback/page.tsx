"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/ui/Logo";
import { Loader2 } from "lucide-react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  useEffect(() => {
    if (error) {
      router.push(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (code) {
      const authMode =
        (process.env.NEXT_PUBLIC_ASOE_AUTH_MODE ?? "seed").toLowerCase();
      if (authMode === "entra") {
        // Real Azure AD flow — let NextAuth exchange the OAuth code via the
        // azure-ad provider rather than fabricating a fixed identity.
        signIn("azure-ad", { redirect: true, callbackUrl: "/" });
      } else {
        // Seed/preview has no real IdP to exchange a code with. Never
        // auto-authenticate a hardcoded user — route to the credentials form,
        // which validates against the seed MOCK_USERS.
        router.push("/login");
      }
    } else {
      router.push("/login");
    }
  }, [code, error, router]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-8)",
        color: "var(--color-text-tertiary)",
        fontSize: "var(--font-size-body)",
      }}
    >
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
      Completing sign-in...
    </div>
  );
}

export default function SSOCallbackPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-surface-page)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-24)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <Logo size="md" />
      <Suspense
        fallback={
          <span style={{ color: "var(--color-text-tertiary)", fontSize: "var(--font-size-body)" }}>
            Loading...
          </span>
        }
      >
        <CallbackContent />
      </Suspense>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
