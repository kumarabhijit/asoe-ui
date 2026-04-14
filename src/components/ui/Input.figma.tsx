import figma from "@figma/code-connect";
import { Input } from "./Input";

figma.connect(Input, "https://figma.com/design/REPLACE_WITH_FILE_KEY/asoe-ui?node-id=REPLACE_WITH_NODE_ID", {
  props: {
    label: figma.string("Label"),
    placeholder: figma.string("Placeholder"),
    error: figma.string("Error"),
    disabled: figma.boolean("Disabled"),
  },
  example: (props) => (
    <Input
      label={props.label}
      placeholder={props.placeholder}
      error={props.error}
      disabled={props.disabled}
    />
  ),
});
