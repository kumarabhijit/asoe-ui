import figma from "@figma/code-connect";
import { useToast } from "./Toast";

/**
 * Toast is used via the useToast() hook, not as a direct component.
 * This Code Connect file documents the Toast pattern for Figma.
 *
 * Usage:
 *   const { addToast } = useToast();
 *   addToast("success", "Exception resolved successfully");
 */
figma.connect("Toast", "https://figma.com/design/REPLACE_WITH_FILE_KEY/asoe-ui?node-id=REPLACE_WITH_NODE_ID", {
  props: {
    variant: figma.enum("Variant", {
      Success: "success",
      Warning: "warning",
      Error: "error",
      Info: "info",
    }),
    message: figma.string("Message"),
  },
  example: (props) => {
    const { addToast } = useToast();
    addToast(props.variant, props.message);
    return null;
  },
});
