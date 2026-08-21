// Regressions behind "how did instant become $3?"
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import WhyMigrate from "./WhyMigrate.jsx";
import {
  DEFAULT_SEG_COSTS, BUSINESS_BANDS, applyBusinessBand, railTotal, effTotal, RAILS,
} from "./data.js";

const clone = (o) => JSON.parse(JSON.stringify(o));
const banded = applyBusinessBand(clone(DEFAULT_SEG_COSTS), "High-touch B2B");

describe("the $3.00 instant figure", () => {
  it("comes from the High-touch B2B band, not from a calculation error", () => {
    const t = BUSINESS_BANDS["High-touch B2B"].targets;
    expect(railTotal(banded.Business.Instant)).toBeCloseTo(t.Instant, 2);
    expect(railTotal(banded.Business.Wire)).toBeCloseTo(t.Wire, 2);
    expect(railTotal(banded.Business["Same-Day ACH"])).toBeCloseTo(t["Same-Day ACH"], 2);
    expect(railTotal(banded.Business.ACH)).toBeCloseTo(t.ACH, 2);
  });

  it("only rescales Business — Retail and Internal are untouched", () => {
    for (const rail of RAILS) {
      expect(railTotal(banded.Retail[rail])).toBeCloseTo(railTotal(DEFAULT_SEG_COSTS.Retail[rail]), 4);
      expect(railTotal(banded.Internal[rail])).toBeCloseTo(railTotal(DEFAULT_SEG_COSTS.Internal[rail]), 4);
    }
  });
});

describe("WhyMigrate discloses its basis", () => {
  it("names the segment and the instant cost it is comparing against", () => {
    const html = renderToString(<WhyMigrate costs={banded.Business} ov={undefined} segment="Business" />);
    expect(html).toContain("Business segment");
    expect(html).toContain("$3.00");
  });

  it("warns when instant is dearer than two or more legacy rails", () => {
    const html = renderToString(<WhyMigrate costs={banded.Business} ov={undefined} segment="Business" />);
    expect(html).toContain("Check your instant cost assumption");
  });

  it("stays quiet on a coherent cost set", () => {
    const html = renderToString(<WhyMigrate costs={DEFAULT_SEG_COSTS.Retail} ov={undefined} segment="Retail" />);
    expect(html).not.toContain("Check your instant cost assumption");
    expect(html).toContain("Retail segment");
  });

  it("honours a typed all-in override, matching the rest of the model", () => {
    const ov = { Check: "", Wire: "", "Same-Day ACH": "", ACH: "", Instant: "0.90" };
    // effTotal is the single source of truth for cost resolution
    expect(effTotal(banded.Business, ov, "Instant")).toBeCloseTo(0.9, 2);
    const html = renderToString(<WhyMigrate costs={banded.Business} ov={ov} segment="Business" />);
    expect(html).toContain("$0.90");
    expect(html).toContain("Manual override in effect");
    // with instant back at $0.90 the spurious "keep everything" warning clears
    expect(html).not.toContain("Check your instant cost assumption");
  });
});
