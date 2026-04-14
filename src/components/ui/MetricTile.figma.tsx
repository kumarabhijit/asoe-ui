import figma from "@figma/code-connect";
import { MetricTile } from "./MetricTile";

figma.connect(MetricTile, "https://figma.com/design/REPLACE_WITH_FILE_KEY/asoe-ui?node-id=REPLACE_WITH_NODE_ID", {
  props: {
    label: figma.string("Label"),
    value: figma.string("Value"),
    subtitle: figma.string("Subtitle"),
  },
  example: (props) => (
    <MetricTile
      icon={<span />}
      label={props.label}
      value={props.value}
      subtitle={props.subtitle}
    />
  ),
});
