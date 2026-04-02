import { redirect } from "next/navigation";

export default function Home() {
  // Protected by middleware — if user reaches here, they're authenticated.
  // Redirect to the Customer Inbox (primary landing page).
  redirect("/inbox");
}
