"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/Toast";
import { PersonaProvider } from "@/hooks/usePersona";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider>
        <PersonaProvider>
          <ToastProvider>{children}</ToastProvider>
        </PersonaProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
