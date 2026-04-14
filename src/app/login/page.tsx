"use client";

import { Suspense, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";

type Step = "email" | "password" | "sso-redirect";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const SSO_DOMAINS = ["acme.com", "walmart.com", "kroger.com"];

  function isSSODomain(emailValue: string): boolean {
    const domain = emailValue.split("@")[1]?.toLowerCase();
    return SSO_DOMAINS.includes(domain);
  }

  async function handleNext(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address or username");
      return;
    }
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));

    if (email.includes("@") && isSSODomain(email)) {
      setStep("sso-redirect");
      await new Promise((r) => setTimeout(r, 2000));
      setError("SSO is not configured in this demo. Enter any password to continue.");
      setStep("password");
    } else {
      setStep("password");
    }
    setLoading(false);
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("Please enter your password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) {
        setError("Invalid credentials. Please try again.");
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep("email");
    setPassword("");
    setError("");
  }

  return (
    <div style={{ padding: "44px 36px 36px" }}>
      {/* Logo */}
      <div style={{ marginBottom: "var(--space-32)", textAlign: "center" }}>
        <Logo size="lg" showTagline />
      </div>

      {/* Step Title */}
      <h1
        style={{
          fontSize: "var(--font-size-title)",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          marginBottom: "var(--space-24)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-8)",
        }}
      >
        {step === "password" && (
          <button
            type="button"
            onClick={handleBack}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-tertiary)",
              padding: "var(--space-4)",
              display: "flex",
              alignItems: "center",
              borderRadius: "var(--radius-sm)",
              transition: "color var(--dur-instant)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--color-text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--color-text-tertiary)")
            }
            aria-label="Go back to email"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        Sign In
      </h1>

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

      {/* ── Step 1: Email Only ── */}
      {step === "email" && (
        <form
          onSubmit={handleNext}
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-20)" }}
        >
          <Input
            label="Username, email address, or SSO code"
            type="email"
            placeholder="jane@acme.com"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <Button
            variant="brand"
            size="lg"
            fullWidth
            loading={loading}
            type="submit"
          >
            Next
          </Button>

          {/* Remember me toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-10)",
              marginTop: "var(--space-4)",
            }}
          >
            <button
              type="button"
              role="switch"
              aria-checked={rememberMe}
              onClick={() => setRememberMe(!rememberMe)}
              style={{
                width: 40,
                height: 22,
                borderRadius: "var(--radius-full)",
                background: rememberMe
                  ? "var(--color-brand)"
                  : "var(--color-border-strong)",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background var(--dur-fast) var(--ease-out)",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: rememberMe ? 20 : 2,
                  width: 18,
                  height: 18,
                  borderRadius: "var(--radius-full)",
                  background: "var(--color-surface-primary)",
                  boxShadow: "var(--shadow-sm)",
                  transition: "left var(--dur-fast) var(--ease-out)",
                }}
              />
            </button>
            <span
              style={{
                fontSize: "var(--font-size-body)",
                color: "var(--color-text-secondary)",
                fontWeight: 500,
              }}
            >
              Remember me
            </span>
          </div>

          {/* Help links */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "var(--space-6)",
              marginTop: "var(--space-4)",
            }}
          >
            {["Forgot username?", "Need help signing in?"].map((text) => (
              <button
                key={text}
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "var(--font-size-caption)",
                  color: "var(--color-text-tertiary)",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  padding: 0,
                  transition: "color var(--dur-instant)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--color-text-secondary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--color-text-tertiary)")
                }
              >
                {text}
              </button>
            ))}
          </div>
        </form>
      )}

      {/* ── Step 2: Password ── */}
      {step === "password" && (
        <form
          onSubmit={handleSignIn}
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-20)" }}
        >
          <div
            style={{
              padding: "var(--space-10) var(--space-12)",
              background: "rgba(0,0,0,0.03)",
              borderRadius: "var(--radius-sm)",
              fontSize: "var(--font-size-body)",
              color: "var(--color-text-secondary)",
              fontWeight: 500,
            }}
          >
            {email}
          </div>

          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
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

          <Button
            variant="brand"
            size="lg"
            fullWidth
            loading={loading}
            type="submit"
          >
            Sign In
          </Button>

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
              padding: 0,
              textAlign: "left",
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
        </form>
      )}

      {/* ── SSO Redirect State ── */}
      {step === "sso-redirect" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-16)",
            padding: "var(--space-24) 0",
          }}
        >
          <div className="agent-active-dot" style={{ width: 12, height: 12 }} />
          <span
            style={{
              fontSize: "var(--font-size-body)",
              color: "var(--color-text-secondary)",
              textAlign: "center",
            }}
          >
            Redirecting to your identity provider...
          </span>
          <span
            style={{
              fontSize: "var(--font-size-caption)",
              color: "var(--color-text-tertiary)",
            }}
          >
            {email}
          </span>
        </div>
      )}
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
        <Suspense
          fallback={
            <div style={{ padding: 40, textAlign: "center" }}>Loading...</div>
          }
        >
          <LoginForm />
        </Suspense>
      </Card>

      {/* Agent Activity Footer */}
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
