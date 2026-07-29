// Smoke test: does the app actually render without throwing?
// A successful vite build does not catch undefined props or bad state shapes.
import { describe, it, expect, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import App from "./App.jsx";
import Wizard from "./Wizard.jsx";
import ControlPanel from "./ControlPanel.jsx";
import SegmentBreakdown from "./SegmentBreakdown.jsx";
import {
  DEFAULT_SEG_COSTS, SEG_MIX_DEFAULT, SUBST_DEFAULT, SEGMENTS, PRESETS,
  splitVolume, runSegmented,
} from "./data.js";

const p = PRESETS["Mid CFI (~$1B)"];
const vol = { Check: p.Check, Wire: p.Wire, "Same-Day ACH": p["Same-Day ACH"], ACH: p.ACH };
const volBySeg = splitVolume(vol, SEG_MIX_DEFAULT);
const subst = {}; SEGMENTS.forEach((s) => { subst[s] = SUBST_DEFAULT[s]; });
const result = runSegmented(volBySeg, DEFAULT_SEG_COSTS, subst, p.oneTime, p.annual, 10, 5);

beforeEach(() => { window.localStorage.clear(); });

describe("render smoke", () => {
  it("App renders from a clean slate (wizard first)", () => {
    const html = renderToString(<App />);
    expect(html).toContain("PAYFINIA");
  });

  it("App renders the advanced view without throwing", () => {
    window.localStorage.setItem("payfinia_calc_v2", JSON.stringify({ simple: false, stage: "result", tab: "calc" }));
    const html = renderToString(<App />);
    expect(html).toContain("Instant Payments ROI Calculator");
  });

  it("renders every advanced tab", () => {
    for (const tab of ["calc", "assum", "td", "why", "compare", "data"]) {
      window.localStorage.setItem("payfinia_calc_v2", JSON.stringify({ simple: false, stage: "result", tab }));
      expect(() => renderToString(<App />)).not.toThrow();
    }
  });

  it("renders the Cost Assumptions tab for each segment", () => {
    for (const seg of SEGMENTS) {
      window.localStorage.setItem("payfinia_calc_v2",
        JSON.stringify({ simple: false, stage: "result", tab: "assum", activeSegment: seg }));
      expect(() => renderToString(<App />)).not.toThrow();
    }
  });

  it("survives a stale v1 payload in localStorage", () => {
    // the old flat schema must not be half-loaded into the new state shape
    window.localStorage.setItem("payfinia_calc_v1", JSON.stringify({
      simple: false, costs: { Check: { network: 0.03 } }, subst: { Check: 25, Wire: 30 },
    }));
    expect(() => renderToString(<App />)).not.toThrow();
  });

  it("Wizard renders", () => {
    expect(renderToString(<Wizard onComplete={() => {}} onSkip={() => {}} />)).toContain("Welcome");
  });

  it("ControlPanel renders open and collapsed", () => {
    const props = {
      open: true, onToggle: () => {}, bankName: "", setBankName: () => {}, userName: "", setUserName: () => {},
      presetName: "Mid CFI (~$1B)", applyPreset: () => {}, unit: "Annual", setUnit: () => {},
      vol, setVolRail: () => {}, customers: p.customers, setCustomers: () => {},
      mix: SEG_MIX_DEFAULT, setMixCell: () => {}, resetMix: () => {},
      appetite: "Moderate", applyAppetite: () => {}, subst, setSubstCell: () => {},
      oneTime: p.oneTime, setOneTime: () => {}, annual: p.annual, setAnnual: () => {},
      disc: 10, setDisc: () => {}, horizon: 5, setHorizon: () => {},
      onRestartWizard: () => {}, onReset: () => {}, activeSegment: "Business", setActiveSegment: () => {},
    };
    expect(renderToString(<ControlPanel {...props} />)).toContain("Control panel");
    expect(renderToString(<ControlPanel {...props} open={false} />)).toContain("Adjust inputs");
  });

  it("SegmentBreakdown names all three segments", () => {
    const html = renderToString(<SegmentBreakdown result={result} segCosts={DEFAULT_SEG_COSTS} volBySeg={volBySeg} />);
    for (const label of ["Retail", "Business", "Internal (FI)"]) expect(html).toContain(label);
  });

  it("SegmentBreakdown handles an empty/zero-volume result", () => {
    const empty = runSegmented(
      { Retail: {}, Business: {}, Internal: {} }, DEFAULT_SEG_COSTS, subst, 0, 0, 10, 5);
    expect(() => renderToString(
      <SegmentBreakdown result={empty} segCosts={DEFAULT_SEG_COSTS} volBySeg={{}} />)).not.toThrow();
  });
});
