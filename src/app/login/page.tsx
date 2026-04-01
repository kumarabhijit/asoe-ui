"use client";

import { Suspense, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Building2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [ssoLoading, setSsoLoading] = useState(false);
  const [credLoading, setCredLoading] = useState(false);

  const isLoading = ssoLoading || credLoading;

  async function handleSSO() {
    setSsoLoading(true);
    setError("");
    try {
      await new Promise((r) => setTimeout(r, 1500));
      setError(
        "SSO is not configured in this demo. Use email/password: jane@acme.com / password"
      );
    } finally {
      setSsoLoading(false);
    }
  }

  async function handleCredentialLogin(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }
    setCredLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) {
        setError("Invalid email or password. Please try again.");
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setCredLoading(false);
    }
  }

  return (
    <div style={{ padding: "var(--space-40) var(--space-32) var(--space-32)" }}>
      {/* Logo */}
      <div style={{ marginBottom: "var(--space-32)", textAlign: "center" }}>
        <Logo size="lg" showTagline />
      </div>

      {/* SSO Button — Primary CTA (brand blue) */}
      <Button
        variant="brand"
        size="lg"
        fullWidth
        loading={ssoLoading}
        disabled={isLoading}
        onClick={handleSSO}
      >
        <Building2 size={18} />
        Sign in with SSO
      </Button>

      {/* Divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-12)",
          margin: "var(--space-24) 0",
        }}
      >
        <div style={{ flex: 1, height: 1, background: "var(--color-border-default)" }} />
        <span
          style={{
            fontSize: "var(--font-size-caption)",
            color: "var(--color-text-tertiary)",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          or continue with email
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--color-border-default)" }} />
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-8)",
            padding: "var(--space-10) var(--space-12)",
            background: "var(--color-error-subtle)",
            border: "1px solid var(--color-error-border)",
            borderRadius: "var(--radius-sm)",
            marginBottom: "var(--space-20)",
            fontSize: "var(--font-size-caption)",
            color: "var(--color-error)",
            lineHeight: 1.5,
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Credential Form */}
      <form
        onSubmit={handleCredentialLogin}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)" }}
      >
        <Input
          label="Email address"
          type="email"
          placeholder="jane@acme.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "inherit",
                padding: 0,
                display: "flex",
              }}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        {/* Sign In — Neutral variant (gray, not blue) */}
        <Button
          variant="neutral"
          size="lg"
          fullWidth
          loading={credLoading}
          disabled={isLoading}
          type="submit"
          style={{ marginTop: "var(--space-4)" }}
        >
          Sign In
        </Button>
      </form>

      {/* Forgot Password — tertiary text, NOT blue */}
      <div style={{ textAlign: "center", marginTop: "var(--space-16)" }}>
        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "var(--font-size-caption)",
            color: "var(--color-text-tertiary)",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            textDecoration: "none",
            transition: "color var(--dur-instant)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--color-text-secondary)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--color-text-tertiary)")
          }
        >
          Forgot password?
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-surface-page)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-24)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Login Card */}
      <Card elevated style={{ width: "100%", maxWidth: 420 }}>
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </Card>

      {/* Agent Activity Footer — The system is alive */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-8)",
          marginTop: "var(--space-32)",
        }}
      >
        <span className="agent-active-dot" />
        <span
          style={{
            fontSize: "var(--font-size-caption)",
            color: "var(--color-text-tertiary)",
            fontWeight: 500,
          }}
        >
          12 agents active
        </span>
        <span
          style={{
            fontSize: "var(--font-size-caption)",
            color: "var(--color-text-quaternary)",
          }}
        >
          &middot;
        </span>
        <span
          style={{
            fontSize: "var(--font-size-caption)",
            color: "var(--color-text-tertiary)",
            fontWeight: 500,
          }}
        >
          847 exceptions resolved today
        </span>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
