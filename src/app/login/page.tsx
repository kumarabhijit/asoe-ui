"use client";

import { Suspense, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

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
    <div className="pt-[44px] px-[36px] pb-[36px]">
      {/* Logo */}
      <div className="mb-32 text-center">
        <Logo size="lg" showTagline />
      </div>

      {/* Step Title */}
      <h1 className="text-title font-bold text-text-primary mb-24 flex items-center gap-8">
        {step === "password" && (
          <button
            type="button"
            onClick={handleBack}
            className="bg-transparent border-none cursor-pointer text-text-tertiary p-4 flex items-center rounded-sm transition-colors duration-instant hover:text-text-primary"
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
          className="flex items-start gap-8 px-12 py-10 bg-error-subtle border border-error-border rounded-sm mb-20 text-caption text-error leading-[1.5]"
        >
          <AlertCircle size={14} className="shrink-0 mt-[2px]" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Step 1: Email Only ── */}
      {step === "email" && (
        <form
          onSubmit={handleNext}
          className="flex flex-col gap-20"
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
          <div className="flex items-center gap-10 mt-4">
            <button
              type="button"
              role="switch"
              aria-checked={rememberMe}
              onClick={() => setRememberMe(!rememberMe)}
              className={cn(
                "w-[40px] h-[22px] rounded-full border-none cursor-pointer relative shrink-0 transition-colors duration-fast ease-out",
                rememberMe ? "bg-brand" : "bg-border-strong"
              )}
            >
              <span
                className={cn(
                  "absolute top-[2px] w-[18px] h-[18px] rounded-full bg-surface-primary shadow-sm transition-[left] duration-fast ease-out",
                  rememberMe ? "left-[20px]" : "left-[2px]"
                )}
              />
            </button>
            <span className="text-body text-text-secondary font-medium">
              Remember me
            </span>
          </div>

          {/* Help links */}
          <div className="flex flex-col items-start gap-6 mt-4">
            {["Forgot username?", "Need help signing in?"].map((text) => (
              <button
                key={text}
                type="button"
                className="bg-transparent border-none cursor-pointer text-caption text-text-tertiary font-sans font-medium p-0 transition-colors duration-instant hover:text-text-secondary"
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
          className="flex flex-col gap-20"
        >
          <div className="px-12 py-10 bg-black/[0.03] rounded-sm text-body text-text-secondary font-medium">
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
                className="bg-transparent border-none cursor-pointer text-[inherit] p-0 flex"
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
            className="bg-transparent border-none cursor-pointer text-caption text-text-tertiary font-sans font-medium p-0 text-left transition-colors duration-instant hover:text-text-secondary"
          >
            Forgot password?
          </button>
        </form>
      )}

      {/* ── SSO Redirect State ── */}
      {step === "sso-redirect" && (
        <div className="flex flex-col items-center gap-16 py-24">
          <div className="agent-active-dot w-[12px] h-[12px]" />
          <span className="text-body text-text-secondary text-center">
            Redirecting to your identity provider...
          </span>
          <span className="text-caption text-text-tertiary">
            {email}
          </span>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-surface-page flex flex-col items-center justify-center p-24 font-sans">
      {/* Login Card */}
      <Card elevated className="w-full max-w-[420px]">
        <Suspense
          fallback={
            <div className="p-40 text-center">Loading...</div>
          }
        >
          <LoginForm />
        </Suspense>
      </Card>

      {/* Agent Activity Footer */}
      <div className="flex items-center gap-8 mt-32">
        <span className="agent-active-dot" />
        <span className="text-caption text-text-tertiary font-medium">
          12 agents active
        </span>
        <span className="text-caption text-text-quaternary">
          &middot;
        </span>
        <span className="text-caption text-text-tertiary font-medium">
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
