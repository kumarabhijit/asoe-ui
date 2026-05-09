/**
 * Search-query parser for the Exception Queue list pane.
 *
 * Splits a free-text query into two halves:
 *
 *   1. **Operators** — `key:value` (or `key:"quoted value"`) tokens
 *      that become structured constraints on `ExceptionSummary` fields:
 *
 *        account:walmart      → account_name (case-insensitive contains)
 *        state:pending_review → lifecycle_state (exact, normalised)
 *        intent:duplicate_po  → intent (exact, normalised)
 *        verdict:red          → shadow_verdict (exact, normalised)
 *        since:7d             → updated_at >= now - 7 days
 *        since:2026-04-20     → updated_at >= 2026-04-20T00:00 (local)
 *        before:24h           → updated_at <  now - 24 hours
 *        before:2026-04-20    → updated_at <  2026-04-20T00:00 (local)
 *
 *      Unknown / malformed operators are not silently dropped — they
 *      fall through to the free-term half so the operator still sees
 *      *something* match, and a `warnings` field surfaces the parse
 *      failure for the UI to (optionally) display.
 *
 *   2. **Free terms** — everything else. Joined back into a single
 *      query string and passed to `Fuse.js` for typo-tolerant fuzzy
 *      multi-token matching against
 *      `order_id / id / intent / event_type / account_name`.
 *
 * Both halves are AND-combined: a row passes only if every operator
 * holds AND the free-term query produces a Fuse hit (or is empty).
 *
 * Pure module — no React, no fetches. Keeps the parsing logic
 * unit-testable and the page-level filter pipeline thin.
 */
import Fuse from "fuse.js";
import type { ExceptionSummary } from "@/types/exceptions";

/* ── Operator tokens ─────────────────────────────────────────────── */

export type OperatorKey =
  | "account"
  | "state"
  | "intent"
  | "verdict"
  | "since"
  | "before";

export interface OperatorToken {
  key: OperatorKey;
  /** Original raw value as the user typed it (used for display chips). */
  rawValue: string;
}

export interface SearchTokens {
  operators: OperatorToken[];
  freeText: string;
  /** Non-fatal parse warnings — e.g., an unknown `foo:bar` token or an
   *  unparseable date. UI may render these as a hint without failing. */
  warnings: string[];
}

const OPERATOR_KEYS: ReadonlySet<OperatorKey> = new Set([
  "account",
  "state",
  "intent",
  "verdict",
  "since",
  "before",
]);

/**
 * Tokenise a free-text query string into operators + free terms.
 *
 * Tokens are whitespace-separated, with double quotes used to keep
 * spaces inside a value (e.g., `account:"acme corp"`). Quotes are
 * stripped from the parsed value.
 */
/**
 * SCREAMING_SNAKE_CASE single-token shortcut.
 *
 * When the entire query is one bare token shaped like an enum value
 * (`/^[A-Z][A-Z0-9_]+$/` with at least one underscore, length ≥ 4),
 * promote it to an `intent:` operator instead of letting it fall
 * through to Fuse fuzzy matching.
 *
 * Why: Fuse with `threshold: 0.4` + `ignoreLocation: true` returns
 * the *closest* row when no exact match exists. A user typing
 * `EMAIL_ORDER_ENTRY` without any matching record would otherwise see
 * an unrelated `MIN_ORDER_QTY` row surface (shared `_ORDER_`
 * substring). Promoting to `intent:` yields zero matches when no
 * record has that intent — surprising-but-correct rather than
 * surprising-and-wrong.
 *
 * Trade-off: the promotion is silent (no warning) because typing an
 * intent value is the obviously intended behaviour. Users who want a
 * substring search for an enum-shaped string can wrap it in quotes —
 * `"EMAIL_ORDER_ENTRY"` falls through to free-text.
 */
const ENUM_LIKE_RE = /^[A-Z][A-Z0-9_]{3,}$/;

function isEnumLikeIntentQuery(raw: string): boolean {
  const trimmed = raw.trim();
  if (!ENUM_LIKE_RE.test(trimmed)) return false;
  if (!trimmed.includes("_")) return false;
  return true;
}

