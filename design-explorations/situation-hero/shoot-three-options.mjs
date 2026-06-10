import { chromium } from "playwright";
const url = "file:///home/user/asoe-ui/design-explorations/situation-hero/three-options.html";
const out = "/home/user/asoe-ui/design-explorations/situation-hero";
const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 860, height: 600 }, deviceScaleFactor: 2 });
  await page.goto(url);
  if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(250);
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width: 860, height: h + 20 });
  await page.screenshot({ path: `${out}/three-options-${theme}.png` });
  await page.close();
}
await browser.close();
console.log("done");
