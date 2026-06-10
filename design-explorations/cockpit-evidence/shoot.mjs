import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const url = "file://" + join(here, "mockup.html");

const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 880, height: 1100 }, deviceScaleFactor: 2 });
  await page.goto(url);
  if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
  // settle fonts/layout
  await page.waitForTimeout(250);
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width: 880, height: h + 40 });
  await page.screenshot({ path: join(here, `cockpit-evidence-${theme}.png`) });
  await page.close();
}
await browser.close();
console.log("done");
