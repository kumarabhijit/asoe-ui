/**
 * Shared NAV_TABS — single source of truth for the top-of-screen
 * tab list (issue #133, PO points #5, #6, #9).
 *
 * Pre-#133 anatomy duplicated the list in seven page files; the
 * post-#133 reshape splits "Home" (operational SLA/case view) from
 * "Performance" (analytics / agent metrics), retires the redundant
 * "Customer Inbox" tab (PO #9 — `/inbox` now redirects to
 * `/cases?source=manual_order`), and keeps tab ids stable so role-
 * derived `visible_tabs` from `asoe2/api/users.py` continue to gate
 * visibility (Guardrail #1 — no `if tab.id === "..."` switches in
 * page code).
 */
export interface NavTab {
  id: string;
  label: string;
  href: string;
}

// Mutable array (no `as const`) because NavBar's `tabs` prop is a
// plain `NavTab[]`; pages call `NAV_TABS.find(...)` and the filtered
// subset is passed straight through.
export const NAV_TABS: NavTab[] = [
  { id: "home", label: "Home", href: "/home" },
  { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
  { id: "cases", label: "Cases", href: "/cases" },
  { id: "dashboard", label: "Performance", href: "/dashboard" },
  { id: "settings", label: "Settings", href: "/settings" },
];
