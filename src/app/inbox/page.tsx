"use client";

import { useState } from "react";
import {
  Layers, Mail, AlertTriangle, BarChart3, Settings, Shield,
  ChevronRight, Search, Zap, CheckCircle2, Clock, Package,
  FileText, ArrowUpRight, Activity, RefreshCw, User,
} from "lucide-react";

/* ── ASOE Design Tokens (inline for self-contained page) ─────────── */
const T = {
  brand: "var(--color-brand)", brandHover: "var(--color-brand-hover)",
  surfacePage: "var(--color-surface-page)", surfacePrimary: "var(--color-surface-primary)",
  surfaceSecondary: "var(--color-surface-secondary)", surfaceGlass: "var(--color-surface-glass)",
  textPrimary: "var(--color-text-primary)", textSecondary: "var(--color-text-secondary)",
  textTertiary: "var(--color-text-tertiary)", textQuaternary: "var(--color-text-quaternary)",
  textInverse: "var(--color-text-inverse)",
  borderDefault: "var(--color-border-default)", borderSubtle: "var(--color-border-subtle)",
  borderStrong: "var(--color-border-strong)",
  success: "var(--color-success)", successSubtle: "var(--color-success-subtle)",
  warning: "var(--color-warning)", warningSubtle: "var(--color-warning-subtle)",
  error: "var(--color-error)", errorSubtle: "var(--color-error-subtle)",
  catPurple: "var(--color-cat-purple)", catPurpleSubtle: "var(--color-cat-purple-subtle)",
  catTeal: "var(--color-cat-teal)", catTealSubtle: "var(--color-cat-teal-subtle)",
  catAmber: "var(--color-cat-amber)", catAmberSubtle: "var(--color-cat-amber-subtle)",
  catRose: "var(--color-cat-rose)", catRoseSubtle: "var(--color-cat-rose-subtle)",
  catSlate: "var(--color-cat-slate)", catSlateSubtle: "var(--color-cat-slate-subtle)",
  shadowSm: "var(--shadow-sm)", shadowMd: "var(--shadow-md)", shadowLg: "var(--shadow-lg)",
  radiusSm: "var(--radius-sm)", radiusMd: "var(--radius-md)", radiusLg: "var(--radius-lg)",
  radiusFull: "var(--radius-full)",
  sans: "var(--font-sans)", mono: "var(--font-mono)",
};

/* ── Data ─────────────────────────────────────────────────────────── */
const CATEGORIES: Record<string, { label: string; color: string; bg: string }> = {
  ORDER_CHANGE:     { label: "Order Change",      color: T.catPurple,  bg: T.catPurpleSubtle },
  SHIPMENT_INQUIRY: { label: "Shipment Inquiry",  color: T.catTeal,    bg: T.catTealSubtle },
  NEW_ORDER:        { label: "New Order",          color: T.success,    bg: T.successSubtle },
  COMPLAINT:        { label: "Complaint",          color: T.error,      bg: T.errorSubtle },
  INVOICE_QUERY:    { label: "Invoice Query",      color: T.catAmber,   bg: T.catAmberSubtle },
};

const STATUSES: Record<string, { label: string; color: string; bg: string }> = {
  NEEDS_APPROVAL: { label: "Needs Approval",  color: T.warning,   bg: T.warningSubtle },
  IN_QUEUE:       { label: "In Queue",         color: T.catSlate,  bg: T.catSlateSubtle },
  AUTO_RESOLVED:  { label: "Auto-Resolved",    color: T.success,   bg: T.successSubtle },
  ESCALATED:      { label: "Escalated",        color: T.error,     bg: T.errorSubtle },
  ANALYZING:      { label: "Agent Analyzing",  color: T.catTeal,   bg: T.catTealSubtle },
};

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

