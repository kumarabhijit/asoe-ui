import figma from "@figma/code-connect";
import { Button } from "./Button";

figma.connect(Button, "https://figma.com/design/REPLACE_WITH_FILE_KEY/asoe-ui?node-id=REPLACE_WITH_NODE_ID", {
  props: {
    variant: figma.enum("Variant", {
      Brand: "brand",
      Neutral: "neutral",
      Success: "success",
      Ghost: "ghost",
      Destructive: "destructive",
    }),
    size: figma.enum("Size", {
      Small: "sm",
      Medium: "md",
      Large: "lg",
    }),
    loading: figma.boolean("Loading"),
    fullWidth: figma.boolean("Full Width"),
    disabled: figma.boolean("Disabled"),
    children: figma.string("Label"),
  },
  example: (props) => (
    <Button
      variant={props.variant}
      size={props.size}
      loading={props.loading}
      fullWidth={props.fullWidth}
      disabled={props.disabled}
    >
      {props.children}
    </Button>
  ),
});
