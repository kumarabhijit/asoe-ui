import figma from "@figma/code-connect";
import { PricingWaterfall } from "./PricingWaterfall";
import type { PricingWaterfallStep } from "@/types/exceptions";

const EXAMPLE_STEPS: PricingWaterfallStep[] = [
  { type: "BASE", label: "Base Price", record: "PR00", value: 100.0, running: 100.0, detail: "Standard list price from material master" },
  { type: "CONTRACT", label: "Contract Price", record: "ZCTR", value: -15.0, running: 85.0, detail: "Customer contract agreement K-2024-0891" },
  { type: "TPR", label: "TPR Discount", record: "ZTPR", value: -5.0, running: 80.0, detail: "Temporary price reduction — promo PR-2024-Q4" },
  { type: "RESULT", label: "Net Price", record: "NETPR", value: 80.0, running: 80.0, detail: "Final calculated net price" },
];

figma.connect(PricingWaterfall, "https://figma.com/design/REPLACE_WITH_FILE_KEY/asoe-ui?node-id=REPLACE_WITH_NODE_ID", {
  example: () => (
    <PricingWaterfall steps={EXAMPLE_STEPS} />
  ),
});
