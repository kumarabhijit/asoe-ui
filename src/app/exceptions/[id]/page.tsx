/**
 * Full-page exception detail — expanded view.
 * Reuses ExceptionDetailPanel from the sidebar in a full-width layout.
 * Accessed via the expand button in the sidebar header.
 */
"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NavBar } from "@/components/ui/NavBar";
import { Button } from "@/components/ui/Button";
import ExceptionDetailPanel from "../ExceptionDetailPanel";

const NAV_TABS = [
  { id: "inbox", label: "Customer Inbox", href: "/inbox" },
  { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];

export default function ExceptionFullPage() {
  const params = useParams();
  const router = useRouter();
  const exceptionId = params.id as string;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-surface-page)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <NavBar tabs={NAV_TABS} activeTab="exceptions" agentCount={3} />

      {/* Breadcrumb + back button */}
      <div
        style={{
          padding: "var(--space-12) var(--space-32)",
          borderBottom: "1px solid var(--color-border-default)",
          background: "var(--color-surface-primary)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-12)",
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/exceptions")}
        >
          <ArrowLeft size={16} />
          Back to Queue
        </Button>
        <span
          style={{
            color: "var(--color-text-quaternary)",
            fontSize: "var(--font-size-caption)",
          }}
        >
          /
        </span>
        <span
          style={{
            fontSize: "var(--font-size-caption)",
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {exceptionId}
        </span>
      </div>

      {/* Full-width detail content */}
      <div
        style={{
          flex: 1,
          maxWidth: 960,
          width: "100%",
          margin: "0 auto",
          padding: "var(--space-24) var(--space-32)",
        }}
      >
        <ExceptionDetailPanel
          exceptionId={exceptionId}
          onClose={() => router.push("/exceptions")}
        />
      </div>
    </div>
  );
}
