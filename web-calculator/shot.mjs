import { chromium } from "playwright";
const b = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"],
});
const p = await b.newPage({ viewport: { width: 1512, height: 1000 } });
p.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
const url = "http://localhost:8934/index.html";
async function shot(name, state) {
  await p.goto(url, { waitUntil: "domcontentloaded" });
  if (state) {
    await p.evaluate((s) => localStorage.setItem("payfinia_calc_v2", s), JSON.stringify(state));
    await p.goto(url, { waitUntil: "domcontentloaded" });
  } else {
    await p.evaluate(() => localStorage.clear());
    await p.goto(url, { waitUntil: "domcontentloaded" });
  }
  await p.waitForTimeout(1400);
  await p.screenshot({ path: `/tmp/shots/${name}.png`, fullPage: true });
  console.log("shot", name);
}
await shot("01-wizard", null);
await shot("02-client", { simple: true, stage: "result" });
await shot("03-advanced", { simple: false, stage: "result", tab: "calc" });
await shot("04-assum", { simple: false, stage: "result", tab: "assum" });
await b.close();
