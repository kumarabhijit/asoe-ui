import type { Metadata } from "next";
import "@/styles/design-tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASOE — Agentic System of Engagement",
  description: "Enterprise agent-first exception resolution platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
