/**
 * Customer Inbox — AI-powered email triage and classification.
 *
 * Rich two-pane layout: 380px inbox queue + detail panel.
 * Refactored to use shared component library while preserving
 * the original visual design.
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Mail, ChevronRight, Search, Zap, CheckCircle2,
  Clock, FileText, AlertTriangle, RefreshCw,
} from "lucide-react";
import { NavBar } from "@/components/ui/NavBar";
import { UserSwitcher } from "@/components/ui/UserSwitcher";
import { MetricTile } from "@/components/ui/MetricTile";
import { Badge, categoryVariant, inboxStatusVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useHealth } from "@/hooks/useHealth";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/* ── Display label maps (visual mapping with default fallback) ────── */
const CATEGORY_LABELS: Record<string, string> = {
  ORDER_CHANGE: "Order Change",
  SHIPMENT_INQUIRY: "Shipment Inquiry",
  NEW_ORDER: "New Order",
  COMPLAINT: "Complaint",
  INVOICE_QUERY: "Invoice Query",
};

const STATUS_LABELS: Record<string, string> = {
  NEEDS_APPROVAL: "Needs Approval",
  IN_QUEUE: "In Queue",
  AUTO_RESOLVED: "Auto-Resolved",
  ESCALATED: "Escalated",
  ANALYZING: "Agent Analyzing",
};

/* ── Data ─────────────────────────────────────────────────────────── */
interface InboxItem {
  id: string;
  sender: string;
  initials: string;
  initialsColor: string;
  subject: string;
  preview: string;
  time: string;
  category: string;
  status: string;
  amount?: string;
  lineCount?: number;
  agentConfidence?: number;
  agentSummary?: string;
  agentRecommendation?: string;
  email?: { from: string; org: string; mailbox: string; received: string; body: string };
}

const INBOX: InboxItem[] = [
  {
    id: "1", sender: "John Smith", initials: "JS", initialsColor: "#3B82F6",
    subject: "Change request — SO 4500023421",
    preview: "Hi, I need to change order 4500023421 — re...",
    time: "09:14 AM", category: "ORDER_CHANGE", status: "NEEDS_APPROVAL",
    amount: "$45,200", lineCount: 2, agentConfidence: 94,
    agentSummary: "Qty reduction on item 000010 (500→300) and delivery date push to Mar 15. No pricing impact. Within approval threshold.",
    agentRecommendation: "Approve — L3 authority required",
    email: {
      from: "jsmith@acmecorp.com", org: "Acme Corp", mailbox: "orders@stratumlabs.ai",
      received: "09:14 AM",
      body: "Hi team,\n\nI need to make a change to order 4500023421.\n\n1. Reduce quantity on item 000010 from 500 to 300 units\n2. Push delivery date to March 15, 2025\n\nAlso, is item 000020 on back order?\n\nThanks,\nJohn Smith\nProcurement Manager",
    },
  },
  {
    id: "2", sender: "Lisa Park", initials: "LP", initialsColor: "#7C3AED",
    subject: "Where is my shipment? SO 4500019882",
    preview: "We placed order 4500019882 two weeks ag...",
    time: "08:47 AM", category: "SHIPMENT_INQUIRY", status: "AUTO_RESOLVED",
    agentConfidence: 98,
    agentSummary: "Tracking confirmed: shipped via FedEx #7742881. ETA 2 business days. Auto-response sent.",
    agentRecommendation: "No action needed — auto-resolved",
  },
  {
    id: "3", sender: "Jennifer Walsh", initials: "JW", initialsColor: "#0D9488",
    subject: "PO# 0093847612 — Beverages Dept 005...",
    preview: "Vendor 0076421. Dept 0058 Beverages. 3 li...",
    time: "08:52 AM", category: "NEW_ORDER", status: "IN_QUEUE",
    lineCount: 3, agentConfidence: 87,
    agentSummary: "New PO with 3 line items for Beverages dept. Vendor 0076421 active. Credit check passed.",
    agentRecommendation: "Route to order entry queue",
  },
  {
    id: "4", sender: "Marcus Reed", initials: "MR", initialsColor: "#E11D48",
    subject: "Kroger PO KRO-2025-03-44821 — Bever...",
    preview: "Division 05 Southeast. 5 lines, 2,150 CS tota...",
    time: "07:31 AM", category: "NEW_ORDER", status: "IN_QUEUE",
    lineCount: 5, amount: "$18,400", agentConfidence: 91,
    agentSummary: "Kroger PO, Div 05 Southeast. 5 lines, 2,150 CS. Price validation passed. ATP check pending.",
    agentRecommendation: "Route to order entry — ATP check needed",
  },
  {
    id: "5", sender: "Margaret Chen", initials: "MC", initialsColor: "#DC2626",
    subject: "URGENT: Critical delivery failure — escal...",
    preview: "This is the third time our order has been del...",
    time: "07:55 AM", category: "COMPLAINT", status: "ESCALATED",
    agentConfidence: 96,
    agentSummary: "Third delivery failure for this customer. Pattern detected: carrier issue on Southeast route. High churn risk.",
    agentRecommendation: "Escalate to CS manager — high churn risk",
  },
  {
    id: "6", sender: "David Okafor", initials: "DO", initialsColor: "#D97706",
    subject: "Invoice question — INV-20240892",
    preview: "We received invoice INV-20240892 for $8,4...",
    time: "Yesterday", category: "INVOICE_QUERY", status: "AUTO_RESOLVED",
    amount: "$8,400", agentConfidence: 99,
    agentSummary: "Invoice matches PO and delivery. No discrepancy. Auto-response with breakdown sent.",
    agentRecommendation: "No action needed — auto-resolved",
  },
];

