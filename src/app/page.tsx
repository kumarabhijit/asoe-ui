import { redirect } from "next/navigation";

export default function Home() {
  // Protected by middleware — if user reaches here, they're authenticated.
  // Redirect to the Exception Queue (flagship view per Section 11.5).
  redirect("/exceptions");
}
