import figma from "@figma/code-connect";
import { Badge } from "./Badge";

figma.connect(Badge, "https://figma.com/design/REPLACE_WITH_FILE_KEY/asoe-ui?node-id=REPLACE_WITH_NODE_ID", {
  props: {
    variant: figma.enum("Variant", {
      Success: "success",
      Warning: "warning",
      Error: "error",
      Info: "info",
      Neutral: "neutral",
      Brand: "brand",
    }),
    size: figma.enum("Size", {
      Small: "sm",
      Medium: "md",
    }),
    children: figma.string("Label"),
  },
  example: (props) => (
    <Badge variant={props.variant} size={props.size}>
      {props.children}
    </Badge>
  ),
});
