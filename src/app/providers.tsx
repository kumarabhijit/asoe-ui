"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { StatusAnnouncer } from "@/components/ui/StatusAnnouncer";
import { ToastProvider } from "@/components/ui/Toast";
import { ViewModeProvider } from "@/hooks/useViewMode";
import type { ReactNode } from "react";

// StatusAnnouncer mounts at the application root so every route
// — login, authenticated surfaces, error boundaries — exposes
// the canonical data-testid="status-announcer" selector. This is
// the Q1 contract from docs/test-strategy/e2e-flow-plan.md: ONE
// aria-live region everywhere a status change is emitted.
//
// Components emit via useStatusAnnouncer().announce(message);
// the chrome-invariant Playwright spec asserts the testid is
// present on every route, and flow YAMLs assert specific
// transcripts via assert_announcement_text steps.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ViewModeProvider>
        <SessionProvider>
          <StatusAnnouncer>
            <ToastProvider>{children}</ToastProvider>
          </StatusAnnouncer>
        </SessionProvider>
      </ViewModeProvider>
    </ThemeProvider>
  );
}
