import figma from "@figma/code-connect";
import { Sidebar } from "./Sidebar";

figma.connect(Sidebar, "https://figma.com/design/REPLACE_WITH_FILE_KEY/asoe-ui?node-id=REPLACE_WITH_NODE_ID", {
  props: {
    title: figma.string("Title"),
    children: figma.children("Content"),
  },
  example: (props) => (
    <Sidebar
      open={true}
      onClose={() => {}}
      title={props.title}
    >
      {props.children}
    </Sidebar>
  ),
});
