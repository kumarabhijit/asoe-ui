import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const shots = [
  { file: "cockpit.html",   out: "01-cockpit.png",   w: 1480, h: 940, full: false },
  { file: "dashboard.html", out: "02-dashboard.png", w: 1480, h: 940, full: true  },
  { file: "evidence.html",  out: "03-evidence.png",  w: 1480, h: 940, full: true  },
];

const browser = await chromium.launch();
for (const s of shots) {
  const page = await browser.newPage({
    viewport: { width: s.w, height: s.h },
    deviceScaleFactor: 2,
  });
  await page.goto("file://" + join(here, s.file), { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(here, s.out), fullPage: s.full });
  console.log("shot", s.out);
  await page.close();
}
await browser.close();
console.log("done");
