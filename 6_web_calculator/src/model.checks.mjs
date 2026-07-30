// =====================================================================
// Reconciliation checks for the v4 segment refactor.
//   node src/model.test.mjs
//
// Guards the two things a refactor like this can quietly break:
//   1. the published anchors the Business column is built from
//   2. equivalence with the pre-refactor flat model on a control scenario
// =====================================================================
import {
  SEGMENTS, LEGACY, RAILS, DEFAULT_SEG_COSTS, SEG_MIX_DEFAULT, SUBST_DEFAULT,
  PRESETS, APPETITE, railTotal, layerTotals, splitVolume, runSegmented, runBottomUp,
  impliedTotalCostSeg, applyBusinessBand, laborPerItem, mixFromCustomers,
  NETWORK_FEE, PROVIDER_FEE, LOADED_SALARY_MULT,
} from "./data.js";

let pass = 0, fail = 0;
const near = (a, b, tol = 0.005) => Math.abs(a - b) <= tol;
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? "  — " + detail : ""}`); }
}

console.log("\n1 · Published anchors the Business column is built from");
// AFP 2022 Payments Cost Benchmarking Survey (n=347), initiating side.
const AFP = { "Check": 2.98, "Wire": 12.00, "ACH": 0.40, "Instant": 1.25 };
for (const [rail, want] of Object.entries(AFP)) {
  const got = railTotal(DEFAULT_SEG_COSTS.Business[rail]);
  check(`Business ${rail} all-in = $${want}`, near(got, want), `got $${got.toFixed(4)}`);
}
check("Retail Instant all-in = $0.82 (Deliverable 1 headline)",
  near(railTotal(DEFAULT_SEG_COSTS.Retail.Instant), 0.82),
  `got $${railTotal(DEFAULT_SEG_COSTS.Retail.Instant).toFixed(4)}`);

console.log("\n2 · Network and provider fees are shared across segments");
for (const rail of RAILS) {
  const nets = SEGMENTS.map((s) => DEFAULT_SEG_COSTS[s][rail].network);
  const provs = SEGMENTS.map((s) => DEFAULT_SEG_COSTS[s][rail].provider);
  check(`${rail} network identical across segments (= $${NETWORK_FEE[rail]})`,
    nets.every((n) => near(n, NETWORK_FEE[rail], 1e-9)));
  check(`${rail} provider identical across segments (= $${PROVIDER_FEE[rail]})`,
    provs.every((p) => near(p, PROVIDER_FEE[rail], 1e-9)));
}

console.log("\n3 · Layers sum to the all-in total");
for (const seg of SEGMENTS) for (const rail of RAILS) {
  const lt = layerTotals(DEFAULT_SEG_COSTS[seg][rail]);
  check(`${seg}/${rail} layers sum to total`,
    near(lt.network + lt.provider + lt.internal, railTotal(DEFAULT_SEG_COSTS[seg][rail]), 1e-9));
}

console.log("\n4 · Volume split conserves total volume");
const p = PRESETS["Mid CFI (~$1B)"];
const vol = { Check: p.Check, Wire: p.Wire, "Same-Day ACH": p["Same-Day ACH"], ACH: p.ACH };
const volBySeg = splitVolume(vol, SEG_MIX_DEFAULT);
for (const rail of LEGACY) {
  const summed = SEGMENTS.reduce((s, seg) => s + volBySeg[seg][rail], 0);
  check(`${rail} volume conserved after split`, near(summed, vol[rail], 0.5),
    `${summed} vs ${vol[rail]}`);
}
for (const rail of LEGACY) {
  const tot = SEGMENTS.reduce((s, seg) => s + SEG_MIX_DEFAULT[rail][seg], 0);
  check(`${rail} default mix totals 100%`, near(tot, 100, 0.01), `got ${tot}`);
}

console.log("\n5 · Equivalence with the pre-refactor flat model");
// Put 100% of volume in one segment with one cost table and one appetite:
// the modular engine must reproduce the old flat answer exactly.
const flatCosts = DEFAULT_SEG_COSTS.Retail;
const flatSubst = { Check: 25, Wire: 30, "Same-Day ACH": 20, ACH: 5 };
const flatOv = { Check: "", Wire: "", "Same-Day ACH": "", ACH: "", Instant: "" };
const oldWay = runBottomUp(vol, flatCosts, flatSubst, p.oneTime, p.annual, 10, 5, flatOv);
const allRetail = { Retail: vol, Business: {}, Internal: {} };
const newWay = runSegmented(
  allRetail,
  { Retail: flatCosts, Business: flatCosts, Internal: flatCosts },
  { Retail: flatSubst, Business: flatSubst, Internal: flatSubst },
  p.oneTime, p.annual, 10, 5,
  { Retail: flatOv, Business: flatOv, Internal: flatOv });
for (const k of ["gross", "net", "npv"]) {
  check(`flat vs modular: ${k}`, near(oldWay[k], newWay[k], 0.01),
    `${oldWay[k].toFixed(2)} vs ${newWay[k].toFixed(2)}`);
}
check("flat vs modular: roi", near(oldWay.roi, newWay.roi, 1e-6));
check("flat vs modular: blended instant cost", near(oldWay.instant, newWay.instant, 1e-6));

console.log("\n6 · Aggregation identity — segment grosses sum to total gross");
const subst = {}; SEGMENTS.forEach((s) => { subst[s] = SUBST_DEFAULT[s]; });
const res = runSegmented(volBySeg, DEFAULT_SEG_COSTS, subst, p.oneTime, p.annual, 10, 5);
const sumSeg = SEGMENTS.reduce((s, seg) => s + res.segments[seg].gross, 0);
check("sum of segment gross = total gross", near(sumSeg, res.gross, 0.01),
  `${sumSeg.toFixed(2)} vs ${res.gross.toFixed(2)}`);
const sumRail = res.rows.reduce((s, r) => s + r.ann, 0);
check("sum of rail roll-up = total gross", near(sumRail, res.gross, 0.01),
  `${sumRail.toFixed(2)} vs ${res.gross.toFixed(2)}`);
check("net = gross − annual platform cost", near(res.net, res.gross - p.annual, 0.01));

console.log("\n7 · ACH still net-negative (the Deliverable 1 finding must survive)");
for (const seg of SEGMENTS) {
  const row = res.segments[seg].rows.find((r) => r.rail === "ACH");
  check(`${seg}: standard ACH → instant does not create value`, row.per <= 0,
    `per-txn saving $${row.per.toFixed(4)}`);
}

console.log("\n8 · The high-touch B2B band hits its stated targets");
const banded = applyBusinessBand(JSON.parse(JSON.stringify(DEFAULT_SEG_COSTS)), "High-touch B2B");
for (const [rail, want] of Object.entries({ "Check": 6.00, "Instant": 3.00, "Wire": 18.00 })) {
  const got = railTotal(banded.Business[rail]);
  check(`banded Business ${rail} = $${want}`, near(got, want), `got $${got.toFixed(3)}`);
}
check("band leaves Retail untouched",
  near(railTotal(banded.Retail.Check), railTotal(DEFAULT_SEG_COSTS.Retail.Check), 1e-9));

console.log("\n9 · FTE mini-calc honours the time-allocation factor");
const full = laborPerItem({ fte: 2, salary: 55000, pctTime: 100, items: 100000, loaded: false });
const quarter = laborPerItem({ fte: 2, salary: 55000, pctTime: 25, items: 100000, loaded: false });
check("100% time = 2 × 55000 / 100000 = $1.10", near(full, 1.10, 1e-9), `got ${full}`);
check("25% time is exactly a quarter of 100%", near(quarter, full * 0.25, 1e-9));
check("loaded salary applies the overhead multiplier",
  near(laborPerItem({ fte: 2, salary: 55000, pctTime: 100, items: 100000, loaded: true }),
       full * LOADED_SALARY_MULT, 1e-9));
check("zero items does not divide by zero",
  laborPerItem({ fte: 2, salary: 55000, pctTime: 50, items: 0 }) === 0);

console.log("\n10 · Customer-count intake produces a valid mix");
const mix = mixFromCustomers({ retail: 55000, smb: 3200, midmarket: 220 });
for (const rail of LEGACY) {
  const tot = SEGMENTS.reduce((s, seg) => s + mix[rail][seg], 0);
  check(`${rail} derived mix totals 100%`, near(tot, 100, 0.35), `got ${tot.toFixed(2)}`);
  check(`${rail} derived mix has no negatives`, SEGMENTS.every((seg) => mix[rail][seg] >= 0));
}
const heavyRetail = mixFromCustomers({ retail: 500000, smb: 1, midmarket: 0 });
const heavyBiz = mixFromCustomers({ retail: 100, smb: 5000, midmarket: 900 });
check("a retail-heavy book skews the wire mix toward Retail",
  heavyRetail.Wire.Retail > heavyBiz.Wire.Retail);
check("a commercial-heavy book skews the wire mix toward Business",
  heavyBiz.Wire.Business > heavyRetail.Wire.Business);

console.log("\n11 · Appetite tables are internally consistent");
for (const [name, table] of Object.entries(APPETITE)) {
  for (const rail of ["Check", "Wire", "Same-Day ACH"]) {
    check(`${name}: business migrates slower than retail on ${rail}`,
      table.Business[rail] < table.Retail[rail],
      `${table.Business[rail]}% vs ${table.Retail[rail]}%`);
  }
}
check("Aggressive exceeds Conservative everywhere",
  SEGMENTS.every((s) => LEGACY.every((r) => APPETITE.Aggressive[s][r] > APPETITE.Conservative[s][r])));

console.log("\n12 · Sanity-check total is stable under the split");
const impliedSeg = impliedTotalCostSeg(volBySeg, DEFAULT_SEG_COSTS);
const impliedFlatEquivalent = LEGACY.reduce((s, rail) =>
  s + SEGMENTS.reduce((t, seg) => t + volBySeg[seg][rail] * railTotal(DEFAULT_SEG_COSTS[seg][rail]), 0), 0);
check("implied total cost matches a manual roll-up",
  near(impliedSeg, impliedFlatEquivalent, 0.01));
check("implied total cost is positive", impliedSeg > 0);

console.log(`\n${"─".repeat(58)}`);
console.log(`${pass} passed · ${fail} failed`);
if (fail > 0) process.exit(1);
