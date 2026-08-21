import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList, Tooltip, Legend } from "recharts";
import {
  RAILS, LEGACY, DEFAULTS, COMP_FIELDS, SUBST_DEFAULT, PRESETS, SRC, SUBST_SRC,
  GROUNDING_SRC, RAIL_FACTS, RAIL_COLOR, U, railTotal, layerTotals, runBottomUp, impliedTotalCost,
  SEGMENTS, SEG_META, SEG_SOURCING, SEG_MIX_DEFAULT, DEFAULT_SEG_COSTS, APPETITE,
  BUSINESS_BANDS, applyBusinessBand, METHOD_FLAGS, runSegmented, splitVolume,
  impliedTotalCostSeg, mixFromCustomers, laborPerItem, perItem, LOADED_SALARY_MULT,
} from "./data.js";
import ChatAssistant from "./ChatAssistant.jsx";
import Wizard from "./Wizard.jsx";
import ClientResult from "./ClientResult.jsx";
import Compare from "./Compare.jsx";
import WhyMigrate from "./WhyMigrate.jsx";
import ControlPanel from "./ControlPanel.jsx";
import SegmentBreakdown from "./SegmentBreakdown.jsx";
import { loadScenarios, makeScenario, addScenario, removeScenario } from "./scenarios.js";

const money = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x);
const money2 = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(x);
const num = (x) => new Intl.NumberFormat("en-US").format(Math.round(x));
const L1 = "#1F3864", L2 = "#F4A259", L3 = "#2EC4B6";  // layer colors

// comma-separated number input
function NumberInput({ value, onChange, step, className }) {
  const [txt, setTxt] = useState(num(value));
  useEffect(() => { setTxt(num(value)); }, [value]);
  return (
    <input className={className} inputMode="numeric" value={txt}
      onChange={(e) => { setTxt(e.target.value); const n = parseFloat(e.target.value.replace(/[^0-9.]/g, "")); onChange(isNaN(n) ? 0 : n); }}
      onBlur={() => setTxt(num(value))} />
  );
}
function StatusTag({ status }) {
  const cls = status === "Cited" ? "tag cited" : status === "Estimate" ? "tag est" : "tag partly";
  return <span className={cls}>{status}</span>;
}
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---- auto-save: persist inputs in the browser so a refresh never loses them ----
// v2 — schema changed when costs became segment-keyed. The old v1 payload is
// incompatible, so we read from a new key and let v1 fall away cleanly rather
// than half-loading it and crashing.
const LS_KEY = "payfinia_calc_v2";
function loadSaved() {
  try { if (typeof window === "undefined" || !window.localStorage) return null; return JSON.parse(window.localStorage.getItem(LS_KEY)) || null; }
  catch { return null; }
}
const defaultNet = () => { const o = {}; RAILS.forEach((r) => { o[r] = DEFAULTS[r].network; }); return o; };
const emptyOv = () => ({ Check: "", Wire: "", "Same-Day ACH": "", ACH: "", Instant: "" });
const emptyOvBySeg = () => { const o = {}; SEGMENTS.forEach((s) => { o[s] = emptyOv(); }); return o; };

