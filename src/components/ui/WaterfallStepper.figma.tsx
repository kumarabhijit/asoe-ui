import figma from "@figma/code-connect";
import { WaterfallStepper } from "./WaterfallStepper";
import type { NodeState } from "./WaterfallStepper";

const EXAMPLE_NODES: NodeState[] = [
  { node: "ingest", status: "completed", duration_ms: 120 },
  { node: "classify", status: "completed", duration_ms: 450, data: { intent: "CONTRACTUAL_CORRECTION", confidence: 0.92 } },
  { node: "load_skill", status: "completed", duration_ms: 80 },
  { node: "validate_circuit_breaker", status: "completed", duration_ms: 30 },
  { node: "shadow_audit", status: "started" },
  { node: "select_recipe", status: "pending" },
  { node: "validate_types", status: "pending" },
  { node: "resolve_dependencies", status: "pending" },
  { node: "execute_recipe", status: "pending" },
  { node: "apply_effects", status: "pending" },
];

figma.connect(WaterfallStepper, "https://figma.com/design/REPLACE_WITH_FILE_KEY/asoe-ui?node-id=REPLACE_WITH_NODE_ID", {
  example: () => (
    <WaterfallStepper nodes={EXAMPLE_NODES} intent="CONTRACTUAL_CORRECTION" />
  ),
});
