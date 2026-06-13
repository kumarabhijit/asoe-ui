// Read-only handoff helper. Extracts the decision-relevant facts of every
// mock scenario (intent, event, lifecycle, shadow verdict, $ at risk,
// diagnosis) from the asoe-ui mock layer, so the asoe2 session can author
// the canonical scenario catalog without re-transcribing. Emits YAML to
// stdout. Reads only — never mutates MOCK_* (no architectural-lock impact).
//
//   npx tsx scripts/scenario-catalog-report.ts > /tmp/catalog-facts.yaml

import { MOCK_EXCEPTIONS } from "../src/lib/mock-data/exceptions";
import { MOCK_ORDER_ANALYSES } from "../src/lib/mock-data/order-analyses";

function esc(s: string | undefined): string {
  if (!s) return '""';
  return JSON.stringify(s);
}

const lines: string[] = [];
for (const exc of MOCK_EXCEPTIONS) {
  const a = MOCK_ORDER_ANALYSES[exc.id];
  const rar = a?.impact_metrics?.revenue_at_risk;
  const diag = a?.diagnosis?.replace(/\s+/g, " ").slice(0, 160);
  lines.push(`- id: ${exc.id}`);
  lines.push(`  intent: ${exc.intent ?? "UNCLASSIFIED"}`);
  lines.push(`  event_type: ${exc.event_type}`);
  lines.push(`  lifecycle: ${exc.lifecycle_state ?? "UNKNOWN"}`);
  lines.push(`  shadow_verdict: ${exc.shadow_verdict ?? "—"}`);
  lines.push(`  account: ${esc(exc.account_name)}`);
  lines.push(`  order_id: ${esc(exc.order_id)}`);
  lines.push(`  revenue_at_risk: ${rar ?? "null"}`);
  lines.push(`  diagnosis: ${esc(diag)}`);
}
process.stdout.write(lines.join("\n") + "\n");
process.stderr.write(`\n[${MOCK_EXCEPTIONS.length} scenarios]\n`);