const NAV_TABS = [
  { id: "inbox", label: "Customer Inbox", href: "/inbox" },
  { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];

/* ── Main Page ────────────────────────────────────────────────────── */
export default function InboxPage() {
  const router = useRouter();
  const { health } = useHealth();
  const { user, visibleTabs } = useAuth();
  const [selectedId, setSelectedId] = useState("1");
  const [activeTab, setActiveTab] = useState("inbox");
  const [detailTab, setDetailTab] = useState("email");

  const userName = user?.name || "User";
  const userInitials = (user as { avatar_initials?: string })?.avatar_initials || userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const filteredTabs = visibleTabs.length > 0 ? NAV_TABS.filter((t) => visibleTabs.includes(t.id)) : NAV_TABS;

  useEffect(() => { document.title = "Customer Inbox — ASOE"; }, []);

  const selected = INBOX.find((i) => i.id === selectedId) || INBOX[0];
  const needsAttention = INBOX.filter((i) => i.status === "NEEDS_APPROVAL" || i.status === "ESCALATED").length;
  const autoResolved = INBOX.filter((i) => i.status === "AUTO_RESOLVED").length;

  return (
    <div className="min-h-screen bg-surface-page font-sans text-body text-text-primary leading-normal">
      {/* ── NAV BAR (shared component) ── */}
      <NavBar
        tabs={filteredTabs}
        activeTab="inbox"
        onTabChange={(id) => {
          const tab = NAV_TABS.find((t) => t.id === id);
          if (tab?.href) router.push(tab.href);
        }}
        userName={userName}
        userInitials={userInitials}
        agentCount={health?.allowed_intents?.length || 0}
        onSignOut={() => signOut({ callbackUrl: "/login" })}
        onSettingsClick={() => router.push("/settings")}
        rightContent={<UserSwitcher />}
      />

      {/* ── PAGE HEADER ── */}
      <div className="bg-surface-primary border-b border-border shadow-xs">
        <div className="max-w-[1440px] mx-auto px-32">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="py-8">
            <span className="text-caption text-text-tertiary">Home</span>
            <ChevronRight size={10} className="mx-4 text-text-tertiary align-middle inline" />
            <span className="text-caption text-text-secondary">Customer Inbox</span>
          </nav>
          <div className="flex items-center justify-between py-8 pb-16">
            <div className="flex items-center gap-12">
              <div className="w-[40px] h-[40px] rounded-md bg-text-primary flex items-center justify-center">
                <Mail size={20} className="text-text-inverse" />
              </div>
              <div>
                <h1 className="text-display font-bold leading-tight m-0">
                  Customer Inbox
                </h1>
                <span className="text-caption text-text-tertiary">
                  AI-powered email triage and classification
                </span>
              </div>
            </div>
            <div className="flex gap-8">
              <Button variant="neutral" size="md">
                <RefreshCw size={14} />
                Refresh
              </Button>
              <Button variant="brand" size="md">
                <Zap size={14} />
                Process All
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div id="main-content" />
      {/* ── METRICS STRIP ── */}
      <div className="max-w-[1440px] mx-auto px-32 py-16">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-16">
          <MetricTile icon={<Mail size={20} />} label="Total Inbound" value={String(INBOX.length)} subtitle="Last 24 hours" tint="var(--color-cat-blue)" />
          <MetricTile icon={<AlertTriangle size={20} />} label="Need Attention" value={String(needsAttention)} subtitle="Approval or escalation" tint="var(--color-warning)" />
          <MetricTile icon={<CheckCircle2 size={20} />} label="Auto-Resolved" value={String(autoResolved)} subtitle="No human action needed" tint="var(--color-success)" />
          <MetricTile icon={<Zap size={20} />} label="Avg Response" value="< 2m" subtitle="Agent classification time" tint="var(--color-cat-teal)" />
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div className="max-w-[1440px] mx-auto px-32">
        <div className="border-b border-border flex">
          {[
            { id: "inbox", label: "Inbox", count: INBOX.length },
            { id: "ai-flow", label: "AI Intake Flow", count: undefined },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-16 py-10 border-none bg-transparent cursor-pointer font-sans text-body -mb-px flex items-center gap-6 transition-all duration-fast",
                activeTab === tab.id
                  ? "font-bold text-text-primary border-b-2 border-brand"
                  : "font-semibold text-text-tertiary border-b-2 border-transparent",
              )}
            >
              {tab.label}
              {tab.count != null && (
                <span className="text-caption font-semibold text-text-tertiary bg-surface-secondary px-1.5 py-px rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT: QUEUE + DETAIL PANEL ── */}
      <div className="max-w-[1440px] mx-auto px-32 py-16 flex gap-16">
        {/* ── LEFT: Inbox Queue ── */}
        <div className="w-[380px] shrink-0 bg-surface-primary rounded-md shadow-sm overflow-hidden">
          {/* Search */}
          <div className="px-16 py-12 border-b border-border-subtle flex items-center gap-8">
            <Search size={16} className="text-text-tertiary shrink-0" />
            <span className="text-body text-text-tertiary">
              Search inbox...
            </span>
            <div className="flex-1" />
            <span className="text-label font-bold tracking-widest text-text-tertiary uppercase">
              All Inboxes
            </span>
          </div>

          {/* Inbox items */}
          <div className="max-h-[calc(100vh-370px)] overflow-y-auto">
            {INBOX.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(item.id); }}
                  className={cn(
                    "px-16 py-12 cursor-pointer border-b border-border-subtle border-l-[3px] transition-colors duration-fast",
                    isSelected ? "bg-surface-secondary border-l-brand" : "bg-surface-primary border-l-transparent",
                  )}
                >
                  <div className="flex gap-10">
                    {/* Avatar — dynamic color from data, inline style is correct */}
                    <div
                      className="w-[36px] h-[36px] rounded-full shrink-0 flex items-center justify-center text-caption font-bold"
                      style={{ background: `color-mix(in srgb, ${item.initialsColor} 15%, white)`, color: item.initialsColor }}
                    >
                      {item.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-px">
                        <span className="font-semibold text-body text-text-primary">{item.sender}</span>
                        <span className="text-caption text-text-tertiary font-mono shrink-0">{item.time}</span>
                      </div>
                      <div className="text-body font-medium text-text-primary whitespace-nowrap overflow-hidden text-ellipsis mb-4">
                        {item.subject}
                      </div>
                      <div className="text-caption text-text-tertiary whitespace-nowrap overflow-hidden text-ellipsis mb-8">
                        {item.preview}
                      </div>
                      <div className="flex gap-4 flex-wrap items-center">
                        <Badge variant={categoryVariant(item.category)} size="sm" icon={null}>
                          {CATEGORY_LABELS[item.category] ?? item.category}
                        </Badge>
                        <Badge variant={inboxStatusVariant(item.status)} size="sm">
                          {STATUS_LABELS[item.status] ?? item.status}
                        </Badge>
                        {item.lineCount && (
                          <span className="text-label text-text-tertiary flex items-center gap-[3px]">
                            <FileText size={10} />
                            {item.lineCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Detail Panel ── */}
        <div className="flex-1 flex flex-col gap-16">
          {/* Email Header Card */}
          <div className="bg-surface-primary rounded-md shadow-sm p-20">
            <div className="flex gap-12 mb-16">
              <div
                className="w-[44px] h-[44px] rounded-full shrink-0 flex items-center justify-center text-subhead font-bold"
                style={{ background: `color-mix(in srgb, ${selected.initialsColor} 15%, white)`, color: selected.initialsColor }}
              >
                {selected.initials}
              </div>
              <div className="flex-1">
                <h2 className="text-heading font-bold m-0 leading-snug">{selected.subject}</h2>
                <div className="text-caption text-text-secondary mt-px">
                  {selected.sender}{" "}
                  {selected.email && (
                    <span className="text-text-tertiary">
                      &lt;{selected.email.from}&gt; · {selected.email.org} · {selected.email.received}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-6 flex-wrap items-center">
              <Badge variant={categoryVariant(selected.category)} size="sm" icon={null}>
                {CATEGORY_LABELS[selected.category] ?? selected.category}
              </Badge>
              <Badge variant={inboxStatusVariant(selected.status)} size="sm">
                {STATUS_LABELS[selected.status] ?? selected.status}
              </Badge>
              {selected.amount && (
                <span className="font-mono text-body font-semibold text-text-primary">{selected.amount}</span>
              )}
            </div>
            {selected.email && (
              <div className="flex gap-32 mt-16 px-16 py-12 bg-surface-secondary rounded-sm">
                <MetaField label="Source Mailbox">
                  <span className="flex items-center gap-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                    {selected.email.mailbox}
                  </span>
                </MetaField>
                <MetaField label="Received">
                  <span className="font-mono">{selected.email.received}</span>
                </MetaField>
                <MetaField label="Attachments">
                  <span className="text-text-tertiary">None</span>
                </MetaField>
              </div>
            )}
          </div>

          {/* ── AGENT REASONING CARD (Layer 1 — always visible) ── */}
          <div className="bg-surface-primary rounded-md shadow-md p-20">
            <div className="flex items-center gap-8 mb-12">
              <div className="w-[28px] h-[28px] rounded-sm bg-surface-secondary flex items-center justify-center">
                <Zap size={14} className="text-text-secondary" />
              </div>
              <span className="font-semibold text-subhead text-text-primary">Agent Analysis</span>
              <div className="flex-1" />
              {selected.agentConfidence && (
                <div className="flex items-center gap-8">
                  <div className="w-[80px] h-[4px] rounded-full bg-surface-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-text-secondary"
                      style={{ width: `${selected.agentConfidence}%` }}
                    />
                  </div>
                  <span className="font-mono text-caption font-semibold text-text-primary">
                    {selected.agentConfidence}%
                  </span>
                </div>
              )}
            </div>
            <p className="text-body text-text-secondary leading-relaxed m-0 mb-12">
              {selected.agentSummary}
            </p>
            <div className="flex gap-8 items-center">
              <div className="px-10 py-4 rounded-sm bg-surface-secondary text-caption font-semibold text-text-secondary">
                {selected.agentRecommendation}
              </div>
              <div className="flex-1" />
              {selected.status === "NEEDS_APPROVAL" && (
                <>
                  <Button variant="brand" size="sm">
                    <CheckCircle2 size={12} />
                    Approve
                  </Button>
                  <Button variant="neutral" size="sm">Override</Button>
                  <Button variant="ghost" size="sm">Escalate</Button>
                </>
              )}
            </div>
            {/* Layer 2 trigger */}
            <button className="mt-12 w-full py-8 border-none bg-transparent cursor-pointer text-caption text-text-tertiary font-sans font-medium border-t border-border-subtle pt-12 flex items-center justify-center gap-4">
              <ChevronRight size={12} />
              View Evidence & Reasoning
            </button>
          </div>

          {/* ── DETAIL TABS ── */}
          <div className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
            <div className="border-b border-border-subtle flex px-16">
              {[
                { id: "email", label: "Email" },
                { id: "entities", label: "Entities" },
                { id: "sap-data", label: "SAP Data" },
                { id: "change-analysis", label: "Change Analysis" },
                { id: "knowledge-graph", label: "Knowledge Graph" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDetailTab(tab.id)}
                  className={cn(
                    "px-12 py-10 border-none bg-transparent cursor-pointer font-sans text-caption -mb-px",
                    detailTab === tab.id
                      ? "font-bold text-text-primary border-b-2 border-brand"
                      : "font-medium text-text-tertiary border-b-2 border-transparent",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="p-20 text-body text-text-secondary leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
              {detailTab === "email"
                ? (selected.email?.body || "Email content not available. Agent processed this item automatically.")
                : `${
                    { entities: "Entities", "sap-data": "SAP Data", "change-analysis": "Change Analysis", "knowledge-graph": "Knowledge Graph" }[detailTab] ?? detailTab
                  } — coming soon.`
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helper components ────────────────────────────────────────────── */

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-label font-bold uppercase tracking-widest text-text-tertiary mb-px">
        {label}
      </div>
      <div className="text-caption font-medium text-text-secondary">
        {children}
      </div>
    </div>
  );
}
