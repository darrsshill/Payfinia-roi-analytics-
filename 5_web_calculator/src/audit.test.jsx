import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import App from "./App.jsx";
import Wizard from "./Wizard.jsx";

const css = fs.readFileSync(path.join(import.meta.dirname, "styles.css"), "utf8");
const defined = new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]));

function classesIn(html) {
  const out = new Set();
  for (const m of html.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => c && out.add(c));
  return out;
}

const views = [
  ["wizard", () => renderToString(<Wizard onComplete={() => {}} onSkip={() => {}} />)],
  ...["calc", "assum", "td", "why", "compare", "data"].map((tab) => [
    "advanced:" + tab,
    () => { window.localStorage.setItem("payfinia_calc_v2", JSON.stringify({ simple: false, stage: "result", tab })); return renderToString(<App />); },
  ]),
  ["client", () => { window.localStorage.setItem("payfinia_calc_v2", JSON.stringify({ simple: true, stage: "result" })); return renderToString(<App />); }],
  ["client-panel-closed", () => { window.localStorage.setItem("payfinia_calc_v2", JSON.stringify({ simple: true, stage: "result", panelOpen: false })); return renderToString(<App />); }],
];

describe("style coverage audit", () => {
  for (const [name, render] of views) {
    it(`${name}: every class used has a rule`, () => {
      const missing = [...classesIn(render())].filter((c) => !defined.has(c) && !c.startsWith("recharts"));
      expect(missing, `unstyled classes in ${name}`).toEqual([]);
    });
  }

  it("client view renders all four rail inputs", () => {
    window.localStorage.setItem("payfinia_calc_v2", JSON.stringify({ simple: true, stage: "result" }));
    const html = renderToString(<App />);
    for (const l of ["Checks", "Wires", "Same-Day ACH", "Standard ACH"]) expect(html).toContain(l);
  });

  // Guard against internal review notes, course attribution or developer
  // placeholders reaching a customer-facing screen.
  it("no internal attribution leaks into rendered output", () => {
    const LEAKS = ["USF", "TODO", "FIXME", "internal review", "@gmail.com", "reviewer"];
    for (const [, render] of views) {
      const html = render();
      for (const token of LEAKS) expect(html).not.toContain(token);
    }
  });

  it("every table has a header row and lives in a scroll wrapper", () => {
    window.localStorage.setItem("payfinia_calc_v2", JSON.stringify({ simple: false, stage: "result", tab: "calc" }));
    const html = renderToString(<App />);
    const tables = html.match(/<table[^>]*>/g) || [];
    expect(tables.length).toBeGreaterThan(0);
    expect((html.match(/<thead>/g) || []).length).toBeGreaterThanOrEqual(tables.length);
  });
});
