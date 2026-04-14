import figma from "@figma/code-connect";
import { NavBar } from "./NavBar";

figma.connect(NavBar, "https://figma.com/design/REPLACE_WITH_FILE_KEY/asoe-ui?node-id=REPLACE_WITH_NODE_ID", {
  props: {
    userName: figma.string("User Name"),
    agentCount: figma.enum("Agent Status", {
      "No Agents": 0,
      "1 Agent": 1,
      "Multiple Agents": 3,
    }),
  },
  example: (props) => (
    <NavBar
      tabs={[
        { id: "inbox", label: "Customer Inbox", href: "/inbox" },
        { id: "exceptions", label: "Exception Queue", href: "/exceptions" },
        { id: "dashboard", label: "Dashboard", href: "/dashboard" },
      ]}
      activeTab="exceptions"
      userName={props.userName}
      userInitials="AK"
      agentCount={props.agentCount}
    />
  ),
});
