/**
 * BoundaryError — the shared App Router error-boundary body.
 *
 * Must NOT leak the raw `error.message` (a client boundary catches arbitrary
 * thrown values whose message may carry internal detail) — it shows a generic
 * line plus the opaque `error.digest` for support correlation.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BoundaryError } from "@/components/ui/BoundaryError";

describe("BoundaryError", () => {
  // REGRESSION (fails on parent): each route error.tsx rendered
  // `{error?.message || "…"}`, leaking the raw message.
  it("does not render the raw error.message", () => {
    const error = Object.assign(new Error("SELECT * FROM users WHERE token=hunter2"), {
      digest: "abc123",
    });
    render(
      <BoundaryError title="Dashboard failed to load" error={error} reset={() => {}} retryLabel="Retry loading dashboard" />,
    );
    expect(screen.queryByText(/hunter2/)).toBeNull();
    expect(screen.queryByText(/SELECT \* FROM/)).toBeNull();
  });

  it("shows the opaque digest as a support reference", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(
      <BoundaryError title="Dashboard failed to load" error={error} reset={() => {}} retryLabel="Retry loading dashboard" />,
    );
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it("is an alert with a labelled retry control", () => {
    const error = Object.assign(new Error("boom"), { digest: "d1" });
    render(
      <BoundaryError title="Cases failed to load" error={error} reset={() => {}} retryLabel="Retry loading cases" />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry loading cases" })).toBeInTheDocument();
    expect(screen.getByText("Cases failed to load")).toBeInTheDocument();
  });
});
