/**
 * /inbox — server redirect to the filtered case-list view
 * (issue #133, PO points #1, #7, #9).
 *
 * The 2026-05 PO review flagged the Customer Inbox screen as
 * redundant with /cases: both are case-list surfaces, and the
 * post-PR-#141 reshape had already reduced /inbox to a thin
 * filtered projection (`casesApi.list({ source: "manual_order" })`).
 * Keeping a parallel page meant inconsistency between the two
 * (PO #7) and an empty-feeling right pane (PO #1).
 *
 * The route is preserved as a permanent server redirect so any
 * deep-links from notification emails, browser history, or
 * runbooks keep working. The query string carries the source
 * filter that the CaseListPane on /cases already supports.
 */
import { redirect } from "next/navigation";

export default function InboxRedirect() {
  redirect("/cases?source=manual_order");
}
