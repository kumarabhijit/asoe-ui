import { redirect } from "next/navigation";

export default function Root() {
  // Protected by middleware — if user reaches here, they're authenticated.
  // Issue #133 (PO #5/#6): the operational landing surface is /home;
  // /dashboard is now reserved for agent-performance analytics.
  redirect("/home");
}
