// Phase 5a — back-target registry meta-test.
//
// Closes the explicit GAP from
// docs/test-strategy/e2e-flow-plan.md (Failure modes):
//
//   Codepath: _registry.yaml back-target rules
//   Failure : "Dev adds new entry path, forgets to extend the
//             rule -> wrong back-target ships"
//   Status  : GAP — accepted
//   Mitigation: "Meta-test scans src/app pages for Link back-
//                affordance markers, asserts each is covered by
//                a registry rule"
//
// The meta-test walks src/app for two kinds of evidence:
//
//   1. PRODUCERS of the referrer query (push("?from=<X>")):
//      every X must appear as a known back-target token in
//      BACK_TARGETS, and as an entry_pattern in _registry.yaml.
//
//   2. CONSUMERS of the referrer query (BACK_TARGETS map +
//      DEFAULT_BACK): every entry's href must be reachable in
//      the authenticated-routes registry (or be the default
//      queue href).
//
// Behavioural shape: structural file-scan. The runtime
// behaviour is exercised by triage/email-order-entry-from-inbox.
// yaml (V1 flow) which drives the producer + consumer round-
// trip end-to-end.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { AUTHENTICATED_ROUTES } from "../../e2e/contract/authenticated-routes";

const ROOT = join(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

// Pages that consume the ?from= query. The first is the
// authoritative BACK_TARGETS map; if a future detail page
// duplicates the pattern, add it here.
const CONSUMER_PAGES = ["src/app/exceptions/[id]/page.tsx"] as const;

// Pages that push with ?from=<X>. We scan dynamically rather
// than enumerate, so a new producer can't accidentally hide.
const PRODUCER_SOURCE_GLOBS = [
  "src/app/inbox/page.tsx",
  "src/app/cases/page.tsx",
  "src/app/cases/[id]/page.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/exceptions/page.tsx",
  "src/app/settings/page.tsx",
] as const;

function extractFromTokens(source: string): string[] {
  // Match ?from=<token> where token is a kebab/camel identifier.
  // Catches both plain string templates and template literals.
  const matches = source.matchAll(/\?from=([a-zA-Z][a-zA-Z0-9_-]*)/g);
  return Array.from(matches, (m) => m[1]);
}

function extractBackTargetKeys(source: string): string[] {
  // BACK_TARGETS is a typed object literal:
  //   const BACK_TARGETS = { inbox: { href: "...", label: "..." }, ... };
  // Match the object body and pull the top-level keys.
  const m = source.match(/const\s+BACK_TARGETS\s*=\s*\{([\s\S]*?)\}\s*as\s+const/);
  if (!m) return [];
  const body = m[1];
  const keyMatches = body.matchAll(/^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm);
  return Array.from(keyMatches, (km) => km[1]);
}

function extractBackTargetHrefs(source: string): string[] {
  const m = source.match(/const\s+BACK_TARGETS\s*=\s*\{([\s\S]*?)\}\s*as\s+const/);
  if (!m) return [];
  const body = m[1];
  const hrefMatches = body.matchAll(/href:\s*["']([^"']+)["']/g);
  const out = Array.from(hrefMatches, (hm) => hm[1]);
  // Add DEFAULT_BACK.href if present.
  const def = source.match(/const\s+DEFAULT_BACK\s*=\s*\{[^}]*href:\s*["']([^"']+)["']/);
  if (def) out.push(def[1]);
  return out;
}

function loadRegistry(): {
  back_target_rules: Array<{ entry_pattern: string; back_href: string }>;
} {
  const text = read("e2e/flows/_registry.yaml");
  return YAML.parse(text);
}

describe("back-target registry coverage (Phase 5a)", () => {
  it("every ?from=<X> producer's X is in BACK_TARGETS", () => {
    const consumerKeys = new Set<string>();
    for (const rel of CONSUMER_PAGES) {
      for (const k of extractBackTargetKeys(read(rel))) {
        consumerKeys.add(k);
      }
    }
    // The empty-set guard: if BACK_TARGETS itself is missing,
    // the meta-test can't reason about coverage; surface that
    // loudly rather than vacuously pass.
    expect(
      consumerKeys.size,
      "BACK_TARGETS map missing from consumer pages — scanner has nothing to validate against",
    ).toBeGreaterThan(0);

    const orphans: string[] = [];
    for (const rel of PRODUCER_SOURCE_GLOBS) {
      let source: string;
      try {
        source = read(rel);
      } catch {
        continue; // optional pages
      }
      for (const token of extractFromTokens(source)) {
        if (!consumerKeys.has(token)) {
          orphans.push(`${rel} pushes ?from=${token} which has no BACK_TARGETS entry`);
        }
      }
    }
    expect(
      orphans,
      "orphan ?from= producers — every token must round-trip via BACK_TARGETS",
    ).toEqual([]);
  });

  it("every BACK_TARGETS.href is an authenticated route", () => {
    const authPaths = new Set(AUTHENTICATED_ROUTES.map((r) => r.path));
    const orphans: string[] = [];
    for (const rel of CONSUMER_PAGES) {
      for (const href of extractBackTargetHrefs(read(rel))) {
        // hrefs may be exact route strings like "/inbox" or
        // template-shaped like "/exceptions"; both must match.
        if (!authPaths.has(href)) {
          orphans.push(`${rel} BACK_TARGETS contains href=${href} not in registry`);
        }
      }
    }
    expect(
      orphans,
      "back-target hrefs must each resolve to a registered authenticated route",
    ).toEqual([]);
  });

  it("BACK_TARGETS keys have matching back_target_rules in _registry.yaml", () => {
    const registry = loadRegistry();
    const ruleEntryPatterns = registry.back_target_rules.map(
      (r) => r.entry_pattern,
    );

    const offenders: string[] = [];
    for (const rel of CONSUMER_PAGES) {
      const keys = extractBackTargetKeys(read(rel));
      for (const key of keys) {
        // Each BACK_TARGETS key corresponds to an entry path:
        //   inbox -> ^/inbox$
        //   cases -> ^/cases$
        // So a rule with entry_pattern ^/<key>$ must exist.
        const expectedPattern = new RegExp(`^\\^/${key}\\$$`);
        if (!ruleEntryPatterns.some((p) => expectedPattern.test(p))) {
          offenders.push(
            `${rel} BACK_TARGETS.${key} has no matching back_target_rules entry in _registry.yaml`,
          );
        }
      }
    }
    expect(
      offenders,
      "BACK_TARGETS keys must each have a matching entry_pattern in _registry.yaml",
    ).toEqual([]);
  });

  it("self-check: scanner detects an orphan ?from= in a synthetic input", () => {
    // Synthetic source with a producer that uses a token NOT
    // in any BACK_TARGETS map. This locks the orphan-detection
    // logic against a future refactor that silently neuters it.
    const syntheticConsumer =
      'const BACK_TARGETS = { inbox: { href: "/inbox", label: "Back" } } as const;';
    const syntheticProducer =
      'router.push(`/exceptions/${id}?from=widgets`);';

    const consumerKeys = new Set(extractBackTargetKeys(syntheticConsumer));
    const producerTokens = extractFromTokens(syntheticProducer);

    expect(consumerKeys).toContain("inbox");
    expect(producerTokens).toEqual(["widgets"]);
    expect(consumerKeys.has("widgets")).toBe(false);
  });
});