export function parseQuery(raw: string): SearchTokens {
  const operators: OperatorToken[] = [];
  const freeParts: string[] = [];
  const warnings: string[] = [];

  if (!raw.trim()) return { operators, freeText: "", warnings };

  // SCREAMING_SNAKE_CASE shortcut — the whole query is treated as
  // `intent:<value>`. Bypasses Fuse entirely; see helper above for
  // rationale.
  if (isEnumLikeIntentQuery(raw)) {
    operators.push({ key: "intent", rawValue: raw.trim() });
    return { operators, freeText: "", warnings };
  }

  // Tokeniser — splits on whitespace but respects "double-quoted"
  // chunks. Three alternatives, in order:
  //   1. key:"quoted value with spaces"  — keeps the operator + value together
  //   2. "bare quoted value"             — quoted free-term
  //   3. \S+                             — any non-whitespace run
  const tokenRe = /[^\s":]+:"[^"]*"|"[^"]*"|\S+/g;
  const tokens = raw.match(tokenRe) ?? [];

  for (const tok of tokens) {
    const colonIdx = tok.indexOf(":");
    // Bare term (no colon): goes straight to the free-text bucket.
    // Quoted bare terms have their quotes stripped here so Fuse sees
    // the raw substring.
    if (colonIdx === -1) {
      freeParts.push(unquote(tok));
      continue;
    }

    const keyRaw = tok.slice(0, colonIdx).toLowerCase();
    const valueRaw = unquote(tok.slice(colonIdx + 1));

    if (!OPERATOR_KEYS.has(keyRaw as OperatorKey) || valueRaw === "") {
      // Unknown operator or empty value — fall through to free-text
      // so the operator at least gets *some* result, and surface a
      // warning so the UI can hint that the syntax wasn't recognised.
      warnings.push(`Unknown operator '${tok}' — falling back to text search`);
      freeParts.push(tok);
      continue;
    }

    operators.push({ key: keyRaw as OperatorKey, rawValue: valueRaw });
  }

  return {
    operators,
    freeText: freeParts.join(" ").trim(),
    warnings,
  };
}

function unquote(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Inverse of `parseQuery` — emit a canonical query string from
 * structured tokens. Values containing whitespace are re-quoted.
 * Used when the operator removes a parsed-operator chip from the
 * active-filter row: the list pane reparses → mutates → reserialises
 * the search string.
 *
 * Round-trip is canonical, not byte-identical: `parseQuery(stringify(t))`
 * yields equivalent tokens, but the original spacing / quote style
 * may not be preserved. The operator never sees this — they edit the
 * search box freely; the chip-remove path is the only consumer.
 */
export function stringifyTokens(tokens: SearchTokens): string {
  const parts: string[] = [];
  for (const op of tokens.operators) {
    const v = /\s/.test(op.rawValue) ? `"${op.rawValue}"` : op.rawValue;
    parts.push(`${op.key}:${v}`);
  }
  if (tokens.freeText) parts.push(tokens.freeText);
  return parts.join(" ");
}

/* ── Operator → predicate ────────────────────────────────────────── */

const NORMALISE = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, "_");

/**
 * Convert one operator into a predicate. Returns `null` if the
 * operator value is unparseable (e.g., a bad `since:` duration);
 * the page-level pipeline treats `null` as "ignore this operator and
 * surface a warning."
 */
export function operatorToPredicate(
  op: OperatorToken,
  now: Date = new Date(),
): { predicate: (e: ExceptionSummary) => boolean; warning?: string } | null {
  switch (op.key) {
    case "account": {
      const needle = op.rawValue.toLowerCase();
      return {
        predicate: (e) =>
          (e.account_name?.toLowerCase().includes(needle) ?? false) ||
          (e.account_id?.toLowerCase().includes(needle) ?? false),
      };
    }
    case "state": {
      const target = NORMALISE(op.rawValue).toUpperCase();
      return {
        predicate: (e) => e.lifecycle_state.toUpperCase() === target,
      };
    }
    case "intent": {
      const target = NORMALISE(op.rawValue).toUpperCase();
      return {
        predicate: (e) => (e.intent ?? "").toUpperCase() === target,
      };
    }
    case "verdict": {
      const target = op.rawValue.trim().toUpperCase();
      return {
        predicate: (e) => (e.shadow_verdict ?? "").toUpperCase() === target,
      };
    }
    case "since": {
      const ts = parseDateOrDuration(op.rawValue, now, "since");
      if (ts === null) {
        return {
          predicate: () => true,
          warning: `Couldn't parse 'since:${op.rawValue}' — expected ISO date or duration like '7d' / '24h'`,
        };
      }
      return {
        predicate: (e) => Date.parse(e.updated_at ?? e.created_at) >= ts,
      };
    }
    case "before": {
      const ts = parseDateOrDuration(op.rawValue, now, "before");
      if (ts === null) {
        return {
          predicate: () => true,
          warning: `Couldn't parse 'before:${op.rawValue}' — expected ISO date or duration like '7d' / '24h'`,
        };
      }
      return {
        predicate: (e) => Date.parse(e.updated_at ?? e.created_at) < ts,
      };
    }
  }
}

/**
 * Accept either an ISO-ish date (`2026-04-20`, `2026-04-20T08:00`) or
 * a duration (`24h`, `7d`, `30m`). Returns the absolute epoch-ms or
 * `null` on parse failure. `mode` flips the duration from "since" (now
 * minus duration) to "before" (also now minus duration — operator
 * applies the < comparator).
 */
function parseDateOrDuration(raw: string, now: Date, _mode: "since" | "before"): number | null {
  const trimmed = raw.trim();

  // Duration form: <number>(m|h|d|w)
  const durRe = /^(\d+)\s*([mhdw])$/i;
  const m = trimmed.match(durRe);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    const ms =
      unit === "m" ? n * 60_000 :
      unit === "h" ? n * 3_600_000 :
      unit === "d" ? n * 86_400_000 :
      /* w */        n * 7 * 86_400_000;
    return now.getTime() - ms;
  }

  // ISO date form. Date.parse handles both bare yyyy-mm-dd and full
  // ISO strings. Bare dates get interpreted as UTC midnight, which
  // can off-by-one for the operator's local timezone — adjust to
  // local start-of-day when the input is yyyy-mm-dd.
  const bareDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (bareDate) {
    const [, y, mo, d] = bareDate;
    const local = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10));
    if (Number.isNaN(local.getTime())) return null;
    return local.getTime();
  }

  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso)) return iso;
  return null;
}

