import { useState } from "react";
import {
  Search, RefreshCw, Zap, ChevronRight, X,
  CircleDot, Clock, Radio, Settings, FileText, Package,
  TrendingDown, AlertTriangle, CheckCircle2, Layers,
  BarChart3, Activity, Shield, ExternalLink,
  ArrowUpRight, Check, Box
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════════════════
   ASOE DESIGN SYSTEM — SAMPLE SCREEN v2
   Exception Resolution Queue — Blue Restraint Pass
   
   Rule: Brand blue (#007AFF) appears ONLY on primary CTA buttons, 
   the nav logo mark, and the active tab indicator. Nothing else.
   ══════════════════════════════════════════════════════════════════════════════ */

const T = {
  brand: "#007AFF", brandHover: "#0066D6",
  surfacePage: "#F8FAFC", surfacePrimary: "#FFFFFF", surfaceSecondary: "#F1F5F9",
  surfaceTertiary: "#E2E8F0", surfaceGlass: "rgba(255,255,255,0.72)",
  rowHover: "#F8FAFC", rowSelected: "#F8FAFC",
  textPrimary: "#0F172A", textSecondary: "#475569", textTertiary: "#94A3B8",
  textQuaternary: "#CBD5E1", textInverse: "#FFFFFF",
  borderDefault: "#E2E8F0", borderSubtle: "#F1F5F9", borderStrong: "#CBD5E1",
  success: "#16A34A", successSubtle: "#F0FDF4",
  warning: "#D97706", warningSubtle: "#FFFBEB",
  error: "#DC2626", errorSubtle: "#FEF2F2",
  catPurple: "#7C3AED", catPurpleSubtle: "#F5F3FF",
  catTeal: "#0D9488", catTealSubtle: "#F0FDFA",
  catAmber: "#D97706", catAmberSubtle: "#FFFBEB",
  catRose: "#E11D48", catRoseSubtle: "#FFF1F2",
  catSlate: "#64748B", catSlateSubtle: "#F8FAFC",
  shadowSm: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08)",
  shadowLg: "0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)",
  radiusSm: 6, radiusMd: 10, radiusLg: 14, radiusFull: 9999,
  sans: "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif",
  mono: "'SF Mono', 'JetBrains Mono', ui-monospace, monospace",
};

const CAUSES = {
  PROMO_EXPIRED:  { label: "Promo Expired",     color: T.catAmber,  bg: T.catAmberSubtle, Icon: Clock },
  ERP_NOT_LOADED: { label: "ERP Not Loaded",    color: T.error,     bg: T.errorSubtle,    Icon: AlertTriangle },
  MASTER_DATA:    { label: "Master Data Error",  color: T.catPurple, bg: T.catPurpleSubtle, Icon: Settings },
  CONTRACT_GAP:   { label: "Contract Gap",       color: T.catTeal,   bg: T.catTealSubtle,  Icon: FileText },
  EDI_MISMATCH:   { label: "EDI Mismatch",       color: T.catTeal,   bg: T.catTealSubtle,  Icon: Radio },
  UOM_ERROR:      { label: "UOM Mismatch",       color: T.catRose,   bg: T.catRoseSubtle,  Icon: Package },
};

const RESOLUTIONS = {
  AUTO_OVERRIDE:  { label: "Auto-Override",   color: T.success, bg: T.successSubtle },
  ESCALATE_SALES: { label: "Escalate → Sales", color: T.catAmber, bg: T.catAmberSubtle },
  ESCALATE_TRADE: { label: "Escalate → Trade", color: T.catPurple, bg: T.catPurpleSubtle },
  MANUAL_REVIEW:  { label: "Manual Review",    color: T.catSlate, bg: T.catSlateSubtle },
};

const ORDERS = [
  { id: "PO-88421", customer: "Walmart", region: "Southeast", status: "ANALYZED",
    lines: [
      { id: "L1", sku: "SKU-0042", desc: "12-pk Cola",        qty: 240, uom: "CS", erp: 14.88, po: 13.20, cause: "PROMO_EXPIRED" },
      { id: "L2", sku: "SKU-0043", desc: "12-pk Diet Cola",   qty: 120, uom: "CS", erp: 14.88, po: 13.20, cause: "PROMO_EXPIRED" },
      { id: "L3", sku: "SKU-0051", desc: "12-pk Zero Sugar",  qty: 96,  uom: "CS", erp: 14.88, po: 14.90, cause: "EDI_MISMATCH" },
    ],
    analysis: {
      diagnosis: "Two line items reference promo pricing from an expired Q4 trade promotion (ZPROM condition valid through 12/31). One line has a $0.02 EDI rounding variance within tolerance. Recommend auto-override for the rounding and promo reload for the expired conditions.",
      confidence: 92, risk: "MEDIUM", resolution: "AUTO_OVERRIDE",
      lines: [
        { lineId: "L1", diagnosis: "TPR discount ZPROM expired 12/31. PO reflects promo price $13.20 but ERP reverted to base $14.88.", resolution: "AUTO_OVERRIDE", risk: "MEDIUM",
          waterfall: [
            { type: "BASE", label: "Base Price (PR00)", record: "PR00/10", value: 14.88, running: 14.88, detail: "SAP list price, material group 042, effective 01/01/2025" },
            { type: "CONTRACT", label: "Contract Price (ZA01)", record: "ZA01/620", value: 0, running: 14.88, detail: "Active contract #4600012840 — no additional discount at this tier" },
            { type: "TPR", label: "Trade Promo (ZPROM)", record: "ZPROM/155", value: -1.68, running: 13.20, detail: "Q4 promo: 11.3% off-invoice. Valid 10/01–12/31/2025." },
            { type: "ERROR", label: "Promo Validity Check", record: "ZPROM/155", value: null, running: null, detail: "Condition expired 12/31/2025. Current date outside validity.", error: "Promotional condition expired. PO $13.20 reflects promo price, ERP $14.88 reflects reverted base. Delta: -$1.68/unit." },
            { type: "RESULT", label: "ERP Computed Price", record: "—", value: 14.88, running: 14.88, detail: "Final ERP price after condition chain (promo excluded)" },
          ]
        },
        { lineId: "L2", diagnosis: "Same expired ZPROM condition as L1. Identical root cause.", resolution: "AUTO_OVERRIDE", risk: "MEDIUM", waterfall: [] },
        { lineId: "L3", diagnosis: "EDI transmission rounding: $14.90 vs $14.88. Within ±$0.05 tolerance.", resolution: "AUTO_OVERRIDE", risk: "LOW", waterfall: [] },
      ]
    }
  },
  { id: "PO-88422", customer: "Kroger", region: "Midwest", status: "HOLD",
    lines: [
      { id: "L1", sku: "SKU-1180", desc: "24-pk Water",     qty: 500, uom: "CS", erp: 9.60,  po: 9.62,  cause: "EDI_MISMATCH" },
      { id: "L2", sku: "SKU-1181", desc: "12-pk Sparkling", qty: 200, uom: "CS", erp: 11.40, po: 10.00, cause: "CONTRACT_GAP" },
    ], analysis: null
  },
  { id: "PO-88423", customer: "Target", region: "National", status: "HOLD",
    lines: [
      { id: "L1", sku: "SKU-3310", desc: "Snack Bar 48ct",   qty: 300, uom: "CS", erp: 28.44, po: 25.00, cause: "CONTRACT_GAP" },
      { id: "L2", sku: "SKU-3312", desc: "Protein Bar 36ct", qty: 150, uom: "CS", erp: 24.00, po: 21.50, cause: "PROMO_EXPIRED" },
      { id: "L3", sku: "SKU-3315", desc: "Granola Bar 60ct", qty: 80,  uom: "CS", erp: 32.00, po: 32.00, cause: "EDI_MISMATCH" },
      { id: "L4", sku: "SKU-3320", desc: "Kids Bar 24ct",    qty: 200, uom: "CS", erp: 18.00, po: 15.00, cause: "MASTER_DATA" },
    ], analysis: null
  },
  { id: "PO-88424", customer: "Costco", region: "West", status: "RESOLVED",
    lines: [
      { id: "L1", sku: "SKU-5521", desc: "Family Pack x6", qty: 180, uom: "CS", erp: 42.00, po: 36.00, cause: "UOM_ERROR" },
      { id: "L2", sku: "SKU-5525", desc: "Mega Pack x12",  qty: 90,  uom: "CS", erp: 82.00, po: 72.00, cause: "UOM_ERROR" },
    ], analysis: { diagnosis: "UOM conversion factor mismatch resolved.", confidence: 97, risk: "LOW", resolution: "AUTO_OVERRIDE", lines: [] }
  },
  { id: "PO-88425", customer: "Albertsons", region: "Southwest", status: "HOLD",
    lines: [
      { id: "L1", sku: "SKU-0099", desc: "Juice 1L x12", qty: 360, uom: "CS", erp: 19.20, po: 17.28, cause: "ERP_NOT_LOADED" },
    ], analysis: null
  },
  { id: "PO-88426", customer: "CVS", region: "Northeast", status: "HOLD",
    lines: [
      { id: "L1", sku: "SKU-7701", desc: "Energy Drink 4pk", qty: 480, uom: "CS", erp: 8.96,  po: 8.50, cause: "MASTER_DATA" },
      { id: "L2", sku: "SKU-7705", desc: "Energy Drink 8pk", qty: 240, uom: "CS", erp: 17.50, po: 16.00, cause: "MASTER_DATA" },
    ], analysis: null
  },
];

function enrichLine(l) { const delta = +(l.po - l.erp).toFixed(2); const pct = +(((l.po - l.erp) / l.erp) * 100).toFixed(1); return { ...l, delta, pct, totalErp: +(l.erp * l.qty).toFixed(2), totalPo: +(l.po * l.qty).toFixed(2) }; }
function orderStats(lines) { const e = lines.map(enrichLine); const totalErp = e.reduce((s, l) => s + l.totalErp, 0); const totalPo = e.reduce((s, l) => s + l.totalPo, 0); return { totalErp, totalPo, totalQty: e.reduce((s, l) => s + l.qty, 0), atRisk: e.reduce((s, l) => s + Math.abs(l.delta * l.qty), 0), flagged: e.filter(l => Math.abs(l.pct) > 1).length, pct: +(((totalPo - totalErp) / totalErp) * 100).toFixed(1) }; }
const fmtD = (n) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtP = (n) => `$${n.toFixed(2)}`;

function Badge({ color, bg, children, size = "sm" }) { const p = size === "xs" ? "1px 6px" : "2px 8px"; const fs = size === "xs" ? 9 : 10; return (<span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: p, borderRadius: T.radiusSm, background: bg || `${color}10`, color, fontSize: fs, fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", whiteSpace: "nowrap", border: `1px solid ${color}20`, lineHeight: 1.3 }}>{children}</span>); }
function StatusPill({ color, bg, children }) { return (<span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: T.radiusFull, background: bg, color, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", border: `1px solid ${color}25` }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />{children}</span>); }
function Btn({ variant = "neutral", size = "md", children, onClick, disabled, style: sx }) { const base = { brand: { bg: T.brand, c: T.textInverse, b: "none" }, neutral: { bg: T.surfacePrimary, c: T.textSecondary, b: `1px solid ${T.borderDefault}` }, success: { bg: T.success, c: T.textInverse, b: "none" }, ghost: { bg: "transparent", c: T.textTertiary, b: "none" }, destructive: { bg: T.error, c: T.textInverse, b: "none" } }[variant] || { bg: T.surfacePrimary, c: T.textSecondary, b: `1px solid ${T.borderDefault}` }; const sz = { sm: { p: "6px 12px", fs: 12 }, md: { p: "8px 16px", fs: 13 }, lg: { p: "10px 20px", fs: 14 } }[size]; return (<button onClick={onClick} disabled={disabled} style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, padding: sz.p, background: base.bg, color: base.c, border: base.b, borderRadius: T.radiusMd, fontSize: sz.fs, fontWeight: 600, fontFamily: T.sans, display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.1s ease", whiteSpace: "nowrap", lineHeight: 1.3, ...sx }}>{children}</button>); }
function MetricTile({ icon, iconBg, label, value, sub }) { return (<div style={{ background: T.surfacePrimary, borderRadius: T.radiusMd, boxShadow: T.shadowSm, padding: 20, display: "flex", gap: 16, alignItems: "flex-start" }}><div style={{ width: 40, height: 40, borderRadius: T.radiusMd, background: iconBg || T.surfaceSecondary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.textTertiary, marginBottom: 4 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 700, fontFamily: T.mono, color: T.textPrimary, lineHeight: 1.1, letterSpacing: "-0.01em" }}>{value}</div>{sub && <div style={{ color: T.textTertiary, fontSize: 11, marginTop: 5, fontWeight: 500 }}>{sub}</div>}</div></div>); }
function Card({ title, icon, action, children, noPad }) { return (<div style={{ background: T.surfacePrimary, borderRadius: T.radiusMd, boxShadow: T.shadowSm, overflow: "hidden" }}>{title && (<div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.borderSubtle}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}>{icon && <span style={{ color: T.textTertiary }}>{icon}</span>}<span style={{ fontWeight: 600, fontSize: 14, color: T.textPrimary }}>{title}</span></div>{action}</div>)}<div style={{ padding: noPad ? 0 : 20 }}>{children}</div></div>); }

function PricingWaterfall({ steps }) {
  if (!steps || steps.length === 0) return <div style={{ color: T.textTertiary, fontSize: 12, fontStyle: "italic", padding: "12px 0" }}>Waterfall data available after audit.</div>;
  const typeIcon = { BASE: <CircleDot size={14} />, CONTRACT: <FileText size={14} />, TPR: <Clock size={14} />, UOM: <Package size={14} />, RESULT: <Check size={14} />, ERROR: <X size={14} /> };
  const typeColor = { BASE: T.textSecondary, CONTRACT: T.catPurple, TPR: T.catAmber, UOM: T.catTeal, RESULT: T.success, ERROR: T.error };
  return (
    <div>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const isError = step.type === "ERROR"; const isResult = step.type === "RESULT";
        const clr = typeColor[step.type] || T.textSecondary;
        const cardBg = isError ? T.errorSubtle : isResult ? T.successSubtle : T.surfaceSecondary;
        return (
          <div key={idx} style={{ display: "flex", gap: 0, position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginRight: 12, flexShrink: 0, width: 32 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: isError ? T.errorSubtle : isResult ? T.successSubtle : T.surfacePrimary, border: `2px solid ${clr}`, display: "flex", alignItems: "center", justifyContent: "center", color: clr, position: "relative", zIndex: 2 }}>{typeIcon[step.type]}</div>
              {!isLast && <div style={{ width: 1, flex: 1, minHeight: 8, background: T.borderDefault }} />}
            </div>
            <div style={{ flex: 1, marginBottom: isLast ? 0 : 8, background: cardBg, border: `1px solid ${isError ? `${T.error}25` : isResult ? `${T.success}20` : T.borderDefault}`, borderRadius: T.radiusSm, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: isError ? T.error : isResult ? T.success : T.textPrimary }}>{step.label}</span>
                <code style={{ fontSize: 10, color: T.textTertiary, background: isError || isResult ? "rgba(255,255,255,0.6)" : T.surfacePrimary, padding: "1px 6px", borderRadius: 3, fontFamily: T.mono }}>{step.record}</code>
                <div style={{ flex: 1 }} />
                {step.value != null && <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: isError ? T.error : step.value < 0 ? T.catAmber : isResult ? T.success : T.textPrimary }}>{step.value > 0 && step.type !== "BASE" && step.type !== "RESULT" ? "+" : ""}{fmtP(step.value)}</span>}
                {step.running != null && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textTertiary }}>= <strong style={{ color: isResult ? T.success : T.textPrimary }}>{fmtP(step.running)}</strong></span>}
              </div>
              <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.55 }}>{step.detail}</div>
              {isError && step.error && (<div style={{ marginTop: 8, background: T.errorSubtle, border: `1px solid ${T.error}20`, borderRadius: T.radiusSm, padding: "8px 10px", fontSize: 11, color: T.error, display: "flex", gap: 6, lineHeight: 1.5 }}><AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /><span>{step.error}</span></div>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [expanded, setExpanded] = useState({ "PO-88421": true });
  const [selected, setSelected] = useState("PO-88421");
  const [selectedLine, setSelectedLine] = useState("L1");
  const [tab, setTab] = useState("orders");
  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const selectOrder = (id) => { setSelected(id); setSelectedLine(ORDERS.find(o => o.id === id)?.analysis?.lines?.[0]?.lineId || "L1"); };
  const allLines = ORDERS.flatMap(o => o.lines.map(enrichLine));
  const totalAtRisk = ORDERS.reduce((s, o) => s + orderStats(o.lines).atRisk, 0);
  const totalQty = ORDERS.reduce((s, o) => s + orderStats(o.lines).totalQty, 0);
  const selOrder = ORDERS.find(o => o.id === selected);
  const selAnalysis = selOrder?.analysis;
  const selLineAnalysis = selAnalysis?.lines?.find(l => l.lineId === selectedLine);
  const selLineData = selOrder?.lines.find(l => l.id === selectedLine);
  const selLineEnriched = selLineData ? enrichLine(selLineData) : null;

  return (
    <div style={{ minHeight: "100vh", background: T.surfacePage, fontFamily: T.sans, fontSize: 13, color: T.textPrimary, lineHeight: 1.5 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:${T.borderDefault};border-radius:9999px}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        .row-hover:hover{background:${T.rowHover}!important} .line-hover:hover{background:${T.surfaceSecondary}!important;cursor:pointer}
      `}</style>

      {/* ── NAV ── */}
      <div style={{ background: T.surfaceGlass, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", height: 56, display: "flex", alignItems: "center", padding: "0 24px", position: "sticky", top: 0, zIndex: 100, borderBottom: `1px solid ${T.borderSubtle}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 32 }}>
          <div style={{ width: 32, height: 32, borderRadius: T.radiusMd, background: T.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><Layers size={18} color={T.textInverse} strokeWidth={2.5} /></div>
          <span style={{ fontWeight: 700, fontSize: 15, color: T.textPrimary }}>ASOE</span>
          <span style={{ fontSize: 12, color: T.textTertiary, fontWeight: 500 }}>Exception Resolution</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["Queue", "Insights", "Rules", "Settings"].map((n, i) => (
            <button key={n} style={{ padding: "6px 14px", borderRadius: T.radiusSm, border: "none", background: i === 0 ? T.surfaceSecondary : "transparent", color: i === 0 ? T.textPrimary : T.textTertiary, fontSize: 13, fontWeight: i === 0 ? 600 : 500, cursor: "pointer", fontFamily: T.sans }}>{n}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surfaceSecondary, borderRadius: T.radiusMd, padding: "6px 12px", marginRight: 16, width: 200 }}><Search size={14} color={T.textTertiary} /><span style={{ fontSize: 12, color: T.textTertiary }}>Search orders…</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 16 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: T.success, animation: "pulse 1.4s ease-in-out infinite" }} /><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textTertiary }}>Agent Live</span></div>
        <div style={{ width: 32, height: 32, borderRadius: T.radiusFull, background: T.surfaceSecondary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: T.textSecondary }}>JD</div>
      </div>

      {/* ── PAGE HEADER ── */}
      <div style={{ background: T.surfacePrimary, borderBottom: `1px solid ${T.borderDefault}`, padding: "0 32px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "8px 0", fontSize: 12, color: T.textTertiary, display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ cursor: "pointer" }}>Home</span><ChevronRight size={12} /><span style={{ cursor: "pointer" }}>Order Management</span><ChevronRight size={12} /><span style={{ color: T.textSecondary }}>Price Hold Queue</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: T.radiusMd, background: T.textPrimary, display: "flex", alignItems: "center", justifyContent: "center" }}><Shield size={20} color={T.textInverse} /></div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, lineHeight: 1.2 }}>Price Hold Resolution Queue</h1>
              <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 3, fontWeight: 500 }}>{ORDERS.length} Orders · {allLines.length} Line Items · Updated {new Date().toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit" })}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="neutral"><RefreshCw size={14} /> Refresh</Btn>
            <Btn variant="brand"><Zap size={14} /> Audit All Holds</Btn>
          </div>
        </div>
      </div>

      {/* ── METRICS ── */}
      <div style={{ padding: "20px 32px 0", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16, animation: "fadeIn 0.3s ease" }}>
        <MetricTile icon={<AlertTriangle size={18} color={T.error} />} iconBg={T.errorSubtle} label="Open Holds" value={ORDERS.filter(o => o.status === "HOLD").length} sub="Pending diagnosis" />
        <MetricTile icon={<Activity size={18} color={T.textSecondary} />} iconBg={T.surfaceSecondary} label="Audited" value={ORDERS.filter(o => o.status === "ANALYZED").length} sub="Ready for action" />
        <MetricTile icon={<CheckCircle2 size={18} color={T.success} />} iconBg={T.successSubtle} label="Resolved" value={ORDERS.filter(o => o.status === "RESOLVED").length} sub={`of ${ORDERS.length} POs`} />
        <MetricTile icon={<Layers size={18} color={T.catPurple} />} iconBg={T.catPurpleSubtle} label="Line Items" value={allLines.length} sub={`${allLines.filter(l => Math.abs(l.pct) > 1).length} flagged`} />
        <MetricTile icon={<Box size={18} color={T.catAmber} />} iconBg={T.catAmberSubtle} label="Total Cases" value={totalQty.toLocaleString()} sub="Across all holds" />
        <MetricTile icon={<TrendingDown size={18} color={T.warning} />} iconBg={T.warningSubtle} label="$ at Risk" value={fmtD(totalAtRisk)} sub="Weighted by quantity" />
      </div>

      {/* ── TABS ── */}
      <div style={{ padding: "0 32px", marginTop: 20 }}>
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.borderDefault}` }}>
          {[["orders", `Orders (${ORDERS.length})`, Layers], ["insights", "Root Cause Insights", BarChart3], ["log", "Agent Activity", Activity]].map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 18px", border: "none", borderBottom: tab === t ? `2px solid ${T.brand}` : "2px solid transparent", background: "transparent", color: tab === t ? T.textPrimary : T.textTertiary, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: T.sans, marginBottom: -1 }}><Icon size={14} />{label}</button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "20px 32px 48px" }}>
        {tab === "orders" && (
          <div style={{ display: "flex", gap: 16, animation: "fadeIn 0.2s ease" }}>
            {/* Order List */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {ORDERS.map(order => {
                const stats = orderStats(order.lines); const isExp = expanded[order.id]; const isSel = selected === order.id;
                const enriched = order.lines.map(enrichLine);
                const statusCfg = { HOLD: { color: T.error, bg: T.errorSubtle, label: "On Hold" }, ANALYZED: { color: T.catSlate, bg: T.surfaceSecondary, label: "Audited" }, RESOLVED: { color: T.success, bg: T.successSubtle, label: "Resolved" } }[order.status] || { color: T.catSlate, bg: T.catSlateSubtle, label: order.status };
                return (
                  <div key={order.id} style={{ background: T.surfacePrimary, borderRadius: T.radiusMd, overflow: "hidden", boxShadow: isSel ? T.shadowMd : T.shadowSm, transition: "box-shadow 0.15s" }}>
                    <div className="row-hover" onClick={() => toggleExpand(order.id)} style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", background: isExp ? T.surfaceSecondary : T.surfacePrimary, transition: "background 0.1s" }}>
                      <ChevronRight size={14} color={T.textTertiary} style={{ transform: isExp ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                      <span style={{ fontFamily: T.mono, fontSize: 12, color: T.textPrimary, fontWeight: 600, minWidth: 76 }}>{order.id}</span>
                      <span style={{ fontWeight: 700, fontSize: 13, minWidth: 90 }}>{order.customer}</span>
                      <span style={{ color: T.textTertiary, fontSize: 11, minWidth: 70 }}>{order.region}</span>
                      <Badge color={T.catSlate} bg={T.surfaceSecondary} size="xs">{order.lines.length} lines</Badge>
                      <div style={{ minWidth: 65 }}><div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 13 }}>{stats.totalQty.toLocaleString()}</div><div style={{ fontSize: 10, color: T.textTertiary }}>cases</div></div>
                      <div style={{ minWidth: 65 }}><div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 13, color: stats.atRisk > 500 ? T.error : T.warning }}>{fmtD(stats.atRisk)}</div><div style={{ fontSize: 10, color: T.textTertiary }}>at risk</div></div>
                      <div style={{ minWidth: 55 }}><div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 13, color: stats.pct < -5 ? T.error : T.warning }}>{stats.pct > 0 ? "+" : ""}{stats.pct}%</div><div style={{ fontSize: 10, color: T.textTertiary }}>{stats.flagged}/{order.lines.length} flagged</div></div>
                      <div style={{ flex: 1 }} />
                      <StatusPill color={statusCfg.color} bg={statusCfg.bg}>{statusCfg.label}</StatusPill>
                      <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 6 }}>
                        {order.status === "HOLD" && <Btn variant="brand" size="sm"><Zap size={12} /> Audit</Btn>}
                        {order.status === "ANALYZED" && <><Btn variant="neutral" size="sm" onClick={() => selectOrder(order.id)}>Detail</Btn><Btn variant="success" size="sm"><Check size={12} /> Resolve</Btn></>}
                        {order.status === "RESOLVED" && <Btn variant="ghost" size="sm" onClick={() => selectOrder(order.id)}>View <ExternalLink size={11} /></Btn>}
                      </div>
                    </div>
                    {isExp && (
                      <div style={{ borderTop: `1px solid ${T.borderDefault}` }}>
                        <div style={{ display: "grid", gridTemplateColumns: "44px 80px 1fr 50px 60px 68px 68px 78px 78px 130px", padding: "7px 20px 7px 48px", background: T.surfaceSecondary, gap: 8, borderBottom: `1px solid ${T.borderDefault}` }}>
                          {["Line", "SKU", "Product", "UOM", "Qty", "ERP", "PO", "Σ ERP", "Σ PO", "Root Cause"].map(h => (
                            <span key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.textTertiary, textAlign: ["Qty", "ERP", "PO", "Σ ERP", "Σ PO"].includes(h) ? "right" : "left" }}>{h}</span>
                          ))}
                        </div>
                        {enriched.map((line, idx) => {
                          const cause = CAUSES[line.cause]; const CauseIcon = cause.Icon;
                          const isFlagged = Math.abs(line.pct) > 1; const isLineSel = isSel && selectedLine === line.id;
                          return (
                            <div key={line.id} className="line-hover" onClick={() => { selectOrder(order.id); setSelectedLine(line.id); }}
                              style={{ display: "grid", gridTemplateColumns: "44px 80px 1fr 50px 60px 68px 68px 78px 78px 130px", padding: "10px 20px 10px 48px", gap: 8, borderBottom: idx < enriched.length - 1 ? `1px solid ${T.borderSubtle}` : "none", background: isLineSel ? T.surfaceSecondary : T.surfacePrimary, alignItems: "center", transition: "background 0.1s" }}>
                              <span style={{ color: T.textTertiary, fontSize: 11, fontWeight: 600 }}>{line.id}</span>
                              <code style={{ fontFamily: T.mono, fontSize: 11, color: T.textSecondary }}>{line.sku}</code>
                              <span style={{ fontSize: 12, fontWeight: 500 }}>{line.desc}</span>
                              <span style={{ color: T.textTertiary, fontSize: 11, textAlign: "right" }}>{line.uom}</span>
                              <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, textAlign: "right" }}>{line.qty.toLocaleString()}</span>
                              <span style={{ fontFamily: T.mono, fontSize: 12, textAlign: "right" }}>{fmtP(line.erp)}</span>
                              <div style={{ textAlign: "right" }}><div style={{ fontFamily: T.mono, fontSize: 12 }}>{fmtP(line.po)}</div>{isFlagged && <div style={{ fontSize: 10, fontWeight: 700, color: line.pct < -5 ? T.error : T.warning }}>{line.pct > 0 ? "+" : ""}{line.pct}%</div>}</div>
                              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textTertiary, textAlign: "right" }}>{fmtD(line.totalErp)}</span>
                              <div style={{ textAlign: "right" }}><div style={{ fontFamily: T.mono, fontSize: 11, color: T.textTertiary }}>{fmtD(line.totalPo)}</div>{isFlagged && <div style={{ fontSize: 10, fontWeight: 700, color: T.error }}>Δ{fmtD(Math.abs(line.totalPo - line.totalErp))}</div>}</div>
                              <Badge color={cause.color} bg={cause.bg} size="xs"><CauseIcon size={10} /> {cause.label}</Badge>
                            </div>
                          );
                        })}
                        {(() => { const s = orderStats(order.lines); return (
                          <div style={{ display: "grid", gridTemplateColumns: "44px 80px 1fr 50px 60px 68px 68px 78px 78px 130px", padding: "10px 20px 10px 48px", gap: 8, background: T.surfaceSecondary, borderTop: `1px solid ${T.borderDefault}` }}>
                            <span /><span /><span style={{ fontSize: 11, fontWeight: 700, color: T.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>Order Total</span>
                            <span /><span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, textAlign: "right" }}>{s.totalQty.toLocaleString()}</span><span /><span />
                            <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, textAlign: "right" }}>{fmtD(s.totalErp)}</span>
                            <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, textAlign: "right" }}>{fmtD(s.totalPo)}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: s.atRisk > 500 ? T.error : T.warning }}>Δ{fmtD(s.atRisk)} at risk</span>
                          </div>
                        ); })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Sidebar ── */}
            {selected && selOrder && selAnalysis && (
              <div style={{ width: 480, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12, animation: "slideIn 0.25s ease", overflowY: "auto", maxHeight: "calc(100vh - 260px)", position: "sticky", top: 76 }}>
                <Card noPad>
                  <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${T.borderSubtle}`, display: "flex", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 40, height: 40, borderRadius: T.radiusMd, background: T.textPrimary, display: "flex", alignItems: "center", justifyContent: "center", color: T.textInverse, fontSize: 12, fontWeight: 800, fontFamily: T.mono }}>PO</div>
                      <div>
                        <div style={{ fontFamily: T.mono, color: T.textPrimary, fontSize: 14, fontWeight: 600 }}>{selOrder.id}</div>
                        <div style={{ fontWeight: 700, fontSize: 16, marginTop: 1 }}>{selOrder.customer}</div>
                        <div style={{ color: T.textTertiary, fontSize: 11, marginTop: 2 }}>{selOrder.region} · {selOrder.lines.length} line items</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <Badge color={selAnalysis.risk === "HIGH" ? T.error : selAnalysis.risk === "MEDIUM" ? T.warning : T.success} bg={selAnalysis.risk === "HIGH" ? T.errorSubtle : selAnalysis.risk === "MEDIUM" ? T.warningSubtle : T.successSubtle}>{selAnalysis.risk} Risk</Badge>
                      <button onClick={() => setSelected(null)} style={{ background: "none", border: `1px solid ${T.borderDefault}`, borderRadius: T.radiusSm, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: T.textTertiary }}><X size={14} /></button>
                    </div>
                  </div>
                  {(() => { const s = orderStats(selOrder.lines); return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: `1px solid ${T.borderSubtle}` }}>
                      {[["Cases", s.totalQty.toLocaleString(), T.textPrimary], ["ERP Total", fmtD(s.totalErp), T.textSecondary], ["PO Total", fmtD(s.totalPo), T.textSecondary], ["$ at Risk", fmtD(s.atRisk), s.atRisk > 500 ? T.error : T.warning]].map(([l, v, c], i) => (
                        <div key={l} style={{ padding: "10px 14px", borderRight: i < 3 ? `1px solid ${T.borderSubtle}` : "none", textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: T.textTertiary, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{l}</div>
                          <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: c }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  ); })()}
                  <div style={{ padding: "14px 20px", fontSize: 12, color: T.textSecondary, lineHeight: 1.65, borderLeft: `3px solid ${T.borderStrong}`, margin: "14px 20px", background: T.surfaceSecondary, borderRadius: T.radiusSm }}>{selAnalysis.diagnosis}</div>
                </Card>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.textTertiary, marginBottom: 8 }}>Select Line Item</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(selAnalysis.lines || []).map(la => {
                      const isActive = selectedLine === la.lineId; const lineData = selOrder.lines.find(l => l.id === la.lineId);
                      return (
                        <button key={la.lineId} onClick={() => setSelectedLine(la.lineId)} style={{ padding: "5px 12px", background: isActive ? T.surfaceSecondary : T.surfacePrimary, border: `1px solid ${isActive ? T.borderStrong : T.borderDefault}`, borderRadius: T.radiusFull, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: isActive ? T.textPrimary : T.textTertiary, fontFamily: T.sans }}>
                          <span style={{ fontFamily: T.mono }}>{la.lineId}</span>
                          {lineData && <span>{lineData.desc}</span>}
                          <Badge color={la.risk === "HIGH" ? T.error : la.risk === "MEDIUM" ? T.warning : T.success} bg={la.risk === "HIGH" ? T.errorSubtle : la.risk === "MEDIUM" ? T.warningSubtle : T.successSubtle} size="xs">{la.risk}</Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selLineAnalysis && selLineEnriched && (
                  <>
                    {/* Agent Card — NO blue accent, just elevated shadow */}
                    <div style={{ background: T.surfacePrimary, borderRadius: T.radiusMd, boxShadow: T.shadowMd, overflow: "hidden" }}>
                      <div style={{ padding: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: T.radiusSm, background: T.surfaceSecondary, display: "flex", alignItems: "center", justifyContent: "center" }}><Zap size={14} color={T.textSecondary} /></div>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>Agent Recommendation</span>
                          </div>
                          <Badge color={RESOLUTIONS[selLineAnalysis.resolution]?.color || T.catSlate} bg={RESOLUTIONS[selLineAnalysis.resolution]?.bg || T.catSlateSubtle}>{RESOLUTIONS[selLineAnalysis.resolution]?.label || selLineAnalysis.resolution}</Badge>
                        </div>
                        <p style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.65, marginBottom: 14 }}>{selLineAnalysis.diagnosis}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.textTertiary }}>Confidence</span>
                          <div style={{ width: 120, height: 4, background: T.surfaceSecondary, borderRadius: T.radiusFull, overflow: "hidden" }}><div style={{ width: `${selAnalysis.confidence}%`, height: "100%", background: T.textSecondary, borderRadius: T.radiusFull }} /></div>
                          <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: T.textPrimary }}>{selAnalysis.confidence}%</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                          {[["Qty", `${selLineEnriched.qty.toLocaleString()} CS`], ["ERP/unit", fmtP(selLineEnriched.erp)], ["PO/unit", fmtP(selLineEnriched.po)], ["$ at Risk", fmtD(Math.abs(selLineEnriched.delta * selLineEnriched.qty))]].map(([l, v], i) => (
                            <div key={l} style={{ background: T.surfaceSecondary, borderRadius: T.radiusSm, padding: "8px 10px", textAlign: "center" }}>
                              <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textTertiary }}>{l}</div>
                              <div style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: i === 3 ? (selLineEnriched.pct < -5 ? T.error : T.warning) : T.textPrimary, marginTop: 3 }}>{v}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Btn variant="brand"><Zap size={14} /> Execute Auto-Override</Btn>
                          <Btn variant="neutral">Override</Btn>
                          <Btn variant="ghost"><ArrowUpRight size={14} /> Escalate</Btn>
                        </div>
                      </div>
                    </div>

                    <Card title="ERP Pricing Waterfall" icon={<Search size={14} />} action={<Badge color={T.catSlate} bg={T.surfaceSecondary} size="xs">{selLineAnalysis.waterfall?.length || 0} steps</Badge>}>
                      <PricingWaterfall steps={selLineAnalysis.waterfall} />
                    </Card>
                  </>
                )}

                {selOrder.status === "ANALYZED" && <Btn variant="success" size="lg" style={{ width: "100%", justifyContent: "center" }}><CheckCircle2 size={16} /> Mark Order Resolved</Btn>}
                {selOrder.status === "RESOLVED" && <div style={{ textAlign: "center", padding: 14, background: T.successSubtle, border: `1px solid ${T.success}20`, borderRadius: T.radiusMd, color: T.success, fontSize: 13, fontWeight: 700 }}><CheckCircle2 size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Order & All Lines Resolved</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
