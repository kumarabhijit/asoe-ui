import { chromium } from "playwright";
const url = "file:///home/user/asoe-ui/design-explorations/decision-path/preview.html";
const out = "/home/user/asoe-ui/design-explorations/decision-path";
const b = await chromium.launch();
for (const theme of ["light","dark"]) {
  const p = await b.newPage({ viewport: { width: 1040, height: 360 }, deviceScaleFactor: 2 });
  await p.goto(url);
  if (theme === "dark") await p.evaluate(() => document.documentElement.classList.add("dark"));
  await p.waitForTimeout(200);
  const h = await p.evaluate(() => document.body.scrollHeight);
  await p.setViewportSize({ width: 1040, height: h + 20 });
  await p.screenshot({ path: `${out}/decision-path-${theme}.png` });
  await p.close();
}
await b.close(); console.log("done");
