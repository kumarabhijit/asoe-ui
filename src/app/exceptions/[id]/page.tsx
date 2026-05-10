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
  { id: "cases", label: "Cases", href: "/cases" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];

export default function ExceptionFullPage() {
  const params = useParams();
  const router = useRouter();
  const exceptionId = params.id as string;

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      <NavBar tabs={NAV_TABS} activeTab="exceptions" agentCount={3} />

      {/* Breadcrumb + back button */}
      <div className="px-32 py-12 border-b border-border bg-surface-primary flex items-center gap-12">
        <Button variant="ghost" size="sm" onClick={() => router.push("/exceptions")}>
          <ArrowLeft size={16} />
          Back to Queue
        </Button>
        <span className="text-text-quaternary text-caption">/</span>
        <span className="text-caption font-semibold text-text-secondary font-mono">
          {exceptionId}
        </span>
      </div>

      {/* Full-width detail content */}
      <div className="flex-1 max-w-[960px] w-full mx-auto px-32 py-24">
        <ExceptionDetailPanel
          exceptionId={exceptionId}
          onClose={() => router.push("/exceptions")}
        />
      </div>
    </div>
  );
}
