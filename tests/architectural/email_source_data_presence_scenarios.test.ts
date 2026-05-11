/**
 * Email-source data-presence locks, parameterised over the
 * BehaviourScenario library (S7).
 *
 * The original
 * tests/architectural/email_source_section_data_presence.test.ts
 * holds the structural dispatch lock (ExceptionDetailPanel mounts
 * EmailSourceSection via `analysis.email_source &&`, never on an
 * intent literal). This file complements it by asserting the
 * scenario library carries the right `email_source` payload shape
 * across every covered intent.
 *
 * Invariants:
 *   * Every scenario with `email_source` defined has a non-empty
 *     `from_address`, `subject`, `body_hash`, and `received_at`
 *     (the audit-bearing fields per ADR-034 Phase G).
 *   * Scenarios without `email_source` are EITHER non-email
 *     channels OR explicitly marked source=automated_order. A
 *     manual_order scenario with no email_source is a bug.
 *   * No scenario has `email_source.source_email_id` set to an
 *     empty string — that would round-trip to "Source email id "
 *     (trailing space) in the UI's monospace render.
 *   * `email_source.attachment_manifest` is an array (may be
 *     empty); never undefined when the section is mounted.
 */
import { describe, it, expect } from "vitest";
import { SCENARIOS } from "../scenarios";

describe.each(SCENARIOS)("email_source data presence — $id", (s) => {
  const hasEmail = s.email_source !== undefined;

  it("manual_order cases without email_source are not permitted", () => {
    if (s.case.source !== "manual_order") return;
    expect(
      hasEmail,
      `scenario ${s.id} is manual_order but has no email_source — ADR-034 Phase G requires the source surface`,
    ).toBe(true);
  });

  it("when email_source is present, audit-bearing fields are non-empty", () => {
    if (!hasEmail) return;
    const e = s.email_source!;
    expect(e.from_address.length).toBeGreaterThan(0);
    expect(e.subject.length).toBeGreaterThan(0);
    expect(e.body_hash.length).toBeGreaterThan(0);
    expect(e.received_at.length).toBeGreaterThan(0);
  });

  it("source_email_id (when present) is non-empty", () => {
    if (!hasEmail) return;
    const id = s.email_source!.source_email_id;
    if (id !== undefined && id !== null) {
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it("attachment_manifest is always an array when email_source is mounted", () => {
    if (!hasEmail) return;
    expect(Array.isArray(s.email_source!.attachment_manifest)).toBe(true);
  });
});

describe("email_source coverage across the scenario library", () => {
  it("at least one scenario carries email_source (positive path)", () => {
    expect(SCENARIOS.some((s) => s.email_source !== undefined)).toBe(true);
  });

  it("at least one scenario has no email_source (negative path — automated_order)", () => {
    expect(SCENARIOS.some((s) => s.email_source === undefined)).toBe(true);
  });
});
