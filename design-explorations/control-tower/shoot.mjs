import { chromium } from "playwright";
const url = "file:///home/user/asoe-ui/design-explorations/control-tower/control-tower.html";
const out = "/home/user/asoe-ui/design-explorations/control-tower";
const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 1260, height: 800 }, deviceScaleFactor: 2 });
  await page.goto(url);
  if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(250);
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width: 1260, height: h + 20 });
  await page.screenshot({ path: `${out}/control-tower-${theme}.png` });
  await page.close();
}
await browser.close();
console.log("done");
