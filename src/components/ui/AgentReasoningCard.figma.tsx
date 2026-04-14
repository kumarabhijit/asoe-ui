import figma from "@figma/code-connect";
import { AgentReasoningCard } from "./AgentReasoningCard";

figma.connect(AgentReasoningCard, "https://figma.com/design/REPLACE_WITH_FILE_KEY/asoe-ui?node-id=REPLACE_WITH_NODE_ID", {
  props: {
    verdict: figma.enum("Verdict", {
      Green: "GREEN",
      Yellow: "YELLOW",
      Red: "RED",
    }),
    confidence: figma.enum("Confidence", {
      High: 0.92,
      Medium: 0.65,
      Low: 0.35,
    }),
    intent: figma.string("Intent"),
    explanation: figma.string("Explanation"),
  },
  example: (props) => (
    <AgentReasoningCard
      verdict={props.verdict}
      confidence={props.confidence}
      intent={props.intent}
      explanation={props.explanation}
      onApprove={(comment) => {}}
      onReject={(comment) => {}}
      onEscalate={() => {}}
    />
  ),
});
