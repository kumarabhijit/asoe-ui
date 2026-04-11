/**
 * Customer Inbox — AI-powered email triage and classification.
 *
 * Rich two-pane layout: 380px inbox queue + detail panel.
 * Refactored to use shared component library while preserving
 * the original visual design.
 */
"use client";

import { useState } from "react";
import {
  Mail, ChevronRight, Search, Zap, CheckCircle2,
  Clock, FileText, AlertTriangle, RefreshCw,
} from "lucide-react";
import { NavBar } from "@/components/ui/NavBar";
import { MetricTile } from "@/components/ui/MetricTile";
import { Badge, categoryVariant, inboxStatusVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

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
  const [selectedId, setSelectedId] = useState("1");
  const [activeTab, setActiveTab] = useState("inbox");
  const [detailTab, setDetailTab] = useState("email");

  const selected = INBOX.find((i) => i.id === selectedId) || INBOX[0];
  const needsAttention = INBOX.filter((i) => i.status === "NEEDS_APPROVAL" || i.status === "ESCALATED").length;
  const autoResolved = INBOX.filter((i) => i.status === "AUTO_RESOLVED").length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-surface-page)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--font-size-body)",
        color: "var(--color-text-primary)",
        lineHeight: 1.5,
      }}
    >
      {/* ── NAV BAR (shared component) ── */}
      <NavBar
        tabs={NAV_TABS}
        activeTab="inbox"
        onTabChange={(id) => {
          const tab = NAV_TABS.find((t) => t.id === id);
          if (tab?.href) window.location.href = tab.href;
        }}
        userName="Jane Doe"
        userInitials="JD"
        agentCount={3}
      />

      {/* ── PAGE HEADER ── */}
      <div
        style={{
          background: "var(--color-surface-primary)",
          borderBottom: "1px solid var(--color-border-default)",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 var(--space-32)" }}>
          {/* Breadcrumb */}
          <div style={{ padding: "var(--space-8) 0" }}>
            <span style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-tertiary)" }}>Home</span>
            <ChevronRight size={10} style={{ margin: "0 var(--space-4)", color: "var(--color-text-tertiary)", verticalAlign: "middle" }} />
            <span style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-secondary)" }}>Customer Inbox</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-8) 0 var(--space-16)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-text-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mail size={20} color="var(--color-text-inverse)" />
              </div>
              <div>
                <h1 style={{ fontSize: "var(--font-size-display)", fontWeight: 700, lineHeight: 1.15, margin: 0 }}>
                  Customer Inbox
                </h1>
                <span style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-tertiary)" }}>
                  AI-powered email triage and classification
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-8)" }}>
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

      {/* ── METRICS STRIP ── */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "var(--space-16) var(--space-32)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--space-16)",
          }}
        >
          <MetricTile icon={<Mail size={20} />} label="Total Inbound" value={String(INBOX.length)} subtitle="Last 24 hours" tint="var(--color-cat-blue)" />
          <MetricTile icon={<AlertTriangle size={20} />} label="Need Attention" value={String(needsAttention)} subtitle="Approval or escalation" tint="var(--color-warning)" />
          <MetricTile icon={<CheckCircle2 size={20} />} label="Auto-Resolved" value={String(autoResolved)} subtitle="No human action needed" tint="var(--color-success)" />
          <MetricTile icon={<Zap size={20} />} label="Avg Response" value="< 2m" subtitle="Agent classification time" tint="var(--color-cat-teal)" />
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 var(--space-32)" }}>
        <div style={{ borderBottom: "1px solid var(--color-border-default)", display: "flex", gap: 0 }}>
          {[
            { id: "inbox", label: "Inbox", count: INBOX.length },
            { id: "ai-flow", label: "AI Intake Flow", count: undefined },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "var(--space-10) var(--space-16)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--font-size-body)",
                fontWeight: activeTab === tab.id ? 700 : 600,
                color: activeTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                borderBottom: activeTab === tab.id ? "2px solid var(--color-brand)" : "2px solid transparent",
                marginBottom: -1,
                display: "flex",
                alignItems: "center",
                gap: "var(--space-6)",
                transition: "all var(--dur-fast)",
              }}
            >
              {tab.label}
              {tab.count != null && (
                <span
                  style={{
                    fontSize: "var(--font-size-caption)",
                    fontWeight: 600,
                    color: "var(--color-text-tertiary)",
                    background: "var(--color-surface-secondary)",
                    padding: "1px 6px",
                    borderRadius: "var(--radius-full)",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT: QUEUE + DETAIL PANEL ── */}
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "var(--space-16) var(--space-32)",
          display: "flex",
          gap: "var(--space-16)",
        }}
      >
        {/* ── LEFT: Inbox Queue ── */}
        <div
          style={{
            width: 380,
            flexShrink: 0,
            background: "var(--color-surface-primary)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
          }}
        >
          {/* Search */}
          <div
            style={{
              padding: "var(--space-12) var(--space-16)",
              borderBottom: "1px solid var(--color-border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-8)",
            }}
          >
            <Search size={16} style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
            <span style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-tertiary)" }}>
              Search inbox...
            </span>
            <div style={{ flex: 1 }} />
            <span
              style={{
                fontSize: "var(--font-size-label)",
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "var(--color-text-tertiary)",
                textTransform: "uppercase",
              }}
            >
              All Inboxes
            </span>
          </div>

          {/* Inbox items */}
          <div style={{ maxHeight: "calc(100vh - 370px)", overflowY: "auto" }}>
            {INBOX.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(item.id); }}
                  style={{
                    padding: "var(--space-12) var(--space-16)",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--color-border-subtle)",
                    background: isSelected ? "var(--color-surface-secondary)" : "var(--color-surface-primary)",
                    borderLeft: isSelected ? "3px solid var(--color-brand)" : "3px solid transparent",
                    transition: "background var(--dur-fast)",
                  }}
                >
                  <div style={{ display: "flex", gap: "var(--space-10)" }}>
                    {/* Avatar */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius-full)",
                        flexShrink: 0,
                        background: `color-mix(in srgb, ${item.initialsColor} 15%, white)`,
                        color: item.initialsColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "var(--font-size-caption)",
                        fontWeight: 700,
                      }}
                    >
                      {item.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: "var(--font-size-body)", color: "var(--color-text-primary)" }}>
                          {item.sender}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--font-size-caption)",
                            color: "var(--color-text-tertiary)",
                            fontFamily: "var(--font-mono)",
                            flexShrink: 0,
                          }}
                        >
                          {item.time}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "var(--font-size-body)",
                          fontWeight: 500,
                          color: "var(--color-text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginBottom: "var(--space-4)",
                        }}
                      >
                        {item.subject}
                      </div>
                      <div
                        style={{
                          fontSize: "var(--font-size-caption)",
                          color: "var(--color-text-tertiary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginBottom: "var(--space-8)",
                        }}
                      >
                        {item.preview}
                      </div>
                      {/* Badges */}
                      <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", alignItems: "center" }}>
                        <Badge variant={categoryVariant(item.category)} size="sm" icon={null}>
                          {CATEGORY_LABELS[item.category] ?? item.category}
                        </Badge>
                        <Badge variant={inboxStatusVariant(item.status)} size="sm">
                          {STATUS_LABELS[item.status] ?? item.status}
                        </Badge>
                        {item.lineCount && (
                          <span
                            style={{
                              fontSize: "var(--font-size-label)",
                              color: "var(--color-text-tertiary)",
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-16)" }}>
          {/* Email Header Card */}
          <div
            style={{
              background: "var(--color-surface-primary)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-sm)",
              padding: "var(--space-20)",
            }}
          >
            <div style={{ display: "flex", gap: "var(--space-12)", marginBottom: "var(--space-16)" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "var(--radius-full)",
                  flexShrink: 0,
                  background: `color-mix(in srgb, ${selected.initialsColor} 15%, white)`,
                  color: selected.initialsColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "var(--font-size-subhead)",
                  fontWeight: 700,
                }}
              >
                {selected.initials}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: "var(--font-size-heading)", fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                  {selected.subject}
                </h2>
                <div style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-secondary)", marginTop: 2 }}>
                  {selected.sender}{" "}
                  {selected.email && (
                    <span style={{ color: "var(--color-text-tertiary)" }}>
                      &lt;{selected.email.from}&gt; · {selected.email.org} · {selected.email.received}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Metadata badges */}
            <div style={{ display: "flex", gap: "var(--space-6)", flexWrap: "wrap", alignItems: "center" }}>
              <Badge variant={categoryVariant(selected.category)} size="sm" icon={null}>
                {CATEGORY_LABELS[selected.category] ?? selected.category}
              </Badge>
              <Badge variant={inboxStatusVariant(selected.status)} size="sm">
                {STATUS_LABELS[selected.status] ?? selected.status}
              </Badge>
              {selected.amount && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--font-size-body)", fontWeight: 600, color: "var(--color-text-primary)" }}>
                  {selected.amount}
                </span>
              )}
            </div>
            {/* Source metadata row */}
            {selected.email && (
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-32)",
                  marginTop: "var(--space-16)",
                  padding: "var(--space-12) var(--space-16)",
                  background: "var(--color-surface-secondary)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <MetaField label="Source Mailbox">
                  <span style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-success)", flexShrink: 0 }} />
                    {selected.email.mailbox}
                  </span>
                </MetaField>
                <MetaField label="Received">
                  <span style={{ fontFamily: "var(--font-mono)" }}>{selected.email.received}</span>
                </MetaField>
                <MetaField label="Attachments">
                  <span style={{ color: "var(--color-text-tertiary)" }}>None</span>
                </MetaField>
              </div>
            )}
          </div>

          {/* ── AGENT REASONING CARD (Layer 1 — always visible) ── */}
          <div
            style={{
              background: "var(--color-surface-primary)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-md)",
              padding: "var(--space-20)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", marginBottom: "var(--space-12)" }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Zap size={14} style={{ color: "var(--color-text-secondary)" }} />
              </div>
              <span style={{ fontWeight: 600, fontSize: "var(--font-size-subhead)", color: "var(--color-text-primary)" }}>
                Agent Analysis
              </span>
              <div style={{ flex: 1 }} />
              {selected.agentConfidence && (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
                  <div
                    style={{
                      width: 80,
                      height: 4,
                      borderRadius: "var(--radius-full)",
                      background: "var(--color-surface-secondary)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${selected.agentConfidence}%`,
                        height: "100%",
                        borderRadius: "var(--radius-full)",
                        background: "var(--color-text-secondary)",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--font-size-caption)",
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {selected.agentConfidence}%
                  </span>
                </div>
              )}
            </div>
            <p
              style={{
                fontSize: "var(--font-size-body)",
                color: "var(--color-text-secondary)",
                lineHeight: 1.6,
                margin: "0 0 var(--space-12)",
              }}
            >
              {selected.agentSummary}
            </p>
            <div style={{ display: "flex", gap: "var(--space-8)", alignItems: "center" }}>
              <div
                style={{
                  padding: "var(--space-4) var(--space-10)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface-secondary)",
                  fontSize: "var(--font-size-caption)",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                }}
              >
                {selected.agentRecommendation}
              </div>
              <div style={{ flex: 1 }} />
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
            <button
              style={{
                marginTop: "var(--space-12)",
                width: "100%",
                padding: "var(--space-8) 0",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "var(--font-size-caption)",
                color: "var(--color-text-tertiary)",
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                borderTop: "1px solid var(--color-border-subtle)",
                paddingTop: "var(--space-12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-4)",
              }}
            >
              <ChevronRight size={12} />
              View Evidence & Reasoning
            </button>
          </div>

          {/* ── DETAIL TABS ── */}
          <div
            style={{
              background: "var(--color-surface-primary)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-sm)",
              overflow: "hidden",
            }}
          >
            <div style={{ borderBottom: "1px solid var(--color-border-subtle)", display: "flex", padding: "0 var(--space-16)" }}>
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
                  style={{
                    padding: "var(--space-10) var(--space-12)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--font-size-caption)",
                    fontWeight: detailTab === tab.id ? 700 : 500,
                    color: detailTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                    borderBottom: detailTab === tab.id ? "2px solid var(--color-brand)" : "2px solid transparent",
                    marginBottom: -1,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* Content */}
            <div
              style={{
                padding: "var(--space-20)",
                fontSize: "var(--font-size-body)",
                color: "var(--color-text-secondary)",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                maxHeight: 300,
                overflowY: "auto",
              }}
            >
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
      <div
        style={{
          fontSize: "var(--font-size-label)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-text-tertiary)",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "var(--font-size-caption)", fontWeight: 500, color: "var(--color-text-secondary)" }}>
        {children}
      </div>
    </div>
  );
}
