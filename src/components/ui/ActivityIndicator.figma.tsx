import figma from "@figma/code-connect";
import { ActivityIndicator } from "./ActivityIndicator";

figma.connect(ActivityIndicator, "https://figma.com/design/REPLACE_WITH_FILE_KEY/asoe-ui?node-id=REPLACE_WITH_NODE_ID", {
  props: {
    node: figma.enum("Pipeline Node", {
      Ingest: "ingest",
      Classify: "classify",
      "Load Skill": "load_skill",
      "Circuit Breaker": "validate_circuit_breaker",
      "Shadow Audit": "shadow_audit",
      "Select Recipe": "select_recipe",
      "Validate Types": "validate_types",
      "Resolve Dependencies": "resolve_dependencies",
      "Execute Recipe": "execute_recipe",
      "Apply Effects": "apply_effects",
    }),
  },
  example: (props) => (
    <ActivityIndicator node={props.node} intent="CONTRACTUAL_CORRECTION" />
  ),
});