/* ── Small components ─────────────────────────────────────────────── */
function Badge({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
      borderRadius: T.radiusSm, background: bg, color, fontSize: 10, fontWeight: 700,
      letterSpacing: "0.02em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const,
      border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`, lineHeight: 1.3,
    }}>{children}</span>
  );
}

function StatusDot({ color }: { color: string }) {
  return <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

function MetricTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: T.surfacePrimary, borderRadius: T.radiusMd, boxShadow: T.shadowSm,
      padding: 20, display: "flex", gap: 16, alignItems: "flex-start",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: T.radiusMd, background: T.surfaceSecondary,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        color: T.textSecondary,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: T.textTertiary, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: T.mono, color: T.textPrimary, lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ color: T.textTertiary, fontSize: 11, marginTop: 5, fontWeight: 500 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────── */
export default function InboxPage() {
  const [selectedId, setSelectedId] = useState("1");
  const [activeTab, setActiveTab] = useState("inbox");
  const [detailTab, setDetailTab] = useState("email");

  const selected = INBOX.find((i) => i.id === selectedId) || INBOX[0];
  const cat = CATEGORIES[selected.category];
  const needsAttention = INBOX.filter((i) => i.status === "NEEDS_APPROVAL" || i.status === "ESCALATED").length;
  const autoResolved = INBOX.filter((i) => i.status === "AUTO_RESOLVED").length;

  return (
    <div style={{ minHeight: "100vh", background: T.surfacePage, fontFamily: T.sans, fontSize: 13, color: T.textPrimary, lineHeight: 1.5 }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        .inbox-row:hover{background:var(--color-surface-row-hover)!important}
      `}</style>

      {/* ── NAV BAR ── */}
      <div style={{
        background: T.surfaceGlass, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        height: 56, display: "flex", alignItems: "center", padding: "0 24px",
        position: "sticky", top: 0, zIndex: 100, borderBottom: `1px solid ${T.borderSubtle}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 32 }}>
          <div style={{ width: 32, height: 32, borderRadius: T.radiusMd, background: T.brand, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Layers size={18} color={T.textInverse} strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: T.textPrimary }}>ASOE</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { n: "Customer Inbox", icon: <Mail size={14} />, active: true },
            { n: "Exception Queue", icon: <AlertTriangle size={14} />, active: false },
            { n: "Quota Mgmt", icon: <Package size={14} />, active: false },
            { n: "Insights", icon: <BarChart3 size={14} />, active: false },
            { n: "Performance", icon: <Activity size={14} />, active: false },
          ].map((item) => (
            <button key={item.n} style={{
              padding: "6px 14px", borderRadius: T.radiusSm, border: "none",
              background: item.active ? T.surfaceSecondary : "transparent",
              color: item.active ? T.textPrimary : T.textTertiary,
              fontSize: 13, fontWeight: item.active ? 600 : 500, cursor: "pointer",
              fontFamily: T.sans, display: "flex", alignItems: "center", gap: 6,
            }}>{item.icon}{item.n}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-success)", animation: "pulse 1.4s ease-in-out infinite" }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: T.textTertiary }}>Agent Live</span>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: T.radiusFull, background: T.surfaceSecondary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: T.textSecondary }}>
            JD
          </div>
        </div>
      </div>

      {/* ── PAGE HEADER ── */}
      <div style={{ background: T.surfacePrimary, borderBottom: `1px solid ${T.borderDefault}`, boxShadow: "var(--shadow-xs)" }}>
        <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 32px" }}>
          <div style={{ padding: "8px 0" }}>
            <span style={{ fontSize: 12, color: T.textTertiary }}>Home</span>
            <span style={{ fontSize: 12, color: T.textTertiary, margin: "0 4px" }}>›</span>
            <span style={{ fontSize: 12, color: T.textSecondary }}>Customer Inbox</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: T.radiusMd, background: T.textPrimary, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Mail size={20} color={T.textInverse} />
              </div>
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.15, margin: 0 }}>Customer Inbox</h1>
                <span style={{ fontSize: 12, color: T.textTertiary }}>AI-powered email triage and classification</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ padding: "8px 16px", borderRadius: T.radiusMd, border: `1px solid ${T.borderDefault}`, background: T.surfacePrimary, color: T.textSecondary, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: T.sans, display: "flex", alignItems: "center", gap: 6 }}>
                <RefreshCw size={14} />Refresh
              </button>
              <button style={{ padding: "8px 16px", borderRadius: T.radiusMd, border: "none", background: T.brand, color: T.textInverse, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: T.sans, display: "flex", alignItems: "center", gap: 6 }}>
                <Zap size={14} />Process All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── METRICS STRIP ── */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "16px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <MetricTile icon={<Mail size={20} />} label="Total Inbound" value={String(INBOX.length)} sub="Last 24 hours" />
          <MetricTile icon={<AlertTriangle size={20} />} label="Need Attention" value={String(needsAttention)} sub="Approval or escalation" />
          <MetricTile icon={<CheckCircle2 size={20} />} label="Auto-Resolved" value={String(autoResolved)} sub="No human action needed" />
          <MetricTile icon={<Zap size={20} />} label="Avg Response" value="< 2m" sub="Agent classification time" />
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 32px" }}>
        <div style={{ borderBottom: `1px solid ${T.borderDefault}`, display: "flex", gap: 0 }}>
          {[
            { id: "inbox", label: "Inbox", count: INBOX.length },
            { id: "ai-flow", label: "AI Intake Flow", count: undefined },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "10px 18px", border: "none", background: "transparent", cursor: "pointer",
              fontFamily: T.sans, fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 600,
              color: activeTab === tab.id ? T.textPrimary : T.textTertiary,
              borderBottom: activeTab === tab.id ? `2px solid ${T.brand}` : "2px solid transparent",
              marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
              transition: "all 0.1s ease",
            }}>
              {tab.label}
              {tab.count != null && (
                <span style={{ fontSize: 11, fontWeight: 600, color: T.textTertiary, background: T.surfaceSecondary, padding: "1px 6px", borderRadius: T.radiusFull }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT: QUEUE + SIDEBAR ── */}
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "16px 32px", display: "flex", gap: 16 }}>

        {/* ── LEFT: Inbox Queue ── */}
        <div style={{ width: 380, flexShrink: 0, background: T.surfacePrimary, borderRadius: T.radiusMd, boxShadow: T.shadowSm, overflow: "hidden" }}>
          {/* Search */}
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.borderSubtle}`, display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={16} style={{ color: T.textTertiary, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: T.textTertiary }}>Search inbox...</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: T.textTertiary, textTransform: "uppercase" as const }}>All Inboxes</span>
          </div>

          {/* Inbox items */}
          <div style={{ maxHeight: "calc(100vh - 370px)", overflowY: "auto" }}>
            {INBOX.map((item) => {
              const isSelected = item.id === selectedId;
              const itemCat = CATEGORIES[item.category];
              const itemStatus = STATUSES[item.status];
              return (
                <div
                  key={item.id}
                  className="inbox-row"
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    padding: "14px 16px", cursor: "pointer",
                    borderBottom: `1px solid ${T.borderSubtle}`,
                    background: isSelected ? T.surfaceSecondary : T.surfacePrimary,
                    borderLeft: isSelected ? `3px solid ${T.brand}` : "3px solid transparent",
                    transition: "background 0.1s ease",
                  }}
                >
                  <div style={{ display: "flex", gap: 10 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: T.radiusFull, flexShrink: 0,
                      background: `color-mix(in srgb, ${item.initialsColor} 15%, white)`,
                      color: item.initialsColor, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                    }}>{item.initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: T.textPrimary }}>{item.sender}</span>
                        <span style={{ fontSize: 11, color: T.textTertiary, fontFamily: T.mono, flexShrink: 0 }}>{item.time}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: T.textPrimary, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{item.subject}</div>
                      <div style={{ fontSize: 12, color: T.textTertiary, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", marginBottom: 8 }}>{item.preview}</div>
                      {/* Badges */}
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, alignItems: "center" }}>
                        {itemCat && <Badge color={itemCat.color} bg={itemCat.bg}>{itemCat.label}</Badge>}
                        {itemStatus && <Badge color={itemStatus.color} bg={itemStatus.bg}>{itemStatus.label}</Badge>}
                        {item.lineCount && (
                          <span style={{ fontSize: 10, color: T.textTertiary, display: "flex", alignItems: "center", gap: 3 }}>
                            <FileText size={10} />{item.lineCount}
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

        {/* ── RIGHT: Detail Sidebar ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Email Header Card */}
          <div style={{ background: T.surfacePrimary, borderRadius: T.radiusMd, boxShadow: T.shadowSm, padding: 20 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: T.radiusFull, flexShrink: 0,
                background: `color-mix(in srgb, ${selected.initialsColor} 15%, white)`,
                color: selected.initialsColor, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 700,
              }}>{selected.initials}</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{selected.subject}</h2>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
                  {selected.sender} {selected.email && <span style={{ color: T.textTertiary }}>&lt;{selected.email.from}&gt;</span>}
                  {selected.email && <span style={{ color: T.textTertiary }}> · {selected.email.org} · {selected.email.received}</span>}
                </div>
              </div>
            </div>
            {/* Metadata badges */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
              {cat && <Badge color={cat.color} bg={cat.bg}>{cat.label}</Badge>}
              {STATUSES[selected.status] && <Badge color={STATUSES[selected.status].color} bg={STATUSES[selected.status].bg}>{STATUSES[selected.status].label}</Badge>}
              {selected.amount && (
                <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{selected.amount}</span>
              )}
            </div>
            {/* Source metadata row */}
            {selected.email && (
              <div style={{ display: "flex", gap: 32, marginTop: 16, padding: "12px 16px", background: T.surfaceSecondary, borderRadius: T.radiusSm }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: T.textTertiary, marginBottom: 2 }}>Source Mailbox</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary, display: "flex", alignItems: "center", gap: 4 }}>
                    <StatusDot color="var(--color-success)" />{selected.email.mailbox}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: T.textTertiary, marginBottom: 2 }}>Received</div>
                  <div style={{ fontSize: 12, fontWeight: 500, fontFamily: T.mono, color: T.textSecondary }}>{selected.email.received}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: T.textTertiary, marginBottom: 2 }}>Attachments</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: T.textTertiary }}>None</div>
                </div>
              </div>
            )}
          </div>

          {/* ── AGENT REASONING CARD (Layer 1 — always visible) ── */}
          <div style={{ background: T.surfacePrimary, borderRadius: T.radiusMd, boxShadow: T.shadowMd, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: T.radiusSm, background: T.surfaceSecondary, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap size={14} style={{ color: T.textSecondary }} />
              </div>
              <span style={{ fontWeight: 600, fontSize: 14, color: T.textPrimary }}>Agent Analysis</span>
              <div style={{ flex: 1 }} />
              {selected.agentConfidence && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 80, height: 4, borderRadius: T.radiusFull, background: T.surfaceSecondary, overflow: "hidden" }}>
                    <div style={{ width: `${selected.agentConfidence}%`, height: "100%", borderRadius: T.radiusFull, background: T.textSecondary }} />
                  </div>
                  <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.textPrimary }}>{selected.agentConfidence}%</span>
                </div>
              )}
            </div>
            <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6, margin: "0 0 12px" }}>{selected.agentSummary}</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ padding: "4px 10px", borderRadius: T.radiusSm, background: T.surfaceSecondary, fontSize: 12, fontWeight: 600, color: T.textSecondary }}>
                {selected.agentRecommendation}
              </div>
              <div style={{ flex: 1 }} />
              {selected.status === "NEEDS_APPROVAL" && (
                <>
                  <button style={{ padding: "6px 12px", borderRadius: T.radiusMd, border: "none", background: T.brand, color: T.textInverse, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.sans, display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={12} />Approve
                  </button>
                  <button style={{ padding: "6px 12px", borderRadius: T.radiusMd, border: `1px solid ${T.borderDefault}`, background: T.surfacePrimary, color: T.textSecondary, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.sans }}>
                    Override
                  </button>
                  <button style={{ padding: "6px 12px", borderRadius: T.radiusMd, border: "none", background: "transparent", color: T.textTertiary, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.sans }}>
                    Escalate
                  </button>
                </>
              )}
            </div>
            {/* Layer 2 trigger */}
            <button style={{
              marginTop: 12, width: "100%", padding: "8px 0", border: "none", background: "transparent",
              cursor: "pointer", fontSize: 11, color: T.textTertiary, fontFamily: T.sans, fontWeight: 500,
              borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 12,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}>
              <ChevronRight size={12} />View Evidence & Reasoning
            </button>
          </div>

          {/* ── DETAIL TABS ── */}
          <div style={{ background: T.surfacePrimary, borderRadius: T.radiusMd, boxShadow: T.shadowSm, overflow: "hidden" }}>
            <div style={{ borderBottom: `1px solid ${T.borderSubtle}`, display: "flex", padding: "0 16px" }}>
              {["email", "entities", "sap-data", "change-analysis", "knowledge-graph"].map((tab) => {
                const labels: Record<string, string> = { email: "Email", entities: "Entities", "sap-data": "SAP Data", "change-analysis": "Change Analysis", "knowledge-graph": "Knowledge Graph" };
                return (
                  <button key={tab} onClick={() => setDetailTab(tab)} style={{
                    padding: "10px 14px", border: "none", background: "transparent", cursor: "pointer",
                    fontFamily: T.sans, fontSize: 12, fontWeight: detailTab === tab ? 700 : 500,
                    color: detailTab === tab ? T.textPrimary : T.textTertiary,
                    borderBottom: detailTab === tab ? `2px solid ${T.brand}` : "2px solid transparent",
                    marginBottom: -1,
                  }}>{labels[tab]}</button>
                );
              })}
            </div>
            {/* Email body */}
            <div style={{ padding: 20, fontSize: 13, color: T.textSecondary, lineHeight: 1.7, whiteSpace: "pre-wrap" as const, maxHeight: 300, overflowY: "auto" }}>
              {selected.email?.body || "Email content not available. Agent processed this item automatically."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