/* ── End-to-end matcher ──────────────────────────────────────────── */

/**
 * Apply the parsed query to a list of `ExceptionSummary`. Returns the
 * surviving rows in the original order — recency sort happens later
 * in `page.tsx`.
 *
 * Free-term matching uses `Fuse.js` with weighted keys so that
 * order-id and account-name hits rank higher than intent / event-type
 * hits. The threshold is forgiving (0.4) so 1-edit typos still match;
 * `useExtendedSearch` is off so the user can't accidentally trigger
 * Fuse's special syntax with a stray `'` or `^`.
 */
export function matchExceptions(
  exceptions: ExceptionSummary[],
  parsed: SearchTokens,
  now: Date = new Date(),
): { matched: ExceptionSummary[]; warnings: string[] } {
  const warnings = [...parsed.warnings];

  // Apply operator predicates first — cheap exact-ish filters.
  let pool = exceptions;
  for (const op of parsed.operators) {
    const compiled = operatorToPredicate(op, now);
    if (compiled === null) continue;
    if (compiled.warning) warnings.push(compiled.warning);
    pool = pool.filter(compiled.predicate);
  }

  if (!parsed.freeText) return { matched: pool, warnings };

  const fuse = new Fuse(pool, {
    keys: [
      { name: "order_id", weight: 0.4 },
      { name: "account_name", weight: 0.25 },
      { name: "intent", weight: 0.15 },
      { name: "event_type", weight: 0.1 },
      { name: "id", weight: 0.1 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: false,
    useExtendedSearch: false,
    minMatchCharLength: 2,
  });

  const results = fuse.search(parsed.freeText);
  return { matched: results.map((r) => r.item), warnings };
}
