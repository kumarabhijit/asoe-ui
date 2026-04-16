# AgenticOM Prototype vs asoe-ui — Gap Analysis

> **Source**: AgenticOM Prototype (Issue #50, `Document from Abhijit.html` — 12,051 lines)
> **Target**: `kumarabhijit/asoe-ui` (Next.js 16 / React 19 / TypeScript)
> **Date**: 2026-04-14

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Navigation & Layout Gaps](#2-navigation--layout-gaps)
3. [Exception Queue Gaps](#3-exception-queue-gaps)
4. [Customer Inbox Gaps](#4-customer-inbox-gaps)
5. [New Features — Not Yet Built](#5-new-features--not-yet-built)
6. [Cross-Cutting Features](#6-cross-cutting-features)
7. [Data Models & AI Agents](#7-data-models--ai-agents)
8. [Design System & Component Gaps](#8-design-system--component-gaps)
9. [Implementation Priority Matrix](#9-implementation-priority-matrix)

---

## 1. Executive Summary

### Prototype Scope

The AgenticOM prototype is a single-file vanilla JS application implementing a complete
**AI-native ERP middleware for CPG exception management**. It includes:

- **5 main operational tabs**: Customer Inbox, Exception Queue, Quota Mgmt, Exception Insights, Performance
- **8 admin sections**: Appearance, Rules & Autonomy, Billing & Usage, Ontology Explorer, Data, Connections, Team & Personas, System
- **8 exception types** with dedicated detail renderers per type
- **5 AI agent specializations**: Price Resolution, Back-Order/OOS, Over Max, Min Order Qty, Quota Intelligence
- **EDI 850 viewer**, AI Order Extraction, Constraint Graph, Knowledge Graphs
- **Persona system** with 5 roles and granular RBAC
- **CSR Chat Assistant** with context-aware prompts
- **Upload/Data Ingestion** with Excel parsing via SheetJS
- **Dark mode** with 3-way theme system (Light / Dark / System)

### Current asoe-ui State

The React application (Next.js 16 App Router) currently implements:

- **4 routes**: `/exceptions`, `/dashboard`, `/inbox`, `/settings` (stub)
- **Auth flow**: Multi-step login with SSO, JWT sessions, 5 RBAC roles
- **Exception Queue**: Three-pane Outlook layout with generic detail panel
- **Dashboard**: 4 KPI tiles, intent/state/verdict charts
- **Customer Inbox**: Basic AI email triage with two-pane layout
- **15 reusable UI components** (14 custom + GapBar) + 45+ CSS design tokens
- **252 passing tests** (unit, architectural, accessibility, e2e)
- **WebSocket hook** for real-time pipeline updates

### Gap Summary

| Category | Prototype Features | asoe-ui Has | Gap |
|----------|-------------------|-------------|-----|
| Main Tabs | 5 | 3 operational + 1 stub | **2 missing tabs** (Quota, Performance) |
| Admin Sections | 8 | 1 stub | **8 sections to build** |
| Exception Types | 8 with dedicated renderers | 8 types, 6 with dedicated renderers (Price, Duplicate, BackOrder, OverMax, MOQ, Pallet) | **1 dedicated renderer missing** (Delivery Delay) |
| AI Agents | 5 specialized + chat | Generic mock only | **5 specialized agents** |
| Cross-cutting | Chat, Upload, Personas, Dark Mode, KG | None | **All missing** |
| Testing | N/A (prototype) | 226 tests | Ahead of prototype |

---

## 2. Navigation & Layout Gaps

### 2.1 Top-Level Layout Structure

**Prototype layout** (vertical flex, 100vh):
```
[Topbar]       — 50px, glass blur backdrop, logo, persona pill, stats, theme toggle
[Databar]      — horizontal strip of SAP data counts (Customers, Materials, SOs, etc.)
[Tabbar]       — 5 operational tabs + Admin button (right-aligned)
[Active View]  — flex:1, only one visible at a time
[Chat Panel]   — fixed bottom-right floating panel (380x520px)
```

**asoe-ui layout** (via `src/app/layout.tsx`):
```
[NavBar]       — 56px glass nav with agent status pulse
[Active Route] — Next.js App Router page
```

### 2.2 Navigation Gaps

| Element | Prototype | asoe-ui | Gap |
|---------|-----------|---------|-----|
| **Topbar** | Logo + persona pill + file name + stats badges + token ticker + theme toggle | NavBar with logo + nav links + agent pulse | Missing: persona switcher, file/stats badges, token ticker, theme toggle |
| **Databar** | Horizontal strip showing loaded SAP table counts (Customers, Materials, SOs, Deliveries, POs, Billing, Inventory, Production, Contracts) with "new" badges for recently added tables | Not present | **Entirely missing** |
| **Tabbar** | 5 emoji-labeled tabs: `📬 Customer Inbox`, `📋 Exception Queue`, `⚖️ Quota Mgmt`, `📊 Exception Insights`, `🤖 Performance` + `⚙ Admin` button | NavBar links: Exceptions, Dashboard, Inbox, Settings | Missing: Quota Mgmt tab, Performance tab, Admin button. Tab style differs (underline vs nav links) |
| **Admin Panel** | Right-side slide-over pane (680px) with 8-section sidebar | Settings page (stub with 4 placeholder cards) | **Entirely different approach** — prototype uses overlay pane, asoe-ui uses a dedicated route |
| **Tab Switching** | JS-driven show/hide of view divs, persona-scoped tab visibility | Next.js App Router navigation | Architectural difference — Next.js routing is correct approach |
| **Upload Screen** | Full-screen overlay before data loads, dropzone + sheet grid | Not present | **Entirely missing** |

### 2.3 Persona-Aware Tab Visibility

The prototype scopes tab visibility per persona:

| Persona | Visible Tabs |
|---------|-------------|
| Admin (Marcus Webb) | All 5 + all admin sections |
| CS Manager (Sarah Chen) | mailbox, queue, quota, dashboard, perf + rules |
| Sr. CS Analyst (Sarah Chen) | mailbox, queue, quota, dashboard |
| CS Analyst (James Ortiz) | mailbox, queue |
| Trade Analyst (Priya Nair) | queue, quota, dashboard |

**asoe-ui status**: Has RBAC roles defined in `src/lib/roles.ts` but tab visibility is not
persona-scoped. All authenticated users see all routes.

### 2.4 View Container IDs (Prototype Reference)

For mapping prototype views to React routes/components:

| Prototype View ID | Route in asoe-ui | Status |
|-------------------|------------------|--------|
| `#upload` | N/A (modal/overlay) | Not built |
| `#queue-view` | `/exceptions` | Built (3-pane layout) |
| `#dashboard-view` | `/dashboard` | Built (basic) |
| `#perf-view` | `/performance` | **Not built** |
| `#mailbox-view` | `/inbox` | Built (basic) |
| `#quota-view` | `/quota` | **Not built** |
| `#rules-view` | Admin panel section | **Not built** |
| `#ontology-view` | Admin panel section | **Not built** |
| `#billing-view` | Admin panel section | **Not built** |
| `#personas-view` | Admin panel section | **Not built** |
| `#chat-panel` | Floating component | **Not built** |
| `#settings-pane-overlay` | `/settings` or overlay | Stub only |

---

## 3. Exception Queue Gaps

The Exception Queue (`/exceptions`) is the flagship view and the most feature-rich part of both
the prototype and asoe-ui. However, the prototype has significantly deeper functionality.

### 3.1 Layout Comparison

| Aspect | Prototype | asoe-ui | Gap |
|--------|-----------|---------|-----|
| **Layout pattern** | 3-column: List (300px) + Detail (flex:1) + Audit Drawer (320px) | 3-pane resizable (react-resizable-panels) | asoe-ui is better (resizable) |
| **Audit Drawer** | Toggle-able right panel with timeline audit trail | Not present | **Missing** |
| **Exception list width** | Fixed 300px | Resizable pane | OK |

### 3.2 Exception Types — Prototype Defines 8

| # | Type | Icon | Rules | Severity | asoe-ui Status |
|---|------|------|-------|----------|----------------|
| 1 | Price Mismatch | 💲 | SO-PRICE-001 (1-10%), SO-PRICE-002 (>10%) | P1, P0 | Has type + **dedicated renderer** (`PriceAnalysisSection`) — price delta bars, metric tiles, SAP context |
| 2 | Delivery Delay | 🚚 | SD-DELAY-001 (2-4d), SD-DELAY-002 (>=5d) | P1, P0 | Has type, **no dedicated renderer** |
| 3 | Duplicate Order | 👥 | SD-DUP-001 | P1 | Has type + dedicated renderer (`DuplicateDetectionSection` + `OrderComparisonSection`) |
| 4 | Stale Open Order | 🕰️ | SD-STALE-001 (>30d) | P2 | Has type, generic renderer |
| 5 | Back-Order (OOS) | 📦 | SD-OOS-001 (<50%), SD-OOS-002 (>=50%) | P1, P0 | Has type + **dedicated renderer** (`BackOrderSection`) — gap bar, DC inventory, resolution options with scoring |
| 6 | Pallet Config | 🧱 | SD-PLT-001 (broken layer), SD-PLT-002 (partial) | P1, P2 | Has type + **dedicated renderer** (`PalletConfigSection`) — KPI strip, pallet fill bars, suggested plan |
| 7 | Over Max | 🔺 | SD-OM-001, SD-OM-002 (>50%) | P1, P0 | Has type + **dedicated renderer** (`OverMaxSection`) — exceedance bar, order lines, AI trim plan |
| 8 | Min Order Qty | 🔻 | SD-MOQ-001 (<25%), SD-MOQ-002 (>=25%) | P1, P0 | Has type + **dedicated renderer** (`MOQSection`) — shortfall bar, V4082 block, round-up plan |

### 3.3 Type-Specific Detail Panels Required

Each exception type in the prototype has a **dedicated detail renderer** with specialized UI.
asoe-ui currently uses a single generic `ExceptionDetailPanel` for all types.

#### 3.3.1 Price Mismatch Detail (`renderPriceMismatchDetail`)

**Left column (240px):**
- Customer card: BP number, tier, VIP flag, credit status, payment terms
- Price delta card: Visual bar (PO vs ERP), three metric tiles (ERP/unit, PO/unit, Variance %), dollar-at-risk row
- SAP context card: Doc type, doc number, SKU, material, quantity, date, rule, root cause

**Right column (AI Engine) — 3 states:**
- **Idle**: "Price Resolution Agent" ready card with description ("Reconstructs the full SAP RVAA01 waterfall"), context chips, CTA button
- **Running**: Spinner with 6 animated progress steps (reading condition records, tracing RVAA01, identifying failed condition, checking promo master, building waterfall, ranking actions)
- **Complete**: AI narrative + confidence/urgency badges, recommended action with autonomy badge, **SAP Pricing Waterfall** (collapsible timeline of RVAA01 condition records with error highlighting and delta bar), risk flags, resolution steps, customer email draft with copy-to-clipboard

**Bottom**: Inline Knowledge Graph (SVG entity-relationship diagram)

**asoe-ui status**: Has `PricingWaterfall` component and a dedicated `PriceAnalysisSection` with price delta bars (ERP vs PO), metric tiles (ERP/unit, PO/unit, Variance %, At Risk), and collapsible SAP context card. Data-presence-driven: renders when `price_analysis` is present in `OrderAnalysis`. Missing: the idle/running/complete AI agent state machine (the section renders final analysis only).

#### 3.3.2 Back-Order / OOS Detail (`renderOOSDetail`)

**Left column:**
- Customer card
- Gap visualization: horizontal bar showing ordered vs available vs gap quantities
- DC inventory snapshot: primary DC + alternate warehouses in a 4-column grid (Plant, Qty, ETA, Freight Delta)
- Production & Substitutes card: inbound PO details, substitute SKUs with acceptance rates

**Right column (AI Engine):**
- 4 ranked resolution options (cards): split shipment, future delivery, substitute SKU, alt DC
- Each option shows: composite score (0-1.0), sub-scores (service 40%, revenue 30%, logistics 20%, preference 10%), detail text, SAP steps
- Options are selectable with "top pick" highlight on the highest-scored option
- Customer email draft

**asoe-ui status**: Has dedicated `BackOrderSection` with `GapBar` (ordered vs available), DC inventory snapshot (primary DC + alternates with ETA/freight delta), substitute SKUs, production/inbound PO cards, and ranked resolution options with multi-dimensional scoring (service/revenue/logistics/preference sub-scores + composite). Mock exceptions exc-010 (YELLOW) and exc-011 (GREEN auto-resolved). Missing: the idle/running/complete AI agent state machine, customer email draft, and inline Knowledge Graph.

#### 3.3.3 Pallet Config Detail (`renderPalletDetail`)

**KPI strip**: Total Cases, Loose Cases, Extra Labor (hrs), Freight Waste (%)

**Per-line breakdown**: Cards for each SKU showing:
- Pallet fill visualization bar (% of full pallet)
- Layer qty, pallet qty, ordered qty, complete layers, loose cases, full pallets
- Violation type badge (Broken Layer / Partial Pallet)

**AI-suggested plan**: Table with columns: SKU, Current Qty, Suggested Qty, Delta, Layers, Full Pallets, Reason

**asoe-ui status**: Has dedicated `PalletConfigSection` with KPI strip (Total Cases, Loose Cases, Extra Labor, Freight Waste), per-line pallet fill bars with violation badges (Broken Layer / Partial Pallet), and AI Suggested Plan table (SKU, Current, Suggested, Delta, Layers, Full Pallets, Reason). Mock exception exc-014 (PALLET_CONFIG, YELLOW). Missing: the inline Knowledge Graph.

#### 3.3.4 Over Max Detail (`renderOverMaxDetail`)

- Exceedance gap bar: visual bar showing ordered vs max qty with excess highlighted in red
- Order lines table: per-line with qty, max, excess, even-layer flag
- **AI Trim Plan table**: SKU, Ordered, Trimmed-To, Delta, Action (TRIM/SKIP/OK), with totals row
- Per-line "Apply VA02" buttons that simulate SAP execution, tracking applied state
- "Apply All" button + completion banner
- Human-in-loop callout explaining escalation rules

**asoe-ui status**: Has dedicated `OverMaxSection` with exceedance bar (ordered vs max with excess highlighted), collapsible order lines table (per-line qty/max/excess/even-layer), AI Trim Plan table (TRIM/SKIP/OK actions with totals), and human-in-loop callout. Mock exception exc-012 (OVER_MAX, YELLOW). Missing: per-line "Apply VA02" buttons and "Apply All" with completion banner (SAP execution simulation).

#### 3.3.5 Min Order Qty Detail (`renderMOQDetail`)

- Order shortfall gap bar: ordered vs MOQ with shortfall highlighted
- SAP V4082 block detail card: block message, MOQ source (KNMT-MINBM or MARC-MINBE), contract ref
- **AI Round-Up Plan table**: SKU, Ordered (struck through), Round-Up-To, Delta, Action (ROUND_UP/ACCEPT_BELOW/ESCALATE), totals row
- SAP Steps table: step-by-step with transaction codes, tables, fields as badges
- Per-line "Apply VA02" buttons with applied state tracking
- Human-in-loop callout (24h timeout, KNMT waivers need Sales Manager)

**asoe-ui status**: Has dedicated `MOQSection` with shortfall bar (ordered vs MOQ), SAP V4082 block detail card (block message, MOQ source, channel, contract ref), AI Round-Up Plan table (ROUND_UP/ACCEPT_BELOW/ESCALATE actions with totals), collapsible SAP Execution Steps (step number, transaction code, table, field), and human-in-loop callout. Mock exception exc-013 (MIN_ORDER_QTY, YELLOW). Missing: per-line "Apply VA02" buttons with applied state tracking.

#### 3.3.6 Generic Detail (Delivery Delay, Duplicate Order, Stale Open Order)

- Header ribbon with type icon, severity badge, autonomy badge, exception ID
- Badge row: rule, doc type/num, customer, line
- Left SAP context card: comprehensive key-value display
- Right AI zone: Ready → Running → Error → Result states
- AI result: narrative, autonomy + risk assessment grid, resolution with SAP T-Code/BAPI badges, customer draft, next steps

**asoe-ui status**: Has a generic `ExceptionDetailPanel` but missing the specific Ready/Running/Error/Result state machine for AI analysis.

### 3.4 Exception List Panel Gaps

| Feature | Prototype | asoe-ui | Gap |
|---------|-----------|---------|-----|
| Filter chips | 10 chips: All, Price, Delay, Dup, Stale, OOS, Pallet, OverMax, MinQty, Done | Search + filter dropdowns from useHealth | Different approach — asoe-ui is more flexible |
| Row content | Type icon, sev badge, AI Done badge, customer, doc, type-specific metric line | Compact card with search, badges | Similar |
| Left border color | Blue=selected, Green=AI done, type-color otherwise | Blue=selected, Green=auto-resolved (GREEN verdict + terminal state) | **Built** (Phase 8.8) |
| Hover popout button | ⤢ icon to open in new tab | Not present | **Missing** |
| Right-click context menu | 5 actions (Open Tab, Open Window, Run Agent, Copy ID, Copy Doc) | Not present | **Missing** |
| Persona scoping | Badge showing "Walmart, Kroger only" when restricted | Not implemented | **Missing** |
| "Run All" button | Batch-runs agents on all pending exceptions | Not present | **Missing** |

### 3.5 Audit Trail Drawer

The prototype has a toggle-able 320px right-side drawer showing a chronological audit trail:
- Timestamp + actor badge (color-coded: AI=indigo, error=gray, system=blue)
- Action description + detail text + exception ID
- Connected dot timeline visualization
- Capped at 200 entries

**asoe-ui status**: Not built. The `Sidebar` component (480px slide-right panel) could be adapted.

---

## 4. Customer Inbox Gaps

### 4.1 Layout Comparison

| Aspect | Prototype | asoe-ui | Gap |
|--------|-----------|---------|-----|
| **Layout** | Two-pane: 320px email list + detail panel | Two-pane: 380px queue + detail | Similar |
| **Sub-navigation** | `Inbox` / `AI Intake Flow (Pipeline)` sub-tabs | Not present | **Missing pipeline sub-view** |
| **Simulate Inbound** | Modal to inject test emails (4 scenarios) | Not present | **Missing** |
| **Email count** | 6 mock emails with diverse intent types | 6 mock items | Similar |

### 4.2 Email Types and Classification

Prototype supports 5 email intent types:

| Intent | Icon | Description | asoe-ui Status |
|--------|------|-------------|----------------|
| `new_order` | 📦 | New purchase order from email/attachment | Partial |
| `order_inquiry` | ❓ | Status inquiry about existing order | Partial |
| `order_change` | ✏️ | Qty/date/cancel change request | **Not implemented** |
| `complaint` | ⚠️ | Quality/service complaint | Partial |
| `invoice_query` | 💰 | Invoice discrepancy or payment query | Partial |

### 4.3 Detail Panel Tabs

The prototype mailbox detail has **9 sub-tabs** (context-dependent):

| Tab | Description | asoe-ui Status |
|-----|-------------|----------------|
| `email` | Email body with metadata header | Built (basic) |
| `order-entry` | AI Order Extraction form with pallet validation | **Not built** |
| `ai-analysis` | Agent analysis card with confidence | Built (basic) |
| `entities` | Extracted entities | Placeholder ("coming soon") |
| `sap` | SAP data lookup | Placeholder ("coming soon") |
| `edi-850` | Full EDI 850 viewer (Raw/Decoded/Segment Map) | **Not built** |
| `change-request` | Order change constraint evaluation (10 checks) | **Not built** |
| `constraint-graph` | Palantir-style SVG constraint graph | **Not built** |
| `knowledge-graph` | Entity relationship KG | Placeholder ("coming soon") |

### 4.4 Order Change Workflow (Major Gap)

The prototype's most complex feature is the **Order Change Workflow** with 10 constraint checks
evaluated by 7 AI agents:

**Constraint Checks:**

| # | Constraint | Agent | Data Source | Check |
|---|-----------|-------|-------------|-------|
| 1 | Inventory | Inventory Agent | SAP MM/ATP | ATP vs order qty |
| 2 | Production | Production Agent | SAP PP | Order status (REL/CRTD/TECO), capacity |
| 3 | Transport | Transport Agent | TMS | Route availability, carrier capacity |
| 4 | Warehouse | Warehouse Agent | WMS | Pick/pack feasibility |
| 5 | Order Status | Order Lifecycle Agent | SAP SD | Fulfillment stage (0-5 scale) |
| 6 | SLA | SLA Agent | Contract DB | Delivery window compliance |
| 7 | Financial | Finance Agent | SAP FI/CO | Revenue impact (>$10k threshold) |
| 8 | Dependencies | Dependency Agent | SAP SD | Linked orders/deliveries |
| 9 | Network | Network Optimization | Network Opt | DC routing, consolidation |
| 10 | Priority | Priority Agent | CRM | Customer tier, LTV, auto-approval |

**Each constraint returns:** status (PASS/CONDITIONAL/WARNING), detail text, metric, agent name, system reference.

**Constraint evaluation UI includes:**
- Lifecycle stage bar (Created → Confirmed → Released → Picked → Shipped, 6 stages)
- Change items grid (from/to values for qty, date, etc.)
- Per-constraint cards with status badge, detail, metric
- Multi-Agent Workflow section showing orchestration times
- Scenario Simulation (3 options with recommended badge)
- Decision Panel with confidence %, SAP actions, financial summary, Approve/Edit/Reject buttons

**asoe-ui status**: **Entirely missing**. This is one of the largest implementation gaps.

### 4.5 EDI 850 Viewer (Major Gap)

The prototype includes a full **ANSI X12 5010 EDI 850 Purchase Order** viewer:

**Three sub-views:**
1. **Decoded View**: Human-readable cards for Interchange Envelope, PO Header, Party Information, Line Items (12-column table), CTT Totals, ACK Status (997/855/856 tracking)
2. **Raw X12 View**: Terminal-style syntax-highlighted segment display with color-coding by group (envelope=purple, header=blue, dates=green, party=orange, line=red, trailer=purple). Copy-to-clipboard.
3. **Segment Map View**: Two-column grid (Segment | Decoded Meaning) with color legend

**Supporting logic:**
- `buildEDI850(email)`: Constructs realistic EDI segments (ISA/GS/ST/BEG/CUR/REF/DTM/ITD/FOB/N1/N3/N4/PO1/CTT/SE/GE/IEA)
- `MASTER_MATERIALS`: 10 beverage SKUs with GTIN, price, weight, pack size
- `MASTER_CUSTOMERS`: 2 customers (Walmart, Kroger) with EDI IDs, vendor numbers
- `EDI_SEG_META`: Color-coded metadata for 18 segment types

**asoe-ui status**: **Not built**.

### 4.6 AI Order Extraction (Major Gap)

The prototype can extract structured orders from email attachments:

**4 states:** idle → extracting → done → error

**Done state includes:**
- Side-by-side layout: Source panel (left 48%) + Extracted form (right)
- Source panel with tab bar for email + each attachment, confidence bar
- Editable form fields with correction tracking and `logOrderCorrection()` for retraining
- **Order Header**: PO#, Order Type, Sales Org, Dist Channel, Ship Window, Delivery Date, etc.
- **Customer section**: BP#, Name, Vendor#, EDI Partner, Payment Terms, with Master Data Match badge
- **Line Items**: Per-line cards with 12 editable fields + MDM Match badge + pallet validation widget
- **Pallet Validation Widget** per line: uses `palletLineCalc()` for layer/pallet alignment, shows round-down/round-up suggestions
- **Send to ERP footer**: Format selector (SAP BAPI CREATEFROMDAT2 or EDI 850), Send button

**asoe-ui status**: **Not built**.

### 4.7 AI Intake Pipeline Sub-View

The prototype has a "pipeline" sub-view showing the email-to-case processing flow:

- 6-step vertical timeline: Received → Ingested → Classified → SAP Check → Routed → Resolved
- SLA callout: "Email received → Case created → L1 resolved: under 30 seconds"
- Monitored mailboxes list with addresses, daily counts, green status dots

**asoe-ui status**: **Not built**. Has a placeholder tab.

### 4.8 Simulate Inbound Modal

A modal to inject test email scenarios for development/demo:

- 4 scenario cards: Qty Reduction, Expedite Request, Full Cancellation, SKU Substitution
- Each shows icon, label, customer, SO number, "Order Change" tag
- Triggers the full AI workflow (classify → constraint check → route → resolve)

**asoe-ui status**: **Not built**.

---

## 5. New Features — Not Yet Built

These are entire tabs/views that exist in the prototype but have no equivalent in asoe-ui.

### 5.1 Quota Management (`/quota`)

**Entirely new tab** with two sub-views: Queue and Insights.

#### Queue Sub-View

**Layout**: Two-pane (300px event list + detail panel)

**5 Quota Event Types:**

| Type | Icon | Description |
|------|------|-------------|
| Quota Alert | ⚠️ | Utilization approaching/exceeding limit |
| Reallocation | 🔄 | Redistribution between accounts |
| New SKU Launch | 🚀 | Initial allocation for new product |
| Channel Conflict | ⚡ | Cross-channel allocation overlap |
| Underperformance | 📉 | Account not meeting quota commitments |

**Filter chips** by event type with counts.

**Event list rows** show: type icon, severity/autonomy badges, customer, utilization bar (color-coded: red >= 90%, orange >= 70%, teal otherwise).

**Detail panel includes:**
- Header: event type, severity/autonomy badges
- Left column: Account card, Utilisation card (visual bar + tiles for total/used/remaining/forecast), Context card with historical delivery
- Right column: "Run Quota Intelligence Engine" button → AI result
- AI result: narrative, revenue impact grid (current trajectory, projected, delta, payback period), allocation plan table (entity, SKU, current/proposed quota, delta, rationale), risk flags, options with multi-dimensional scoring, stakeholder email draft
- Bottom: Knowledge Graph

**Quota AI Result — Options Scoring:**
Each option is scored across 4 dimensions: Revenue (weight varies), Relationship, Compliance, Risk.
Visual score bars for each dimension.

#### Insights Sub-View

- KPI strip (4 tiles): Total Events, Overallocated, At Risk Revenue, Avg Utilization
- Utilization-by-Account chart (horizontal bar chart, color-coded by threshold)
- Event Type Breakdown with counts
- Strategic Recommendations cards

**asoe-ui status**: **No route, no components, no types**. Requires new page, new types in `src/types/`, new API endpoints in `src/lib/api.ts`.

### 5.2 Performance Dashboard (`/performance`)

**Entirely new tab** with 3 sections and a period toggle (Today / This Week / This Month).

#### Section 1 — AI Agent Performance

- **6 KPI tiles**: Auto-Resolution Rate, Avg Resolution Time, Classification Accuracy, Override Rate, SAP Action Success, Cases Processed
- **3-column grid**: Autonomy level breakdown bar chart, Exception type mix bar chart, Daily resolution volume stacked bar chart (AI vs Human, 7-day, with legend)

#### Section 2 — Human Team Performance

- **4 KPI tiles**: SLA Compliance, Avg Approval Time, Avg CSAT Score, Escalation Rate
- **Agent Leaderboard table**: 5 agents with columns: Name, Cases, Approval Time, SLA%, Overrides, Escalations, CSAT (star ratings)

#### Section 3 — AI vs Human Comparison

- **6 comparison cards** (2 columns):
  - Avg Resolution Speed (AI 4.2s vs Human 22.4min)
  - Volume Handled
  - Error Rate
  - SAP Execution Success
  - SLA Compliance
  - Complex Cases
- Each card: AI side vs Human side, green highlight on winner

**asoe-ui status**: **Not built**. Requires new route, page component, and supporting types.

### 5.3 Admin Panel (8 Sections)

The prototype uses a **right-side slide-over pane** (680px) with an internal sidebar for admin functions.
asoe-ui has a `/settings` route with 4 placeholder cards.

#### 5.3.1 Appearance

- 3-card grid for Light / Dark / System theme selection with checkmark indicator
- Live preview strip showing exception queue badges in current theme colors

#### 5.3.2 Rules & Autonomy Matrix

- Summary tiles: Counts by autonomy level (L1-L4) with descriptions
- Per-exception-type sections (8 types), each with a table:
  - Columns: Resolution Scope, Customer Scope, Customer, Autonomy (clickable to cycle), Priority, Actions (Enable/Disable, Delete)
  - Resolution options vary by type (e.g., Back-Order: future_date/substitute/split_ship/alt_warehouse)
- Conflict checker detecting overlapping rules
- "Add Rule" button opening a modal with pill-button selectors
- Permission-aware: read-only for non-admin personas

**Data model**: `{ id, excType, resOption, custScope, custLabel, autonomy, priority, enabled }`

#### 5.3.3 Billing & Usage

- Date range selector: presets (Today, Last 7d, Last 30d, Custom) with date inputs
- 4 Summary tiles: Total Tokens, Input Tokens (@$3/MTok), Output Tokens (@$15/MTok), Total API Cost
- Daily Token Volume SVG spark chart (dual series: input + output)
- Tokens by Agent breakdown: avatar, name, role, call count, tokens, cost, split bar
- Avg Tokens per Exception Type: icon, count, avg cost/call, avg tokens, progress bar

#### 5.3.4 Ontology Explorer

Interactive SAP entity-relationship explorer with **7 entity types**:

| Entity | SAP Tables | Properties | Links | Actions |
|--------|-----------|------------|-------|---------|
| SalesOrder | VBAK/VBAP | 10 | 5 | 4 (change qty, change date, cancel, add note) |
| Delivery | LIKP/LIPS | 9 | 3 | 2 |
| Customer | KNA1/KNB1/KNVV | 9 | 3 | 2 |
| PricingCondition | KONP/KONV | 9 | 3 | 3 (create/extend/delete condition) |
| Promotion | ZPROM | 10 | 3 | 3 (load/extend/cancel promo) |
| PricingProcedure | T683S/T683 | 9 | 2 | 0 (read-only) |
| PurchaseOrder | EKKO/EKPO | 8 | 1 | 1 (release PO) |

**UI Components:**
- SVG-based relationship graph with Bezier curves, arrow markers, clickable nodes
- Detail panel with 6 sub-tabs: Properties, Links, Graph, Actions, Live Data, Sample
- Action execution modal: parameter inputs, running/success states, change doc number
- Fullscreen mode with node chips

#### 5.3.5 Data Management

- Current file info (name, counts, demo badge)
- Upload Excel button + Reset to Demo button
- 4-stat grid (Sales Orders, Exceptions, Customers, Materials)

#### 5.3.6 Connections

8 external system integrations displayed:
- Claude AI API, SAP ECC 6.0, SAP S/4HANA, EDI Gateway, Email/SMTP, Audit DB, Redis/Celery, TMS
- All showing "Simulated" status with orange badges

#### 5.3.7 Team & Personas

Full persona configuration editor:
- Left sidebar: persona cards with avatar, name, title, permission dots, LIVE badge
- Right detail panel:
  - Identity card: editable name/title, email, live status, switch-to button
  - Tab Visibility: 4-column chip grid of toggleable tabs
  - Permissions: 8 permission toggles (iOS-style knobs)
  - Customer Data Scope: 3 options (All / Assigned / By Region)
  - Assigned customer chip grid (when scope = assigned)
  - Danger Zone: Reset to defaults

#### 5.3.8 System

Key-value table: Build date, AI model, session tokens/calls, environment details.

**asoe-ui status**: Settings page is a stub with 4 placeholder cards. All 8 sections need building.

---

## 6. Cross-Cutting Features

These features span the entire application and are not tied to a single tab.

### 6.1 CSR Chat Assistant

**Floating panel** fixed at bottom-right (380x520px):

- **Header**: Chat icon, "CSR Assistant" title, context label (case-focused or queue-wide), green "Live" pulse dot, close button
- **Messages area**: Auto-scrolling, welcome message, user/assistant bubbles with XSS-safe rendering (textContent, not innerHTML), simple bold markdown, typing indicator (3 animated dots)
- **Quick prompt chips**: Context-dependent suggestions that change per-case vs queue view
  - Case mode: "Draft a customer email", "Explain root cause", "What SAP steps?", "Financial impact?"
  - Queue mode: "Which cases to prioritize?", "Most at risk customer?", "Common root causes?", "Summarize P0 exceptions"
- **Input**: Auto-resizing textarea, Enter to send (Shift+Enter for newline), send button

**Context building** (`chatContext()`):
- Case-focused: provides all exception fields, customer data, material data, AI results
- Queue mode: provides summary of all exceptions for triage assistance
- Uses `claude-sonnet-4-20250514`, 1000 max tokens per call

**asoe-ui status**: **Not built**. Requires a new floating `ChatPanel` component, a `useChat` hook, and API integration.

### 6.2 Persona System

5 predefined personas with distinct permissions, tab visibility, and customer scope:

| Persona | Title | Permissions | Tab Count | Customer Scope |
|---------|-------|-------------|-----------|----------------|
| Marcus Webb | Admin | All 8 permissions | All tabs | All customers |
| Sarah Chen | CS Manager | canRunAgents, canRunAll, canEditRules, canEditAutonomy, canExportAudit | 6 tabs | All customers |
| Sarah Chen | Sr. CS Analyst | canRunAgents, canRunAll, canExportAudit | 4 tabs | All customers |
| James Ortiz | CS Analyst | canRunAgents | 2 tabs | Assigned (Walmart, Kroger) |
| Priya Nair | Trade Analyst | canRunAgents, canExportAudit | 3 tabs | Assigned (Target, Costco) |

**8 Permission flags**: `canRunAgents`, `canRunAll`, `canEditRules`, `canEditAutonomy`, `canViewBilling`, `canConfigurePersonas`, `canUploadData`, `canExportAudit`

**Customer scope types**: `all`, `assigned` (named customers), `region` (by region — disabled "coming soon")

**Runtime behavior:**
- `canDo(perm)` checks active persona's permissions before any action
- `scopedExcs()` filters exceptions by assigned customers
- Tab bar hides tabs not in persona's `tabs[]` array
- Toast notification on permission denial (not `alert()`)
- Persona switcher dropdown from topbar pill

**asoe-ui status**: Has RBAC roles in `src/lib/roles.ts` (5 roles: analyst, manager, admin, viewer, partner) and `useAuth` hook. But persona switching, tab scoping, and customer scope filtering are **not implemented**.

### 6.3 Upload / Data Ingestion

**Full-screen upload overlay** shown before any data is loaded:

- Logo + branding area
- Drag-and-drop zone accepting `.xlsx` files
- "Browse Files" button + hidden file input
- Sheet grid showing 9 expected SAP tables with table names:
  - Standard: Customers (KNA1/KNVV), Materials (MARA/MARC), SalesOrders (VBAK/VBAP), Deliveries (LIKP/LIPS), PurchaseOrders (EKKO/EKPO), BillingDocuments (VBRK/VBRP)
  - New (blue badges): Inventory (MMBE/MD04), Production_Orders (AUFK/AFPO), Customer_Contracts (KNA1+CRM)
- "Use Demo Data" button for instant seed data load
- Error display for parse failures
- Loading spinner during parse: "Parsing SAP data — Running rules engine..."

**Parse flow**: SheetJS reads ArrayBuffer → extracts up to 10 sheets → `loadData()` runs rules engine → builds all exception types → renders UI

**asoe-ui status**: **Not built**. Currently uses hardcoded mock data in `src/lib/api.ts`.

### 6.4 Dark Mode / Theme System

**3-mode theme system:**

| Mode | Behavior |
|------|----------|
| Light | Forces light CSS custom properties |
| Dark | Forces dark CSS custom properties via `[data-theme="dark"]` |
| System | Follows OS preference via `matchMedia`, updates reactively |

**Implementation:**
- CSS custom properties with full dark overrides for all tokens (bg, sf, fill, labels, colors, backgrounds)
- `applyTheme(pref)` sets `data-theme` attribute on `<html>`
- `initTheme()` reads from `localStorage('erp-theme')`, registers `matchMedia` change listener
- Theme toggle button in topbar cycles through modes
- Settings > Appearance has a 3-card picker with live preview

**asoe-ui status**: Has `color-scheme: light dark` in meta tag and `design-tokens.css` has some dark support, but **no theme toggle, no localStorage persistence, no full dark token overrides**.

### 6.5 Knowledge Graphs (SVG)

Interactive entity-relationship diagrams rendered inline via SVG:

**3 specialized KG builders:**
1. `buildExcKGConfig(exc)` — 8 exception-type-specific graphs (5-6 nodes each with SAP table references)
2. `buildMailboxKGConfig(email)` — Email entity graph (Sender, Email, AI Analysis, SO, SKU, BP)
3. `buildQuotaKGConfig(ev)` — Quota event graph (Customer, Rule, Allocation, SKU, Action)

**Renderer** (`renderInlineKG`):
- Dot-grid background pattern
- Quadratic Bezier curve edges with arrow markers
- HTML div node circles with icons overlaid on SVG
- Click-to-select interaction (highlights node + connected edges)
- Hover scale animation
- Node detail tooltip strip showing SAP table references

**asoe-ui status**: **Not built**. Requires a reusable `KnowledgeGraph` component.

### 6.6 Constraint Graph (Palantir-Style SVG)

A specialized large-scale SVG visualization for order change constraint evaluation:

- Full SVG canvas (1060x590) with 5 labeled zones: REQUEST, CHANGE ITEMS, CONSTRAINT EVALUATION, DATA SOURCES, DECISION
- ~30 nodes: Sales Order, Customer, 3 Change Items, 10 Constraints, 9 Data Sources, 1 Decision
- Bezier curve edges color-coded by constraint status (PASS=green, CONDITIONAL=orange, WARNING=red)
- Interactive hover tooltips on constraint nodes
- Summary header with pass/conditional/warning count chips
- Live data enrichment from uploaded SAP data

**asoe-ui status**: **Not built**.

### 6.7 Case Popout

Open any exception in a new browser tab/window as a standalone HTML document:

- Generates a full HTML page with inline CSS (print-friendly)
- Includes all exception details, AI results, customer data
- Accessible via hover popout button (⤢) on exception rows or right-click context menu
- `openCaseInNewTab(exc)` and `openCaseInNewWindow(exc)` functions

**asoe-ui status**: Has `/exceptions/[id]` route (full-page detail) which partially covers this. Missing: print-optimized layout, open-in-new-window functionality.

### 6.8 Context Menus

Right-click on exception rows or mailbox rows shows a contextual menu:

- Exception menu: Open in New Tab, Open in New Window, Run AI Agent, View Detail, Copy Case ID, Copy Doc Number
- Mailbox menu: similar pattern
- Positioned at cursor, clamped to viewport, click-outside-to-close

**asoe-ui status**: **Not built**.

### 6.9 Toast Notification System

Apple HIG-style toast container (top-right):

- Types: info (blue), success (green), warning (orange), error (red)
- Auto-dismiss after 5000ms
- Icon + title + message + close button
- Used for permission denials, action confirmations, errors

**asoe-ui status**: Has `Toast.tsx` component with `ToastProvider` context. **Built**.

---

## 7. Data Models & AI Agents

### 7.1 Exception Data Model Comparison

**Prototype exception object:**
```typescript
{
  id: string;           // 'EXC-1001'
  type: string;         // 8 exception types
  rule: string;         // 'SO-PRICE-001', etc.
  sev: string;          // 'P0' | 'P1' | 'P2'
  aut: string;          // 'L1' | 'L2' | 'L3' | 'L4'
  customer: string;
  bp: string;           // Business Partner number
  docType: string;      // 'Sales Order' | 'Delivery'
  docNum: string;
  line: string;
  sku: string;
  desc: string;
  rootCause: string | null;
  rootCauseLabel: string | null;
  d: object;            // Type-specific details (varies by type)
  ai: object | null;    // AI analysis result
  aiError: string | null;
}
```

**asoe-ui types** (in `src/types/exceptions.ts`):
- Has `ExceptionSummary` and `ExceptionDetail` types
- Maps to backend `Intent`, `LifecycleState`, `ShadowVerdict` enums
- Has `OrderAnalysis`, `LineItem` types
- Missing: `type-specific d` fields, `aut` autonomy level, `rule` reference

**Key type gaps:**
- ~~No `Back-Order`, `Pallet Config`, `Over Max`, `Min Order Qty` type-specific detail interfaces~~ — **Closed**: `BackOrderAnalysisData`, `PalletAnalysisData`, `OverMaxAnalysisData`, `MOQAnalysisData` and their sub-types added in `src/types/exceptions.ts`
- No `QuotaEvent` type at all
- No `MailboxEmail` type with `changeRequest`, `constraints`, `entities`
- No `AutonomyRule` type for the autonomy matrix
- No `Persona` type with permissions/tabs/scope

### 7.2 Type-Specific Detail Data (`d` Field)

Each exception type has specialized detail data. These need TypeScript interfaces:

**Price Mismatch `d`:**
```typescript
{ erpPrice: number; poPrice: number; pct: number; qty: number;
  uom: string; atRisk: number; docDate: string; }
```

**Back-Order (OOS) `d`:**
```typescript
{ orderedQty: number; availableQty: number; gapQty: number; gapPct: number;
  unitPrice: number; uom: string; atRisk: number; atpDate: string;
  primaryDC: { plant: string; name: string; region: string; qty: number; };
  warehouses: Array<{ plant: string; name: string; region: string; qty: number;
    etaDays: number; freightDeltaPerUnit: number; freightDeltaTotal: number; }>;
  substitutes: Array<{ sku: string; desc: string; availableQty: number;
    priceDeltaPct: number; acceptanceRate: number; source: string; priority: number; }>;
  production: { qty: number; date: string; };
  inboundPO: { qty: number; eta: string; poNum: string; } | null; }
```

**Pallet Config `d`:**
```typescript
{ lines: Array<{ sku: string; desc: string; uom: string; unitCost: number;
    layerQty: number; palletQty: number; orderedQty: number; completeLayers: number;
    looseQty: number; fullPallets: number; palletRemainder: number;
    suggestedDown: number; suggestedUp: number; deltaCasesDown: number;
    deltaCasesUp: number; palletFillPct: number; violationType: string; atRisk: number; }>;
  totalOrderedCases: number; looseCasesTotal: number; atRiskTotal: number;
  extraLaborEstHrs: number; freightWastePct: number;
  suggestedPlan: Array<{ sku: string; desc: string; current: number;
    suggested: number; delta: number; layers: number; fullPallets: number; reason: string; }>;
  orderLineCount: number; }
```

**Over Max `d`:**
```typescript
{ orderedQty: number; totalOrdered: number; maxQty: number; excessQty: number;
  exceedancePct: number; sku: string; desc: string; unitCost: number; atRisk: number;
  contractRef: string; blockStatus: string; blockReason: string;
  lines: Array<{ sku: string; desc: string; qty: number; maxLineQty: number;
    isEvenLayerItem: boolean; }>; }
```

**Min Order Qty `d`:**
```typescript
{ orderedQty: number; moqQty: number; shortfallQty: number; shortfallPct: number;
  sku: string; desc: string; unitCost: number; atRisk: number;
  moqSource: string; channel: string; blockMessage: string;
  contractRef: string; blockStatus: string; }
```

### 7.3 AI Agent Specializations

The prototype has **5 specialized AI agents** plus a generic agent and CSR chat:

| Agent | Trigger | Model | Max Tokens | Key Output Fields |
|-------|---------|-------|------------|-------------------|
| **Generic Exception** | Non-pricing exceptions | claude-sonnet-4 | 2000 | narrative, root_cause, autonomy_level, resolution, risk_assessment, customer_response, next_steps |
| **Price Resolution** | Price Mismatch | claude-sonnet-4 | 3000 | pricing_waterfall (steps[]), root_cause (enum), recommended_action (enum), resolution_steps[] |
| **Back-Order/OOS** | Back-Order exceptions | claude-sonnet-4 | 2500 | options[] (4 ranked, each with composite score + sub-scores), resolution type |
| **Over Max** | Over Max exceptions | claude-sonnet-4 | 2500 | trim_plan[] (per-line TRIM/SKIP/OK), total_original_qty, total_trimmed_qty |
| **Min Order Qty** | MOQ exceptions | claude-sonnet-4 | 2500 | round_up_plan[] (per-line ROUND_UP/ACCEPT_BELOW/ESCALATE), sap_steps[] |
| **Quota Intelligence** | Quota events | claude-sonnet-4 | 3000 | allocation_plan[], revenue_impact, options[] (multi-dimensional scoring) |
| **CSR Chat** | Chat panel | claude-sonnet-4 | 1000 | Free-text response |

**Autonomy level rules embedded in prompts:**
- L1 (Auto): < $1K impact, standard account
- L2 (Notify): $1K-$10K impact
- L3 (Approve): > $10K or VIP/Enterprise account
- L4 (Human): > $100K or legal/contractual issues

**asoe-ui status**: Has mock API client in `src/lib/api.ts` with type-specific mock responses for all 8 exception types. Has type-specific AI result schemas (`PriceAnalysisData`, `BackOrderAnalysisData` with `ResolutionOption`, `OverMaxAnalysisData` with `TrimPlanLine`, `MOQAnalysisData` with `RoundUpPlanLine`/`SAPStep`, `PalletAnalysisData` with `PalletSuggestion`). No specialized agent prompts (prompts live in `asoe2`). No idle/running/complete state machine for AI agent execution.

### 7.4 SAP Data Tables (Seed Data)

The prototype builds/imports 13 SAP data tables:

| Table | SAP Source | Fields | asoe-ui Has? |
|-------|-----------|--------|--------------|
| Customers | KNA1/KNVV | BP, Name, Tier, VIP, Credit, Terms | Partial (in mock) |
| Materials | MARA/MARC | Number, Desc, Group, UOM | Partial (in mock) |
| Sales Orders | VBAK/VBAP | SO#, Line, BP, Material, Qty, Prices, Variance, Status | Partial (in mock) |
| Deliveries | LIKP/LIPS | DN#, SO#, BP, Material, Planned Date, Status, Carrier, Days Late | Partial (in mock) |
| Purchase Orders | EKKO/EKPO | PO#, BP, Material, Qty, Price | Not present |
| Billing Documents | VBRK/VBRP | Doc#, SO#, BP, Material, Amount | Not present |
| Inventory | MMBE/MD04 | Plant, Material, Unrestricted, Safety Stock, ATP, Location | Not present |
| Production Orders | AUFK/AFPO | Order#, Material, Plant, Status, Qty, Capacity | Not present |
| Customer Contracts | KNA1+CRM | BP, Contract#, Valid dates, OTIF Target, Auto-Approval | Not present |
| Pricing Conditions | KONP/KONV | Type, Table, BP, Material, Rate, Status | Not present |
| Promotions | ZPROM | ID, Name, Type, SKUs, Discount, Valid dates, ERP loaded | Not present |
| Pricing Procedures | T683S | Procedure (RVAA01), Step, Condition Type | Not present |
| Customer Pricing Groups | KNVV | BP, Procedure, Customer/Price/Discount Group | Not present |

### 7.5 Rules Engine

The prototype's `runRules()` function scans data to generate exceptions:

| Rule | Trigger | Threshold | Severity |
|------|---------|-----------|----------|
| SO-PRICE-001 | Price variance | 1-10% | P1 |
| SO-PRICE-002 | Price variance | > 10% | P0 |
| SD-DELAY-001 | Delivery days late | 2-4 days | P1 |
| SD-DELAY-002 | Delivery days late | >= 5 days | P0 |
| SD-DUP-001 | Same customer+SKU+qty | Within 7 days | P1 |
| SD-STALE-001 | Open order age | > 30 days | P2 |

Additional seed-based exceptions (OOS, Pallet, OverMax, MOQ) are built from predefined data.

**asoe-ui status**: Rules engine logic belongs in `asoe2` backend. UI should display rule references but not execute rules.

### 7.6 Billing / Token Usage Model

```typescript
interface UsageEvent {
  timestamp: Date;
  type: 'EXCEPTION_CLASSIFY' | 'OOS_RESOLUTION' | 'CSR_CHAT' | 'EMAIL_DRAFT';
  agentId: string;
  excType?: string;
  inputTokens: number;
  outputTokens: number;
}
```

**Cost model**: Input tokens @ $3/MTok, Output tokens @ $15/MTok (claude-sonnet-4 pricing).

**Billing plans**: Per Agent Seat ($299/seat/month) or Per Exception ($2.50/exception + token markup).

**asoe-ui status**: No billing types or tracking.

---

## 8. Design System & Component Gaps

### 8.1 CSS Custom Property Comparison

**Prototype tokens** (`:root` and `[data-theme="dark"]`):

| Category | Prototype Tokens | asoe-ui Tokens | Gap |
|----------|-----------------|----------------|-----|
| **Backgrounds** | `--bg`, `--sf`, `--fill`, `--fill2` | `--color-bg`, `--color-surface` | Missing `--fill`, `--fill2` |
| **Labels** | `--lb` (primary), `--ls` (secondary), `--lt` (tertiary) | `--color-text-primary`, `--color-text-secondary` | Missing tertiary |
| **Separator** | `--sep` | `--color-border` | OK |
| **Semantic colors** | `--blue`, `--green`, `--red`, `--orange`, `--purple`, `--teal`, `--indigo`, `--oos` | `--color-brand`, `--color-success`, `--color-danger`, `--color-warning` | Missing: teal, indigo, oos, purple; missing background variants (`--bblue`, `--bgreen`, etc.) |
| **Fonts** | `--font` (body), `--fontd` (display), `--mono` | `--font-family-body`, `--font-family-mono` | Missing display font |
| **Dark mode** | Full override of all tokens under `[data-theme="dark"]` | Partial dark support | **Incomplete dark mode tokens** |

### 8.2 Component Comparison

**Prototype atomic components vs asoe-ui components:**

| Prototype Component | Description | asoe-ui Equivalent | Gap |
|--------------------|-------------|-------------------|-----|
| `badge(text, color, bg, dot)` | Tinted pill with optional dot | `Badge.tsx` | **Built** (similar) |
| `sevBadge(sev)` | Severity badge (P0=red, P1=orange, P2=blue) | Part of `Badge.tsx` variants | **Built** |
| `autBadge(l)` | Autonomy level badge (L1-L4) | Not present | **Missing** |
| `spin(sz, c)` | CSS spinner | `ActivityIndicator.tsx` | **Built** (better) |
| `pBtn` / `sBtn` / `lgBtn` | Primary/secondary/large buttons | `Button.tsx` (5 variants, 3 sizes) | **Built** (better) |
| `fchip` | Filter chip pill | Not a standalone component | **Missing** (inline in pages) |
| `showToast()` | Toast notification | `Toast.tsx` + `ToastProvider` | **Built** |
| `.card` | Base card | `Card.tsx` | **Built** |
| `.ai-card` | AI result card | `AgentReasoningCard.tsx` | **Built** (different approach) |
| `.kpi-tile` | KPI metric tile | `MetricTile.tsx` | **Built** |
| `.prog-bar` / `.prog-fill` | Progress bar | Not present | **Missing** |
| `.exc-row` | Exception list row | `ExceptionListPane.tsx` (inline) | **Built** (inline) |
| `.ctx-row` | Key-value context row | Not present | **Missing** |
| `.dash-card` | Dashboard card with header/body | Not present | **Missing** |
| `.oos-option` | Selectable resolution option card | Not present | **Missing** |
| `.agent-table` | Styled data table | Not present | **Missing** |
| `renderInlineKG` | SVG Knowledge Graph | Not present | **Missing** |
| `renderConstraintGraph` | SVG Constraint Graph | Not present | **Missing** |
| `renderPricingWaterfall` | SAP Pricing Waterfall timeline | `PricingWaterfall.tsx` | **Built** |
| Chat panel | Floating chat assistant | Not present | **Missing** |
| Persona switcher | Dropdown persona selector | Not present | **Missing** |
| Context menu | Right-click actions | Not present | **Missing** |

### 8.3 New Components Needed

Based on the gap analysis, these new reusable components should be created in `src/components/ui/`:

| Component | Purpose | Used By |
|-----------|---------|---------|
| `AutonomyBadge` | L1-L4 autonomy level badge | Exception detail, Rules, Quota |
| `FilterChip` | Pill-style filter chip with count | Exception list, Quota list, Mailbox |
| `ProgressBar` | Horizontal progress bar with fill | Dashboard, Billing, Pallet detail |
| `ContextRow` | Key-value pair row for context cards | All exception details |
| `DashboardCard` | Card with header bar + body section | Dashboard, Performance, Quota Insights |
| `ResolutionOptionCard` | Selectable scored option card | OOS detail, Quota detail |
| `DataTable` | Styled data table with hover | Performance leaderboard, Trim plans, Round-up plans |
| `KnowledgeGraph` | SVG entity-relationship graph | Exception detail, Mailbox, Quota |
| `ConstraintGraph` | SVG constraint evaluation graph | Mailbox change request |
| `ChatPanel` | Floating chat assistant panel | Global (all views) |
| `PersonaSwitcher` | Dropdown persona selector | NavBar |
| `ContextMenu` | Right-click contextual menu | Exception list, Mailbox list |
| ~~`GapBar`~~ | ~~Visual bar showing ordered/available/gap~~ | ~~OOS, Over Max, MOQ details~~ **Built** (`src/components/ui/GapBar.tsx`) |
| `PalletFillBar` | Pallet fill percentage visualization | Pallet Config detail |
| `SparkChart` | SVG mini line chart | Billing dashboard |
| `ScoreBar` | Multi-dimensional score visualization | OOS options, Quota options |
| `StepTimeline` | Vertical step-by-step timeline | Pricing waterfall, Pipeline, SAP steps |
| `ThemeToggle` | Light/Dark/System mode switcher | NavBar, Settings |

### 8.4 Animation & Motion

The prototype uses these animations:

| Animation | CSS | asoe-ui Status |
|-----------|-----|----------------|
| `spin` | `rotate(360deg)` loop | Built (ActivityIndicator) |
| `fadein` | `opacity 0→1` | Partial |
| `slidein` | `opacity 0→1, translateX(8px→0)` | Not present |
| `slideInRight` | `opacity 0→1, translateX(40px→0)` | Not present |
| `personaswitch` | `opacity 0→1, translateY(-6px→0), scale(.98→1)` | Not present |
| Reduced motion | `prefers-reduced-motion: reduce` override | Built (in design tokens) |

### 8.5 Accessibility Patterns

| Pattern | Prototype | asoe-ui | Gap |
|---------|-----------|---------|-----|
| Focus rings | `2px solid var(--blue)` on `:focus-visible` | `2px solid var(--color-brand-ring)` | **Built** |
| Min touch targets | 36px buttons, 44px large buttons | Present | **Built** |
| Reduced motion | `prefers-reduced-motion` media query | Present in tokens | **Built** |
| Color-alone indicators | Some reliance on color-only (autonomy badges use color only) | Icon + text required (WCAG 1.4.1) | asoe-ui is **stricter** (good) |
| ARIA attributes | Minimal in prototype | `aria-live`, `role="dialog"`, `aria-modal` | asoe-ui is **better** |
| Keyboard navigation | Basic `:focus-visible` | Full keyboard nav | asoe-ui is **better** |

---

## 9. Implementation Priority Matrix

### 9.1 Effort Estimation

| Priority | Feature | Effort | New Components | New Types | New Routes |
|----------|---------|--------|----------------|-----------|------------|
| **P0** ✅ | Type-specific exception detail panels (Price, OOS, Pallet, OverMax, MOQ) | XL | **Done** — 5 renderers + GapBar built | 5 detail interfaces (PriceAnalysisData, BackOrderAnalysisData, OverMaxAnalysisData, MOQAnalysisData, PalletAnalysisData) | None (enhanced `/exceptions`) |
| **P0** | Dark mode / Theme system | M | ThemeToggle | None | None |
| **P0** | NavBar enhancements (persona pill, theme toggle, databar) | M | PersonaSwitcher, ThemeToggle, Databar | Persona type | None |
| **P1** | Quota Management tab | XL | Full page + list + detail + insights + AI result | QuotaEvent, QuotaAIResult | `/quota` |
| **P1** | Performance Dashboard tab | L | Full page + 3 sections + comparison cards | PerformanceMetrics | `/performance` |
| **P1** | CSR Chat Panel | L | ChatPanel, useChat hook | ChatMessage | None (global floating) |
| **P1** | Customer Inbox — Order Change Workflow | XL | ConstraintCard, ConstraintGraph, ScenarioCard, DecisionPanel | ChangeRequest, Constraint | Enhance `/inbox` |
| **P1** | Audit Trail Drawer | M | AuditDrawer | AuditEvent | None (enhance `/exceptions`) |
| **P2** | Admin Panel — Rules & Autonomy Matrix | L | RulesTable, AddRuleModal | AutonomyRule | Enhance `/settings` or overlay |
| **P2** | Admin Panel — Billing & Usage | L | SparkChart, AgentUsageRow | UsageEvent, BillingPlan | Enhance `/settings` |
| **P2** | Admin Panel — Ontology Explorer | XL | OntologyGraph, EntityDetail, ActionModal | OntologyEntity | Enhance `/settings` |
| **P2** | Admin Panel — Team & Personas | L | PersonaEditor, PermissionToggle | Persona (extended) | Enhance `/settings` |
| **P2** | Knowledge Graphs (SVG) | L | KnowledgeGraph | KGConfig | None (embedded) |
| **P2** | EDI 850 Viewer | L | EDI850Viewer (3 sub-views) | EDI850 | Enhance `/inbox` |
| **P2** | AI Order Extraction | L | OrderEntryForm, PalletValidation | OrderExtraction | Enhance `/inbox` |
| **P3** | Upload / Data Ingestion screen | M | UploadScreen, SheetGrid | None | Modal/overlay |
| **P3** | Context Menus | S | ContextMenu | None | None (global) |
| **P3** | Case Popout (print-friendly) | S | None (enhance existing route) | None | None |
| **P3** | Admin Panel — Appearance | S | ThemePicker | None | Enhance `/settings` |
| **P3** | Admin Panel — Data Management | S | DataManagement | None | Enhance `/settings` |
| **P3** | Admin Panel — Connections | S | ConnectionsList | None | Enhance `/settings` |
| **P3** | Admin Panel — System | S | SystemInfo | None | Enhance `/settings` |
| **P3** | Simulate Inbound Modal | S | SimulateModal | None | Enhance `/inbox` |

**Effort key**: S = Small (< 1 day), M = Medium (1-2 days), L = Large (2-4 days), XL = Extra Large (4+ days)

### 9.2 Recommended Implementation Phases

#### Phase A — Core Exception Enhancement (P0) — ✅ MOSTLY COMPLETE

**Goal**: Make the flagship Exception Queue match the prototype's depth.

1. ✅ Add missing exception types to TypeScript types (`Back-Order`, `Pallet Config`, `Over Max`, `Min Order Qty`) — Done
2. ✅ Build type-specific detail interfaces for each exception type's `d` field — Done (`PriceAnalysisData`, `BackOrderAnalysisData`, `OverMaxAnalysisData`, `MOQAnalysisData`, `PalletAnalysisData`)
3. ✅ Create shared components: `GapBar` — Done. Remaining: `AutonomyBadge`, `FilterChip`, `ContextRow`, `ProgressBar`, `DataTable`
4. ✅ Build 5 dedicated detail renderers dispatched by exception type — Done (data-presence pattern, not type dispatch)
5. Implement AI agent state machine (Idle → Running → Error → Result) per exception type — **Remaining**
6. Add Audit Trail Drawer to the exception queue view — **Remaining**
7. Implement dark mode with full token overrides and `ThemeToggle` — **Remaining**

#### Phase B — New Operational Tabs (P1)

**Goal**: Add the two missing operational views.

1. Create `/quota` route with page, types, and mock API
2. Build Quota Queue sub-view (list + detail + AI result)
3. Build Quota Insights sub-view (KPIs + charts)
4. Create `/performance` route with page and types
5. Build 3 performance sections (AI Agent, Human Team, Comparison)
6. Build CSR Chat Panel as a global floating component

#### Phase C — Customer Inbox Deep Features (P1-P2)

**Goal**: Add the advanced inbox capabilities.

1. Implement Order Change Workflow with 10 constraint checks
2. Build Constraint Graph (SVG) component
3. Build EDI 850 Viewer (3 sub-views)
4. Build AI Order Extraction with editable form
5. Add AI Intake Pipeline sub-view
6. Add Simulate Inbound modal

#### Phase D — Admin & Cross-Cutting (P2-P3)

**Goal**: Build admin functionality and polish.

1. Restructure Settings as overlay pane (or keep as route — architectural decision)
2. Build Rules & Autonomy Matrix with CRUD
3. Build Billing & Usage dashboard
4. Build Ontology Explorer
5. Build Team & Personas editor
6. Add Knowledge Graph component (reusable across all views)
7. Add Context Menus, Case Popout, Upload Screen
8. Build remaining admin sections (Appearance, Data, Connections, System)

### 9.3 Key Architectural Decisions Needed

| Decision | Options | Recommendation |
|----------|---------|----------------|
| **Admin panel** | Dedicated route (`/settings`) vs slide-over overlay | Keep as route (consistent with Next.js), but add sidebar navigation matching prototype's 8 sections |
| **Exception type dispatch** | Single component with switch vs separate components | Separate components per type, dispatched by a parent `ExceptionDetailRouter` |
| **State for AI execution** | Local state vs global store | Local state in detail components (matches current pattern) |
| **Persona system** | Context provider vs route-level | Context provider wrapping the app, similar to `ToastProvider` |
| **Chat panel** | Route vs floating component | Floating component with context provider for state |
| **Theme** | CSS-only vs JS+CSS | JS toggle + CSS custom property overrides (prototype approach) |
| **Knowledge Graph** | SVG in React vs Canvas vs library | SVG in React (matches prototype, good for interactivity) |
| **Upload screen** | Route vs modal/overlay | Modal overlay (matches prototype, doesn't need a route) |

---

*Document generated from analysis of AgenticOM prototype (Issue #50) against asoe-ui codebase.*
*Branch: `claude/improve-asoe-ui-n9kQL`*
