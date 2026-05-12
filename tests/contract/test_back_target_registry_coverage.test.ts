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
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import YAML from "yaml";
import {
  AUTHENTICATED_ROUTES,
  REDIRECT_ROUTES,
} from "../../e2e/contract/authenticated-routes";

const ROOT = join(__dirname, "..", "..");
const APP_ROOT = join(ROOT, "src", "app");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf-8");
}

// Auto-discover every src/app/**/page.tsx so a new producer or
// consumer can't accidentally hide from coverage. Replaces the
// hand-curated CONSUMER_PAGES + PRODUCER_SOURCE_GLOBS lists from
// Phase 5a — Item 23 from the pending tasks list.
function listPageFiles(): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry === "page.tsx") {
        out.push(relative(ROOT, full).split(sep).join("/"));
      }
    }
  }
  walk(APP_ROOT);
  return out.sort();
}

// A page is a CONSUMER if it declares a `const BACK_TARGETS = { ... } as const`
// block. The Phase 5a extractor pattern still finds it; we just
// scan every page rather than a fixed list.
function findConsumerPages(): string[] {
  return listPageFiles().filter((rel) =>
    /const\s+BACK_TARGETS\s*=\s*\{/.test(read(rel)),
  );
}

// A page is a PRODUCER if it pushes URLs with ?from=<token>. Every
// page is a potential producer; we scan them all in the orphan
// check below rather than enumerate.
const PRODUCER_SOURCE_GLOBS = listPageFiles();

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
    for (const rel of findConsumerPages()) {
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

  it("every BACK_TARGETS.href resolves to an authenticated route (allowing query strings + redirect aliases)", () => {
    const authPaths = new Set(AUTHENTICATED_ROUTES.map((r) => r.path));
    const redirectPaths = new Set(REDIRECT_ROUTES);
    const orphans: string[] = [];
    for (const rel of findConsumerPages()) {
      for (const href of extractBackTargetHrefs(read(rel))) {
        // Strip query string + hash — the route registry holds
        // paths only. Issue #133 introduced filtered-view back
        // targets like "/cases?source=manual_order" which point
        // at /cases with a filter; the auth check is on the path.
        const path = href.split(/[?#]/)[0];
        // Accept either an authenticated route (canonical) or a
        // redirect alias (e.g. /inbox -> /cases). Both surface
        // chrome on arrival, so back-target validity holds.
        if (!authPaths.has(path) && !redirectPaths.has(path)) {
          orphans.push(`${rel} BACK_TARGETS contains href=${href} not in registry`);
        }
      }
    }
    expect(
      orphans,
      "back-target hrefs must each resolve to a registered authenticated route or redirect alias",
    ).toEqual([]);
  });

  it("BACK_TARGETS keys have a matching back_target_rule OR a redirect alias", () => {
    const registry = loadRegistry();
    const ruleEntryPatterns = registry.back_target_rules.map(
      (r) => r.entry_pattern,
    );
    // Redirect aliases (issue #133): /<key> may live in
    // REDIRECT_ROUTES rather than having its own back_target_rule.
    // The alias hits the redirect, which terminates at a real
    // authenticated route — chrome contract still holds.
    const redirectPaths = new Set(REDIRECT_ROUTES);

    const offenders: string[] = [];
    for (const rel of findConsumerPages()) {
      const keys = extractBackTargetKeys(read(rel));
      for (const key of keys) {
        // Each BACK_TARGETS key corresponds to an entry path:
        //   inbox -> ^/inbox$  (or redirect alias /inbox)
        //   cases -> ^/cases$
        const expectedPattern = new RegExp(`^\\^/${key}\\$$`);
        const hasRule = ruleEntryPatterns.some((p) =>
          expectedPattern.test(p),
        );
        const hasRedirectAlias = redirectPaths.has(`/${key}`);
        if (!hasRule && !hasRedirectAlias) {
          offenders.push(
            `${rel} BACK_TARGETS.${key} has no matching back_target_rules entry and no redirect alias`,
          );
        }
      }
    }
    expect(
      offenders,
      "BACK_TARGETS keys must each have a back_target_rules entry or a redirect alias in REDIRECT_ROUTES",
    ).toEqual([]);
  });

  it("autodiscovery: scans every src/app/**/page.tsx", () => {
    const pages = listPageFiles();
    expect(pages.length).toBeGreaterThan(5);
    // All paths are src/app/-rooted.
    for (const p of pages) {
      expect(p.startsWith("src/app/")).toBe(true);
    }
  });

  it("autodiscovery: finds at least one consumer page (BACK_TARGETS owner)", () => {
    const consumers = findConsumerPages();
    expect(
      consumers.length,
      "no BACK_TARGETS map found in any src/app/**/page.tsx — has the consumer page been removed?",
    ).toBeGreaterThan(0);
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