export default function App() {
  const SAVED = loadSaved();
  const p0 = PRESETS["Mid CFI (~$1B)"];
  const [simple, setSimple] = useState(SAVED ? (SAVED.simple ?? true) : true);   // client view vs advanced analyst view
  const [stage, setStage] = useState(SAVED ? (SAVED.stage || "result") : "wizard");  // wizard -> result
  const [userName, setUserName] = useState(SAVED?.userName || "");
  const [bankName, setBankName] = useState(SAVED?.bankName || "");
  const [tab, setTab] = useState(SAVED?.tab || "calc");
  const [unit, setUnit] = useState(SAVED?.unit || "Annual");           // Annual | Monthly
  const [presetName, setPresetName] = useState(SAVED?.presetName || "Mid CFI (~$1B)");
  const [vol, setVol] = useState(SAVED?.vol || { Check: p0.Check, Wire: p0.Wire, "Same-Day ACH": p0["Same-Day ACH"], ACH: p0.ACH });  // ANNUAL, outbound
  const [oneTime, setOneTime] = useState(SAVED?.oneTime ?? p0.oneTime);
  const [annual, setAnnual] = useState(SAVED?.annual ?? p0.annual);
  const [disc, setDisc] = useState(SAVED?.disc ?? 10);
  const [horizon, setHorizon] = useState(SAVED?.horizon ?? 5);

  // ---- MODULAR SEGMENT STATE ----
  // Retail · Business · Internal are each costed independently, then aggregated.
  const [segCosts, setSegCosts] = useState(() => SAVED?.segCosts || clone(DEFAULT_SEG_COSTS));
  const [mix, setMix] = useState(() => SAVED?.mix || clone(SEG_MIX_DEFAULT));
  const [customers, setCustomers] = useState(() => SAVED?.customers || { ...p0.customers });
  const [subst, setSubst] = useState(() => SAVED?.subst || clone(SUBST_DEFAULT));   // now subst[segment][rail]
  const [appetite, setAppetite] = useState(SAVED?.appetite || "Moderate");
  // A saved session can hold a band name from an earlier build. Fall back to
  // the closest current key so the band note doesn't read "hand-edited" while a
  // band is plainly still in force.
  const [band, setBand] = useState(() => {
    const saved = SAVED?.band;
    if (!saved) return "AFP median (default)";
    if (BUSINESS_BANDS[saved] || saved === "Custom") return saved;
    const match = Object.keys(BUSINESS_BANDS).find((k) => saved.startsWith(k.split(" (")[0]));
    return match || "Custom";
  });
  const [activeSegment, setActiveSegment] = useState(SAVED?.activeSegment || "Business");
  const [overrides, setOverrides] = useState(() => SAVED?.overrides || emptyOvBySeg());
  const [panelOpen, setPanelOpen] = useState(SAVED?.panelOpen ?? true);
  const [flagsOpen, setFlagsOpen] = useState(false);
  const [uiScale, setUiScale] = useState(SAVED?.uiScale ?? 1);

  // App-wide text size. Scales the whole shell proportionally.
  useEffect(() => {
    try { document.documentElement.style.setProperty("--ui-scale", String(uiScale)); } catch { /* ignore */ }
  }, [uiScale]);

  // the flat single-table view the older components still expect
  const costs = segCosts[activeSegment];

  // top-down state (Justin's example)
  const [tdLabor, setTdLabor] = useState(SAVED?.tdLabor ?? 10000000);
  const [tdFraud, setTdFraud] = useState(SAVED?.tdFraud ?? 500000);
  const [tdCount, setTdCount] = useState(SAVED?.tdCount || { Check: 1000000, Wire: 100000, "Same-Day ACH": 0, ACH: 40000000, Instant: 0 });
  const [tdNet, setTdNet] = useState(SAVED?.tdNet || defaultNet());

  // auto-save everything to the browser on any change
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify({
        simple, stage, userName, bankName, tab, unit, presetName, vol, oneTime, annual, subst, disc, horizon,
        segCosts, mix, customers, appetite, band, activeSegment, overrides, panelOpen, uiScale,
        tdLabor, tdFraud, tdCount, tdNet,
      }));
    } catch { /* storage unavailable — ignore */ }
  }, [simple, stage, userName, bankName, tab, unit, presetName, vol, oneTime, annual, subst, disc, horizon,
      segCosts, mix, customers, appetite, band, activeSegment, overrides, panelOpen, uiScale, tdLabor, tdFraud, tdCount, tdNet]);

  function resetAll() {
    if (typeof window !== "undefined" && !window.confirm("Reset all inputs to the default example? This clears your saved progress in this browser.")) return;
    try { window.localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    const p = PRESETS["Mid CFI (~$1B)"];
    setPresetName("Mid CFI (~$1B)");
    setVol({ Check: p.Check, Wire: p.Wire, "Same-Day ACH": p["Same-Day ACH"], ACH: p.ACH });
    setOneTime(p.oneTime); setAnnual(p.annual);
    setSubst(clone(SUBST_DEFAULT)); setDisc(10); setHorizon(5);
    setSegCosts(clone(DEFAULT_SEG_COSTS)); setMix(clone(SEG_MIX_DEFAULT)); setCustomers({ ...p.customers });
    setAppetite("Moderate"); setBand("AFP median (default)"); setActiveSegment("Business");
    setOverrides(emptyOvBySeg()); setUnit("Annual");
    setUserName(""); setBankName("");
    setTdLabor(10000000); setTdFraud(500000);
    setTdCount({ Check: 1000000, Wire: 100000, "Same-Day ACH": 0, ACH: 40000000, Instant: 0 });
    setTdNet(defaultNet());
    setTab("calc"); setSimple(true); setStage("wizard"); setPanelOpen(true);
  }

  const mult = unit === "Monthly" ? 12 : 1;                        // display->annual

  function applyPreset(name) {
    setPresetName(name); const p = PRESETS[name];
    if (!p) return;
    setVol({ Check: p.Check, Wire: p.Wire, "Same-Day ACH": p["Same-Day ACH"], ACH: p.ACH });
    setOneTime(p.oneTime); setAnnual(p.annual);
    if (p.customers) setCustomers({ ...p.customers });
  }
  function applyFromAssistant({ vol: v, oneTime: ot, annual: an, subst: s }) {
    setVol(v); setOneTime(ot); setAnnual(an);
    if (s) applyAppetiteFromFlat(s);
    setPresetName("Custom (from assistant)"); setUnit("Annual"); setTab("calc");
  }
  // The assistant and older callers hand back a FLAT {rail: %} map. Spread it
  // across segments, preserving the per-segment readiness differential.
  function applyAppetiteFromFlat(flat) {
    const base = APPETITE[appetite] || SUBST_DEFAULT;
    const next = {};
    SEGMENTS.forEach((seg) => {
      next[seg] = {};
      LEGACY.forEach((rail) => {
        const ref = base.Retail[rail] || 1;
        const ratio = (base[seg][rail] || 0) / ref;
        next[seg][rail] = Math.round((flat[rail] ?? 0) * ratio);
      });
    });
    setSubst(next);
  }
  function finishWizard({ vol: v, oneTime: ot, annual: an, appetite: ap, customers: cu, mix: mx, firstName, bank }) {
    if (v) setVol(v);
    if (ot != null) setOneTime(ot);
    if (an != null) setAnnual(an);
    if (ap && APPETITE[ap]) { setAppetite(ap); setSubst(clone(APPETITE[ap])); }
    if (cu) setCustomers(cu);
    if (mx) setMix(mx);
    setPresetName("Custom (from guided setup)"); setUnit("Annual");
    if (firstName) setUserName(firstName); if (bank) setBankName(bank);
    setSimple(true); setStage("result");
  }
  const setVolRail = (r, v) => setVol({ ...vol, [r]: v });

  // ---- segment control helpers (wired into the persistent panel) ----
  const setMixCell = (rail, seg, v) => setMix({ ...mix, [rail]: { ...mix[rail], [seg]: v } });
  const resetMix = (next) => setMix(next);
  const setSubstCell = (seg, rail, v) => setSubst({ ...subst, [seg]: { ...subst[seg], [rail]: v } });
  function applyAppetite(name) {
    setAppetite(name);
    if (APPETITE[name]) setSubst(clone(APPETITE[name]));
  }
  // A band only describes the BUSINESS segment. The previous version rebuilt
  // every segment from defaults, silently destroying hand-entered Retail and
  // Internal costs. Reset Business only, then rescale it.
  function applyBand(name) {
    setBand(name);
    setSegCosts((prev) => {
      const next = clone(prev);
      next.Business = clone(DEFAULT_SEG_COSTS.Business);
      return name === "AFP median (default)" ? next : applyBusinessBand(next, name);
    });
  }

  // simple-view single migration dial, spread across segments
  const mig = subst.Retail?.Wire ?? 35;
  const setMig = (v) => {
    const base = APPETITE[appetite] || SUBST_DEFAULT;
    const next = {};
    SEGMENTS.forEach((seg) => {
      next[seg] = {};
      LEGACY.forEach((rail) => {
        const ratio = (base[seg][rail] || 0) / (base.Retail.Wire || 1);
        next[seg][rail] = rail === "ACH" ? 0 : Math.round(v * ratio);
      });
    });
    setSubst(next);
  };

  // ---- saved scenarios ("versions") ----
  const [scenarios, setScenarios] = useState(() => loadScenarios());

  // ---- the modular engine: split volume by segment, cost each independently ----
  const volBySeg = useMemo(() => splitVolume(vol, mix), [vol, mix]);
  const res = useMemo(
    () => runSegmented(volBySeg, segCosts, subst, oneTime, annual, disc, horizon, overrides),
    [volBySeg, segCosts, subst, oneTime, annual, disc, horizon, overrides]);
  const implied = useMemo(() => impliedTotalCostSeg(volBySeg, segCosts, overrides), [volBySeg, segCosts, overrides]);

  function saveScenario(name) {
    const sc = makeScenario(name, {
      bankName, mig, vol: clone(vol), costs: clone(segCosts[activeSegment]), segCosts: clone(segCosts),
      mix: clone(mix), customers: clone(customers), subst: clone(subst), overrides: clone(overrides),
      appetite, band, oneTime, annual, disc, horizon, result: res,
    });
    setScenarios(addScenario(sc));
    return sc;
  }
  function deleteScenario(id) { setScenarios(removeScenario(id)); }
  function loadScenario(sc) {
    setVol(clone(sc.vol));
    if (sc.segCosts) setSegCosts(clone(sc.segCosts));
    if (sc.mix) setMix(clone(sc.mix));
    if (sc.customers) setCustomers(clone(sc.customers));
    if (sc.subst) setSubst(clone(sc.subst));
    if (sc.overrides) setOverrides(clone(sc.overrides));
    if (sc.appetite) setAppetite(sc.appetite);
    if (sc.band) setBand(sc.band);
    setOneTime(sc.oneTime); setAnnual(sc.annual); setDisc(sc.disc); setHorizon(sc.horizon);
    if (sc.bankName) setBankName(sc.bankName);
    setSimple(false); setTab("calc");
  }

  // component edits are scoped to ONE segment — that is the whole point of the refactor
  const setComp = (seg, rail, key, v) => {
    const c = clone(segCosts); c[seg][rail][key] = v; setSegCosts(c); setBand("Custom");
  };
  const setOverride = (seg, rail, v) => setOverrides({ ...overrides, [seg]: { ...overrides[seg], [rail]: v } });
  const applyToAllRails = (seg, key, value) => {
    const c = clone(segCosts); RAILS.forEach((r) => { c[seg][r][key] = value; }); setSegCosts(c); setBand("Custom");
  };
  const applyToAllSegments = (rail, key, value) => {
    const c = clone(segCosts); SEGMENTS.forEach((s) => { c[s][rail][key] = value; }); setSegCosts(c); setBand("Custom");
  };

  const savings = res.rows.map((r) => ({ name: r.rail, value: Math.round(r.ann), color: RAIL_COLOR[r.rail] })).filter((d) => d.value > 0);
  const layerData = ["Wire", "Check", "Same-Day ACH", "Instant", "ACH"].map((r) => {
    const lt = layerTotals(segCosts[activeSegment][r]);
    return { name: r, Network: +lt.network.toFixed(3), Provider: +lt.provider.toFixed(3), Internal: +lt.internal.toFixed(3) };
  });
  const topSaver = [...res.rows].sort((a, b) => b.ann - a.ann)[0] || { rail: "—", ann: 0 };

  // props shared by the persistent panel in both views
  const panelProps = {
    open: panelOpen, onToggle: () => setPanelOpen(!panelOpen),
    bankName, setBankName, userName, setUserName,
    presetName, applyPreset, unit, setUnit, vol, setVolRail,
    customers, setCustomers, mix, setMixCell, resetMix,
    appetite, applyAppetite, subst, setSubstCell,
    oneTime, setOneTime, annual, setAnnual, disc, setDisc, horizon, setHorizon,
    onRestartWizard: () => { setSimple(true); setStage("wizard"); },
    onReset: resetAll,
    activeSegment, setActiveSegment,
  };

  // top-down compute
  const td = useMemo(() => {
    let sumL = 0, sumF = 0;
    RAILS.forEach((r) => { sumL += DEFAULTS[r].processing * tdCount[r]; sumF += DEFAULTS[r].fraud_loss * tdCount[r]; });
    let totNet = 0;
    const rows = RAILS.map((r) => {
      const c = tdCount[r];
      const labor = sumL > 0 ? tdLabor * (DEFAULTS[r].processing * c) / sumL : 0;
      const fraud = sumF > 0 ? tdFraud * (DEFAULTS[r].fraud_loss * c) / sumF : 0;
      const network = tdNet[r] * c; totNet += network;
      const totalCost = labor + network + fraud;
      return { rail: r, count: c, labor, network, fraud, totalCost, perTxn: c > 0 ? totalCost / c : 0 };
    });
    return { rows, grand: tdLabor + totNet + tdFraud, totNet };
  }, [tdLabor, tdFraud, tdCount, tdNet]);

  // ---- default client experience: guided wizard -> clean result ----
  if (simple && stage === "wizard") return <Wizard onComplete={finishWizard} onSkip={() => setSimple(false)} />;
  if (simple) return (
    // The control panel is mounted alongside the client result so a mistyped
    // input can always be corrected in place.
    <div className={"shell" + (panelOpen ? " withpanel" : "")}>
      <ControlPanel {...panelProps} />
      <div className="shellmain">
        <ClientResult
          vol={vol} setVolRail={setVolRail} costs={segCosts.Retail} subst={subst} mig={mig} setMig={setMig}
          overrides={overrides.Retail} result={res} volBySeg={volBySeg} segCosts={segCosts}
          oneTime={oneTime} annual={annual} disc={disc} horizon={horizon}
          userName={userName} bankName={bankName}
          scenarios={scenarios} onSaveScenario={saveScenario} onDeleteScenario={deleteScenario} onLoadScenario={loadScenario}
          onAdvanced={() => setSimple(false)}
          onRestart={() => setStage("wizard")}
          onSources={() => { setSimple(false); setTab("data"); }}
          onCompare={() => { setSimple(false); setTab("compare"); }}
        />
      </div>
    </div>
  );

  // ---- advanced analyst view (the full toolkit) ----
  return (
    <div className={"shell" + (panelOpen ? " withpanel" : "")}>
    <ControlPanel {...panelProps} />
    <div className="app shellmain">
      <header className="hero"><div className="wrap">
        <div className="herotop">
          <div className="brandwrap">
            <div className="brand">Payfinia</div>
            <div className="brandsub">Money movement analytics</div>
          </div>
          <div className="herobtns">
            <span className="savedtag">Auto-saved</span>
            <span className="textsize" title="Text size">
              <button className={"ts-sm" + (uiScale === 1 ? " on" : "")} onClick={() => setUiScale(1)} aria-label="Small text">A</button>
              <button className={"ts-md" + (uiScale === 1.1 ? " on" : "")} onClick={() => setUiScale(1.1)} aria-label="Medium text">A</button>
              <button className={"ts-lg" + (uiScale === 1.22 ? " on" : "")} onClick={() => setUiScale(1.22)} aria-label="Large text">A</button>
            </span>
            <button className="guidedbtn accent" onClick={() => { setSimple(true); setStage("result"); }}>← Client view</button>
            <button className="guidedbtn" onClick={() => { setSimple(true); setStage("wizard"); }}>Guided setup</button>
            <button className="guidedbtn" onClick={resetAll}>Reset</button>
          </div>
        </div>
        <h1>Instant Payments ROI Model</h1>
        <p>{userName ? <><strong>{userName}</strong>{bankName ? <> · <strong>{bankName}</strong></> : null} — </> : null}
          What your institution saves by moving the payments it originates to instant.
          Every cost is split into network, provider and internal layers, and costed separately for retail, business and
          internal volume.</p>
      </div></header>

      <nav className="tabs wrap" aria-label="Sections">
        <button className={tab === "calc" ? "on" : ""} onClick={() => setTab("calc")}>Results</button>
        <button className={tab === "assum" ? "on" : ""} onClick={() => setTab("assum")}>Cost assumptions</button>
        <button className={tab === "td" ? "on" : ""} onClick={() => setTab("td")}>Use my financials</button>
        <button className={tab === "why" ? "on" : ""} onClick={() => setTab("why")}>Rail-by-rail case</button>
        <button className={tab === "compare" ? "on" : ""} onClick={() => setTab("compare")}>Scenarios{scenarios.length ? ` (${scenarios.length})` : ""}</button>
        <button className={tab === "data" ? "on" : ""} onClick={() => setTab("data")}>Data &amp; sources</button>
      </nav>

      <main className="wrap">
        {/* ============ CALCULATOR ============ */}
        {tab === "calc" && (
          <>
            <details className="method">
              <summary>Methodology — how every number on this page is derived</summary>
              <div className="methodbody">
                <div className="mcol">
                  <h4>What each payment costs</h4>
                  <p>Every rail carries a fully-loaded cost per transaction split into three layers: the <b>network fee</b>
                    (published by the Fed and TCH), the <b>provider fee</b>, and your <b>internal cost</b> (staff, failures,
                    fraud, compliance). Defaults are public benchmarks and every one is editable.</p>
                </div>
                <div className="mcol">
                  <h4>How savings are computed</h4>
                  <p>Per rail: <b>savings = (your cost − instant cost) × payments shifted</b>. Only <b>outbound</b> volume
                    counts, and only the share you choose to shift. Net benefit subtracts the annual platform cost; ROI and
                    payback are measured against one-time setup.</p>
                </div>
                <div className="mcol">
                  <h4>Where the figures come from</h4>
                  <p>Volumes, fees and fraud rates trace to the <a href="https://www.frbservices.org/resources/financial-services/fednow/volume-value-stats" target="_blank" rel="noreferrer">Federal Reserve</a>,{" "}
                    <a href="https://www.nacha.org/content/ach-network-volume-and-value-statistics" target="_blank" rel="noreferrer">Nacha</a>,{" "}
                    <a href="https://www.theclearinghouse.org/payment-systems/rtp" target="_blank" rel="noreferrer">The Clearing House</a> and the AFP surveys.
                    Every line on the Data &amp; sources tab carries a verify link; anything not directly citable is
                    labelled <b>Estimate</b>.</p>
                </div>
                <div className="mcol">
                  <h4>Reconciling to your books</h4>
                  <p>The <b>reconciliation</b> card shows the total annual cost your inputs imply for current volume.
                    Compare it with the payment-operations line on your NCUA or FDIC call report to confirm the model is
                    grounded in your reality.</p>
                </div>
              </div>
            </details>
            <MethodFlags open={flagsOpen} setOpen={setFlagsOpen} />

            <div className="grid onecol">
              <section className="results">
                <div className={res.net > 0 ? "savehero" : "savehero neg"}>
                  <div className="lbl">Estimated annual net savings</div>
                  <div className="big">{res.net > 0 ? money(res.net) : "—"}<span>/ year</span></div>
                  {res.net > 0 && <div className="subrow">
                    <span>{money(res.net / 12)} <i>per month</i></span>
                    <span>{res.payback === Infinity ? "—" : `${res.payback.toFixed(1)} months`} <i>payback</i></span>
                    <span>{money(res.npv)} <i>5-year value</i></span>
                  </div>}
                </div>
                <div className={res.net > 0 ? "note" : "note warn"}>
                  {res.net > 0
                    ? <>Instant costs about <b>{money2(res.instant)}</b> per transaction all-in. The largest single contributor is <b>{topSaver.rail}</b> at <b>{money(topSaver.ann)}</b> a year. Checks and wires drive the result; standard ACH is already cheaper than instant and is not recommended for migration.</>
                    : <>At these inputs the migration does not pay back. Increase outbound check or wire volume, raise the share shifted, or revise the one-time setup cost.</>}
                </div>

                <div className="metrics3">
                  <div className="metric"><span>First-year ROI</span><b>{Math.round(res.roi * 100)}%</b></div>
                  <div className="metric"><span>Gross savings</span><b>{money(res.gross)}</b></div>
                  <div className="metric"><span>Annual platform cost</span><b>{money(annual)}</b></div>
                </div>

                <SegmentBreakdown result={res} segCosts={segCosts} volBySeg={volBySeg} />

                <div className="card chart">
                  <div className="cardhead">
                    <h3>Cost per transaction by layer</h3>
                    <span className="cardnote">Network · provider · internal — <b style={{ color: SEG_META[activeSegment].color }}>{SEG_META[activeSegment].label}</b> segment</span>
                  </div>
                  <div className="segtabs inline">
                    {SEGMENTS.map((s) => (
                      <button key={s} className={activeSegment === s ? "on" : ""} onClick={() => setActiveSegment(s)}
                        style={activeSegment === s ? { borderColor: SEG_META[s].color, color: SEG_META[s].color } : undefined}>
                        {SEG_META[s].label}
                      </button>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={layerData} layout="vertical" margin={{ left: 8, right: 30, top: 4, bottom: 4 }}>
                      <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v) => money2(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Network" stackId="a" fill={L1} radius={[4, 0, 0, 4]} />
                      <Bar dataKey="Provider" stackId="a" fill={L2} />
                      <Bar dataKey="Internal" stackId="a" fill={L3} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card chart">
                  <div className="cardhead">
                    <h3>Where the savings come from</h3>
                    <span className="cardnote">Per year, by rail</span>
                  </div>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={savings} layout="vertical" margin={{ left: 8, right: 90, top: 4, bottom: 4 }}>
                      <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v) => money(v)} />
                      <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                        {savings.map((d, i) => <Cell key={i} fill={d.color} />)}
                        <LabelList dataKey="value" position="right" formatter={(v) => money(v)} style={{ fontSize: 12, fill: "#1F3864", fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card sanity">
                  <h3>Reconciliation against your books</h3>
                  <p>These inputs imply roughly <b>{money(implied)} per year</b> to support current outbound checks, wires
                    and ACH. Compare that with the payment-operations line on your{" "}
                    <a href={GROUNDING_SRC.url} target="_blank" rel="noreferrer">NCUA or FDIC call report</a>. If it lands in
                    the same range the assumptions hold; if not, adjust the cost inputs on the Cost assumptions tab.</p>
                </div>

                <div className="card">
                  <div className="cardhead">
                    <h3>Detail by rail</h3>
                    <span className="cardnote">Blended across all customer segments</span>
                  </div>
                  <div className="tablewrap">
                    <table className="dtbl">
                      <colgroup><col style={{ width: "24%" }} /><col /><col /><col /><col /></colgroup>
                      <thead>
                        <tr>
                          <th scope="col">Rail</th>
                          <th scope="col" className="n">Your cost / txn</th>
                          <th scope="col" className="n">Saved / txn</th>
                          <th scope="col" className="n">Payments migrated</th>
                          <th scope="col" className="n">Savings / yr</th>
                        </tr>
                      </thead>
                      <tbody>
                        {res.rows.map((r) => (
                          <tr key={r.rail}>
                            <th scope="row"><span className="railname"><i className="raildot" style={{ background: RAIL_COLOR[r.rail] }} />{r.rail === "ACH" ? "Standard ACH" : r.rail}</span></th>
                            <td className="n">{money2(r.legacy)}</td>
                            <td className={"n" + (r.per < 0 ? " negval" : "")}>{money2(r.per)}</td>
                            <td className="n">{num(r.migrated)}</td>
                            <td className={"n strong" + (r.ann < 0 ? " negval" : "")}>{money(r.ann)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row">Gross total</th>
                          <td className="n">—</td><td className="n">—</td>
                          <td className="n">{num(res.rows.reduce((s, r) => s + r.migrated, 0))}</td>
                          <td className="n strong">{money(res.gross)}</td>
                        </tr>
                        <tr className="sub">
                          <th scope="row">Less annual platform cost</th>
                          <td className="n">—</td><td className="n">—</td><td className="n">—</td>
                          <td className="n">−{money(annual)}</td>
                        </tr>
                        <tr className="grand">
                          <th scope="row">Net annual savings</th>
                          <td className="n">—</td><td className="n">—</td><td className="n">—</td>
                          <td className="n strong">{money(res.net)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}

        {/* ============ USE MY FINANCIALS (top-down) ============ */}
        {tab === "td" && (
          <div className="grid">
            <section className="card inputs">
              <h2>Aggregate figures from your books</h2>
              <p className="hint">Most institutions can't state a per-check cost, but they know their totals. Enter the
                aggregates and the model allocates them across rails by researched intensity.</p>
              <label className="fld"><span>Total labor to support payments ($ / yr)</span><NumberInput value={tdLabor} onChange={setTdLabor} /></label>
              <label className="fld"><span>Total fraud losses ($ / yr)</span><NumberInput value={tdFraud} onChange={setTdFraud} /></label>

              <h2>Payments per year, by rail</h2>
              {RAILS.map((r) => (
                <label className="fld" key={r}><span>{r === "ACH" ? "Standard ACH" : r}</span>
                  <NumberInput value={tdCount[r]} onChange={(v) => setTdCount({ ...tdCount, [r]: v })} /></label>
              ))}

              <h2>Network fee per item</h2>
              <p className="hint">Pre-filled with published fee schedules (FedNow and RTP $0.045, Fedwire about $0.78).
                Overwrite each with the exact fee your processor charges.</p>
              {RAILS.map((r) => (
                <label className="fld" key={r}><span>{r === "ACH" ? "Standard ACH" : r} ($ / item)</span>
                  <input type="number" step="0.001" value={tdNet[r]} onChange={(e) => setTdNet({ ...tdNet, [r]: +e.target.value })} /></label>
              ))}
            </section>
            <section className="results">
              <div className="savehero">
                <div className="lbl">Total annual cost to support payments</div>
                <div className="big">{money(td.grand)}</div>
                <div className="subrow">
                  <span>{money(tdLabor)} <i>labor</i></span>
                  <span>{money(td.totNet)} <i>network</i></span>
                  <span>{money(tdFraud)} <i>fraud</i></span>
                </div>
              </div>
              <div className="note">Network fees are exact — rate × count. Total labor and fraud are allocated across rails
                by each rail's researched intensity × volume, so a wire carries far more labor per item than an ACH while
                every component still sums back to your reported totals.</div>
              <div className="card">
                <div className="cardhead">
                  <h3>Cost breakdown by rail</h3>
                  <span className="cardnote">Derived from your totals</span>
                </div>
                <div className="tablewrap">
                  <table className="dtbl">
                    <colgroup><col style={{ width: "18%" }} /><col /><col /><col /><col /><col /><col /></colgroup>
                    <thead>
                      <tr>
                        <th scope="col">Rail</th>
                        <th scope="col" className="n">Count</th>
                        <th scope="col" className="n">Labor</th>
                        <th scope="col" className="n">Network</th>
                        <th scope="col" className="n">Fraud</th>
                        <th scope="col" className="n">Total</th>
                        <th scope="col" className="n">$ / txn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {td.rows.filter((r) => r.count > 0).map((r) => (
                        <tr key={r.rail}>
                          <th scope="row"><span className="railname"><i className="raildot" style={{ background: RAIL_COLOR[r.rail] }} />{r.rail === "ACH" ? "Standard ACH" : r.rail}</span></th>
                          <td className="n">{num(r.count)}</td>
                          <td className="n">{money(r.labor)}</td>
                          <td className="n">{money(r.network)}</td>
                          <td className="n">{money(r.fraud)}</td>
                          <td className="n strong">{money(r.totalCost)}</td>
                          <td className="n">{money2(r.perTxn)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="grand">
                        <th scope="row">Total</th>
                        <td className="n">{num(td.rows.reduce((s, r) => s + r.count, 0))}</td>
                        <td className="n">{money(tdLabor)}</td>
                        <td className="n">{money(td.totNet)}</td>
                        <td className="n">{money(tdFraud)}</td>
                        <td className="n strong">{money(td.grand)}</td>
                        <td className="n">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="fine">The $/txn column is your own cost per transaction, derived from your reported totals
                  rather than published benchmarks.</p>
              </div>
            </section>
          </div>
        )}

        {/* ============ RAIL DATA ============ */}
        {tab === "data" && (
          <div className="datawrap">
            <p className="lead">Published figures for each rail. Every statistic states the value, the year and the
              publisher, with a link to verify it at source.</p>
            {RAILS.map((rail) => (
              <div className="card railcard" key={rail}>
                <h3><span className="dot" style={{ background: RAIL_COLOR[rail] }} />{rail === "Instant" ? "Instant payments — FedNow & RTP" : rail === "ACH" ? "Standard ACH" : rail}
                  {rail === "Instant" && <span className="badge">migration target</span>}</h3>
                <div className="tablewrap">
                  <table className="dtbl">
                    <colgroup><col style={{ width: "18%" }} /><col style={{ width: "42%" }} /><col style={{ width: "10%" }} /><col style={{ width: "22%" }} /><col style={{ width: "8%" }} /></colgroup>
                    <thead>
                      <tr>
                        <th scope="col">Metric</th><th scope="col">Value</th>
                        <th scope="col">As of</th><th scope="col">Publisher</th><th scope="col" className="n">Source</th>
                      </tr>
                    </thead>
                    <tbody>{RAIL_FACTS[rail].map(([m, v, y, p, url], i) => (
                      <tr key={i}>
                        <th scope="row">{m}</th><td>{v}</td><td className="nowrap">{y}</td><td>{p}</td>
                        <td className="n"><a href={url} target="_blank" rel="noreferrer">verify ↗</a></td>
                      </tr>))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ============ WHY MIGRATE ============ */}
        {tab === "why" && (
          <div className="datawrap">
            <p className="lead">The case for moving each rail, computed live from the cost assumptions for the selected
              customer segment. Standard ACH is normally flagged “keep” because it is already cheaper per item than instant.</p>
            <div className="segtabs">
              {SEGMENTS.map((s) => (
                <button key={s} className={activeSegment === s ? "on" : ""} onClick={() => setActiveSegment(s)}
                  style={activeSegment === s ? { borderColor: SEG_META[s].color, color: SEG_META[s].color } : undefined}>
                  {SEG_META[s].label}
                </button>
              ))}
            </div>
            <WhyMigrate costs={costs} ov={overrides[activeSegment]} segment={activeSegment} />
          </div>
        )}

        {/* ============ COMPARE VERSIONS ============ */}
        {tab === "compare" && <Compare scenarios={scenarios} onLoad={loadScenario} onDelete={deleteScenario} />}

        {/* ============ COST ASSUMPTIONS (3 layers + mini-calcs) ============ */}
        {tab === "assum" && (
          <Assumptions
            segCosts={segCosts} setComp={setComp} volBySeg={volBySeg}
            overrides={overrides} setOverride={setOverride}
            applyToAllRails={applyToAllRails} applyToAllSegments={applyToAllSegments}
            activeSegment={activeSegment} setActiveSegment={setActiveSegment}
            band={band} applyBand={applyBand}
          />
        )}
      </main>

      <footer className="wrap">
        <div className="footrow">
          <span><b>Payfinia</b> · Instant Payments ROI Model</span>
          <span>Cost = network + provider + internal, costed per customer segment</span>
          <span>Migration applies to outbound volume you originate</span>
          <span>Figures current as of the 2026 research pass</span>
        </div>
        <p className="footfine">Estimate for discussion. Not a guarantee of savings.</p>
      </footer>
      <ChatAssistant onApply={applyFromAssistant} />
    </div>
    </div>
  );
}

// ---------- model limitations: disclosed rather than hidden ----------
function MethodFlags({ open, setOpen }) {
  const high = METHOD_FLAGS.filter((f) => f.severity === "high").length;
  return (
    <div className={"flagbox" + (open ? " open" : "")}>
      <button className="flaghead" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="flagdot" />
        <b>Model limitations ({METHOD_FLAGS.length})</b>
        <span className="flagsub">{high} material, pending calibration against production data</span>
        <span className="flagcaret">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="flagbody">
          {METHOD_FLAGS.map((f) => (
            <div className={"flagitem " + f.severity} key={f.id}>
              <div className="flagtop">
                <span className={"sev " + f.severity}>{f.severity === "high" ? "High" : "Medium"}</span>
                <b>{f.title}</b>
                <span className="flagaffects">{f.affects}</span>
              </div>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Cost Assumptions tab: 3-layer table + mini-calculators + sources ----------
function Assumptions({ segCosts, setComp, volBySeg, overrides, setOverride, applyToAllRails, applyToAllSegments, activeSegment, setActiveSegment, band, applyBand }) {
  const seg = activeSegment;
  const [rail, setRail] = useState("Check");
  const costs = segCosts[seg];
  const c = costs[rail];
  const segVol = volBySeg[seg] || {};
  const ovVal = overrides[seg]?.[rail] ?? "";
  const ovActive = ovVal !== "" && !isNaN(+ovVal);
  const src = SEG_SOURCING[seg]?.[rail];

  // mini-calc local inputs.
  // A headcount-and-salary model alone does not capture the fraction of time
  // staff spend on a specific rail — e.g. Same-Day ACH versus instant payments.
  // pctTime supplies that factor; `loaded` applies a benefits/overhead multiplier.
  const [fte, setFte] = useState(2), [salary, setSalary] = useState(55000);
  const [pctTime, setPctTime] = useState(25), [loaded, setLoaded] = useState(true);
  const [items, setItems] = useState(Math.round(segVol[rail] || 100000));
  const [failed, setFailed] = useState(1500), [perFail, setPerFail] = useState(8);
  const [fraudUsd, setFraudUsd] = useState(50000), [fItems, setFItems] = useState(Math.round(segVol[rail] || 100000));
  const [fpUsd, setFpUsd] = useState(12000), [fpItems, setFpItems] = useState(Math.round(segVol[rail] || 100000));
  const [amlUsd, setAmlUsd] = useState(15000), [amlItems, setAmlItems] = useState(Math.round(segVol[rail] || 100000));
  const [recFte, setRecFte] = useState(1), [recSalary, setRecSalary] = useState(55000);
  const [recPctTime, setRecPctTime] = useState(20), [recItems, setRecItems] = useState(Math.round(segVol[rail] || 100000));
  const [liqBal, setLiqBal] = useState(500000), [liqRate, setLiqRate] = useState(4), [liqItems, setLiqItems] = useState(Math.round(segVol[rail] || 100000));

  // re-point the mini-calcs at the selected segment x rail volume
  useEffect(() => {
    const v = Math.round(segVol[rail] || 0);
    if (v > 0) { setItems(v); setFItems(v); setFpItems(v); setAmlItems(v); setRecItems(v); setLiqItems(v); }
  }, [seg, rail]); // eslint-disable-line react-hooks/exhaustive-deps

  const procPer = laborPerItem({ fte, salary, pctTime, items, loaded });
  const failRate = items > 0 ? failed / items : 0;
  const fraudPer = perItem(fraudUsd, fItems);
  const fpPer = perItem(fpUsd, fpItems);
  const amlPer = perItem(amlUsd, amlItems);
  const recPer = laborPerItem({ fte: recFte, salary: recSalary, pctTime: recPctTime, items: recItems, loaded });
  const liqPer = liqItems > 0 ? (liqBal * (liqRate / 100)) / liqItems : 0;

  const layers = layerTotals(c);
  return (
    <div className="datawrap">
      <details className="method">
        <summary>How to use this tab</summary>
        <div className="methodbody">
          <div className="mcol"><h4>Pick a segment and rail</h4><p>Cost per transaction is shown split into <b>network</b>, <b>provider</b> (instant only) and <b>internal</b> layers, for the segment you select.</p></div>
          <div className="mcol"><h4>Build from what you know</h4><p>The <b>cost builder</b> turns figures you have — staff × salary, fraud dollars, failed items — into a per-item cost. Values are <b>$ per transaction</b> unless marked “rate.”</p></div>
          <div className="mcol"><h4>Copy a value across</h4><p><b>⇊ rails</b> applies a value to every rail in the current segment. <b>⇉ segs</b> applies it to the same rail across all three segments.</p></div>
          <div className="mcol"><h4>Or override the total</h4><p>If you already know your true all-in cost for a rail, enter it under <b>override total</b>. The model uses that figure directly and every result updates.</p></div>
        </div>
      </details>
      <p className="lead">Cost per transaction, split into three layers: <b style={{ color: L1 }}>network</b> charges,
        the <b style={{ color: L2 }}>provider</b> charge (instant only), and your <b style={{ color: L3 }}>internal</b> cost.
        Build the internal figures from data you hold, or override the all-in total outright.</p>

      {/* ---- segment selector: the modular structure, made explicit ---- */}
      <div className="card segpicker">
        <div className="segpickrow">
          <div>
            <h3>Customer segment</h3>
            <p className="fine">Each segment carries its own internal cost stack. Network and provider fees are identical
              across segments — the Fed and TCH charge the same per-item fee regardless of who the payment is for.</p>
          </div>
          <div className="segtabs big">
            {SEGMENTS.map((s) => (
              <button key={s} className={seg === s ? "on" : ""} onClick={() => setActiveSegment(s)}
                style={seg === s ? { borderColor: SEG_META[s].color, color: SEG_META[s].color } : undefined}>
                <b>{SEG_META[s].label}</b><em>{SEG_META[s].short}</em>
              </button>
            ))}
          </div>
        </div>
        {seg === "Business" && (
          <div className="bandrow">
            <span>Business cost band:</span>
            <div className="toggle small">
              {Object.keys(BUSINESS_BANDS).map((b) => (
                <button key={b} className={band === b ? "on" : ""} onClick={() => applyBand(b)}>{b}</button>
              ))}
              {band === "Custom" && <button className="on">Custom</button>}
            </div>
            <p className="fine">{BUSINESS_BANDS[band]?.note || "You've hand-edited a component, so the band no longer applies."}</p>
          </div>
        )}
        {seg === "Internal" && (
          <p className="fine warnline">No public dataset breaks out a financial institution's own-account cost per item.
            Every figure in this segment is an <b>estimate</b> and a calibration target rather than evidence.</p>
        )}
      </div>

      <div className="assumgrid">
        <div className="card assum-stack">
          <div className="cardhead">
            <h3>Cost stack</h3>
            <span className="cardnote"><b style={{ color: SEG_META[seg].color }}>{SEG_META[seg].label}</b> · {rail === "ACH" ? "Standard ACH" : rail}</span>
          </div>
          <label className="fld"><span>Rail</span>
            <select value={rail} onChange={(e) => setRail(e.target.value)}>
              {RAILS.map((r) => <option key={r} value={r}>{r === "ACH" ? "Standard ACH" : r}</option>)}
            </select></label>
          {src && (
            <p className="srcline">
              <StatusTag status={src.status} /> {src.basis}{" "}
              <a href={src.url} target="_blank" rel="noreferrer">verify ↗</a>
            </p>
          )}
          <div className="tablewrap">
            <table className="dtbl compact">
              <colgroup><col style={{ width: "22%" }} /><col /><col style={{ width: "42%" }} /></colgroup>
              <thead><tr><th scope="col">Layer</th><th scope="col">Component</th><th scope="col" className="n">Value</th></tr></thead>
              <tbody>
                {COMP_FIELDS.filter((f) => f.key !== "provider" || rail === "Instant").map((f) => (
                  <tr key={f.key} className={f.perSegment ? "" : "shared"}>
                    <td><span className="layerpill" style={{ background: (f.layer === "Network" ? L1 : f.layer === "Provider" ? L2 : L3) + "1a", color: f.layer === "Network" ? L1 : f.layer === "Provider" ? L2 : L3 }}>{f.layer}</span></td>
                    <th scope="row">{f.label}{!f.perSegment && <em className="sharedtag" title="Identical across all three segments">shared</em>}</th>
                    <td className="n"><span className="valwrap">
                      {f.kind === "$" && <span className="pfx">$</span>}
                      <input type="number" step={f.kind === "%" ? "0.001" : "0.01"} value={c[f.key]}
                        onChange={(e) => setComp(seg, rail, f.key, +e.target.value)} />
                      {f.kind === "%" && <span className="sfx">rate</span>}
                      <button className="applyall" title={`Apply this ${f.label} to every rail in ${SEG_META[seg].label}`} onClick={() => applyToAllRails(seg, f.key, c[f.key])}>⇊ rails</button>
                      <button className="applyall alt" title={`Apply this ${f.label} for ${rail} to all three segments`} onClick={() => applyToAllSegments(rail, f.key, c[f.key])}>⇉ segs</button>
                    </span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="grand"><th scope="row" colSpan="2">All-in cost per transaction</th>
                  <td className="n strong">{money2(railTotal(c))}</td></tr>
              </tfoot>
            </table>
          </div>
          <p className="fine layersum">
            <span><i style={{ background: L1 }} />Network {money2(layers.network)}</span>
            {rail === "Instant" && <span><i style={{ background: L2 }} />Provider {money2(layers.provider)}</span>}
            <span><i style={{ background: L3 }} />Internal {money2(layers.internal)}</span>
          </p>

          {/* side-by-side so the segment differential is visible at a glance */}
          <div className="tablewrap">
            <table className="dtbl compact segcompare">
              <thead><tr><th scope="col">{rail === "ACH" ? "Standard ACH" : rail} all-in</th>{SEGMENTS.map((s) => <th key={s} className="n">{SEG_META[s].label}</th>)}</tr></thead>
              <tbody>
                <tr>
                  <th scope="row">$ per transaction</th>
                  {SEGMENTS.map((s) => (
                    <td key={s} className={"n" + (s === seg ? " here" : "")} style={{ color: SEG_META[s].color, fontWeight: s === seg ? 700 : 500 }}>
                      {money2(railTotal(segCosts[s][rail]))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="overridebox">
            <label className="fld" style={{ marginBottom: 6 }}>
              <span>Override all-in $ / txn <em>optional</em></span>
              <span className="valwrap"><span className="pfx">$</span>
                <input type="number" step="0.01" value={ovVal} placeholder={railTotal(c).toFixed(2)}
                  onChange={(e) => setOverride(seg, rail, e.target.value)} style={{ width: 120 }} /></span>
            </label>
            {ovActive
              ? <p className="fine ovon">Using your override of <b>{money2(+ovVal)}</b> / txn for {SEG_META[seg].label} · {rail} — the stack above is ignored. <button type="button" className="linkbtn" onClick={() => setOverride(seg, rail, "")}>Clear override</button></p>
              : <p className="fine">Leave blank to use the built-up stack ({money2(railTotal(c))} / txn).</p>}
          </div>
        </div>

        <div className="card assum-builder">
          <div className="cardhead">
            <h3>Cost builder</h3>
            <span className="cardnote"><b style={{ color: SEG_META[seg].color }}>{SEG_META[seg].label}</b> · {rail === "ACH" ? "Standard ACH" : rail}</span>
          </div>
          <p className="fine">Few institutions can state a per-item cost directly, but these inputs are known. Item counts
            are pre-filled with this segment's share of {rail === "ACH" ? "standard ACH" : rail} volume
            ({num(segVol[rail] || 0)} / yr). Compute, then apply.</p>

          <div className="minicalc primary">
            <b>Processing / labor</b>
            <p className="mc-note">
              Headcount × salary alone overstates cost — staff don't work a single rail all day. Enter the
              <b> share of their time</b> that goes to {rail === "ACH" ? "standard ACH" : rail} for {SEG_META[seg].label.toLowerCase()} customers.
            </p>
            <div className="mc-row"><label>Staff (FTE) touching this rail</label><input type="number" step="0.1" value={fte} onChange={(e) => setFte(+e.target.value)} /></div>
            <div className="mc-row"><label>Avg base salary ($/yr)</label><NumberInput value={salary} onChange={setSalary} /></div>
            <div className="mc-row highlight">
              <label>Share of time on this rail &amp; segment</label>
              <span className="pctwrap">
                <input type="range" min="0" max="100" value={pctTime} onChange={(e) => setPctTime(+e.target.value)} />
                <input type="number" min="0" max="100" value={pctTime} onChange={(e) => setPctTime(+e.target.value)} style={{ width: 58 }} />
                <span className="sfx">%</span>
              </span>
            </div>
            <div className="mc-row">
              <label>Load salary with benefits &amp; overhead (×{LOADED_SALARY_MULT})</label>
              <input type="checkbox" checked={loaded} onChange={(e) => setLoaded(e.target.checked)} />
            </div>
            <div className="mc-row"><label>Items handled / yr</label><NumberInput value={items} onChange={setItems} /></div>
            <div className="mc-out">
              = <b>{money2(procPer)}</b> / item
              <button onClick={() => setComp(seg, rail, "processing", +procPer.toFixed(4))}>Apply</button>
            </div>
            <p className="mc-formula">
              {fte} FTE × {money(salary)}{loaded ? ` × ${LOADED_SALARY_MULT}` : ""} × {pctTime}% ÷ {num(items)} items
            </p>
          </div>

          <div className="minicalc">
            <b>Failure / exception</b>
            <div className="mc-row"><label>Items failed / returned / yr</label><NumberInput value={failed} onChange={setFailed} /></div>
            <div className="mc-row"><label>Cost per failed item ($)</label><input type="number" value={perFail} onChange={(e) => setPerFail(+e.target.value)} /></div>
            <div className="mc-out">rate = <b>{(failRate * 100).toFixed(2)}%</b> <button onClick={() => { setComp(seg, rail, "failure_rate", +failRate.toFixed(4)); setComp(seg, rail, "cost_per_failure", perFail); }}>Apply</button></div>
          </div>

          <div className="minicalc">
            <b>Fraud loss</b>
            <div className="mc-row"><label>Total fraud losses / yr ($)</label><NumberInput value={fraudUsd} onChange={setFraudUsd} /></div>
            <div className="mc-row"><label>Items / yr</label><NumberInput value={fItems} onChange={setFItems} /></div>
            <div className="mc-out">= <b>{money2(fraudPer)}</b> / item <button onClick={() => setComp(seg, rail, "fraud_loss", +fraudPer.toFixed(4))}>Apply</button></div>
          </div>

          <div className="minicalc">
            <b>Fraud prevention (screening &amp; tools)</b>
            <div className="mc-row"><label>Fraud tools &amp; staff / yr ($)</label><NumberInput value={fpUsd} onChange={setFpUsd} /></div>
            <div className="mc-row"><label>Items / yr</label><NumberInput value={fpItems} onChange={setFpItems} /></div>
            <div className="mc-out">= <b>{money2(fpPer)}</b> / item <button onClick={() => setComp(seg, rail, "fraud_prevention", +fpPer.toFixed(4))}>Apply</button></div>
          </div>

          <div className="minicalc">
            <b>Compliance (AML / BSA)</b>
            <div className="mc-row"><label>AML, BSA &amp; OFAC cost / yr ($)</label><NumberInput value={amlUsd} onChange={setAmlUsd} /></div>
            <div className="mc-row"><label>Items / yr</label><NumberInput value={amlItems} onChange={setAmlItems} /></div>
            <div className="mc-out">= <b>{money2(amlPer)}</b> / item <button onClick={() => setComp(seg, rail, "compliance", +amlPer.toFixed(4))}>Apply</button></div>
          </div>

          <div className="minicalc">
            <b>Reconciliation</b>
            <p className="mc-note">Same time-allocation logic as processing — reconciliation staff are split across rails too.</p>
            <div className="mc-row"><label>Recon staff (FTE)</label><input type="number" step="0.1" value={recFte} onChange={(e) => setRecFte(+e.target.value)} /></div>
            <div className="mc-row"><label>Avg base salary ($/yr)</label><NumberInput value={recSalary} onChange={setRecSalary} /></div>
            <div className="mc-row highlight">
              <label>Share of time on this rail &amp; segment</label>
              <span className="pctwrap">
                <input type="range" min="0" max="100" value={recPctTime} onChange={(e) => setRecPctTime(+e.target.value)} />
                <input type="number" min="0" max="100" value={recPctTime} onChange={(e) => setRecPctTime(+e.target.value)} style={{ width: 58 }} />
                <span className="sfx">%</span>
              </span>
            </div>
            <div className="mc-row"><label>Items / yr</label><NumberInput value={recItems} onChange={setRecItems} /></div>
            <div className="mc-out">= <b>{money2(recPer)}</b> / item <button onClick={() => setComp(seg, rail, "reconciliation", +recPer.toFixed(4))}>Apply</button></div>
          </div>

          <div className="minicalc">
            <b>Liquidity / prefunding</b>
            <div className="mc-row"><label>Avg prefunded balance ($)</label><NumberInput value={liqBal} onChange={setLiqBal} /></div>
            <div className="mc-row"><label>Cost of funds (% / yr)</label><input type="number" step="0.1" value={liqRate} onChange={(e) => setLiqRate(+e.target.value)} /></div>
            <div className="mc-row"><label>Items / yr</label><NumberInput value={liqItems} onChange={setLiqItems} /></div>
            <div className="mc-out">= <b>{money2(liqPer)}</b> / item <button onClick={() => setComp(seg, rail, "liquidity", +liqPer.toFixed(4))}>Apply</button></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="cardhead">
          <h3>Sources for each cost line</h3>
          <span className="cardnote">Where the default came from, and how to replace it</span>
        </div>
        <div className="tablewrap">
          <table className="dtbl">
            <colgroup><col style={{ width: "12%" }} /><col style={{ width: "20%" }} /><col /><col style={{ width: "13%" }} /><col style={{ width: "8%" }} /></colgroup>
            <thead>
              <tr>
                <th scope="col">Layer</th><th scope="col">Cost line</th><th scope="col">Basis</th>
                <th scope="col">Status</th><th scope="col" className="n">Source</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(SRC).map(([k, v]) => (
                <tr key={k}>
                  <td><span className="layerpill" style={{ background: (v.layer === "Network" ? L1 : v.layer === "Provider" ? L2 : L3) + "1a", color: v.layer === "Network" ? L1 : v.layer === "Provider" ? L2 : L3 }}>{v.layer}</span></td>
                  <th scope="row">{k}</th>
                  <td>{v.supports}</td>
                  <td><StatusTag status={v.status} /></td>
                  <td className="n"><a href={v.url} target="_blank" rel="noreferrer">open ↗</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine">Default internal costs are grounded in <a href={GROUNDING_SRC.url} target="_blank" rel="noreferrer">{GROUNDING_SRC.publisher}</a>. Replace them with your own figures using the cost builder above.</p>
      </div>
    </div>
  );
}
