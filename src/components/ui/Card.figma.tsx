import figma from "@figma/code-connect";
import { Card } from "./Card";

figma.connect(Card, "https://figma.com/design/REPLACE_WITH_FILE_KEY/asoe-ui?node-id=REPLACE_WITH_NODE_ID", {
  props: {
    elevated: figma.boolean("Elevated"),
    children: figma.children("Content"),
  },
  example: (props) => (
    <Card elevated={props.elevated}>
      {props.children}
    </Card>
  ),
});
