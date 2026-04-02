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
      signIn("credentials", {
        email: "jane@acme.com",
        password: "password",
        redirect: true,
        callbackUrl: "/",
      });
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
