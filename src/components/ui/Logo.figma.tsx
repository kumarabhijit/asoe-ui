import figma from "@figma/code-connect";
import { Logo } from "./Logo";

figma.connect(Logo, "https://figma.com/design/REPLACE_WITH_FILE_KEY/asoe-ui?node-id=REPLACE_WITH_NODE_ID", {
  props: {
    size: figma.enum("Size", {
      Small: "sm",
      Medium: "md",
      Large: "lg",
    }),
    showTagline: figma.boolean("Show Tagline"),
  },
  example: (props) => (
    <Logo size={props.size} showTagline={props.showTagline} />
  ),
});
