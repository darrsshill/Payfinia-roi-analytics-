import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList, Tooltip, Legend } from "recharts";
import {
  RAILS, LEGACY, DEFAULTS, COMP_FIELDS, SUBST_DEFAULT, PRESETS, SRC, SUBST_SRC,
  GROUNDING_SRC, RAIL_FACTS, RAIL_COLOR, U, railTotal, layerTotals, runBottomUp, impliedTotalCost,
} from "./data.js";
import ChatAssistant from "./ChatAssistant.jsx";
import Wizard from "./Wizard.jsx";
import ClientResult from "./ClientResult.jsx";
import Compare from "./Compare.jsx";
import WhyMigrate from "./WhyMigrate.jsx";
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
const LS_KEY = "payfinia_calc_v1";
function loadSaved() {
  try { if (typeof window === "undefined" || !window.localStorage) return null; return JSON.parse(window.localStorage.getItem(LS_KEY)) || null; }
  catch { return null; }
}
const defaultNet = () => { const o = {}; RAILS.forEach((r) => { o[r] = DEFAULTS[r].network; }); return o; };

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
  const [subst, setSubst] = useState(SAVED?.subst || { ...SUBST_DEFAULT });
  const [disc, setDisc] = useState(SAVED?.disc ?? 10);
  const [horizon, setHorizon] = useState(SAVED?.horizon ?? 5);
  const [costs, setCosts] = useState(() => SAVED?.costs || clone(DEFAULTS));
  const [overrides, setOverrides] = useState(SAVED?.overrides || { Check: "", Wire: "", "Same-Day ACH": "", ACH: "", Instant: "" });

  // top-down state (Justin's example)
  const [tdLabor, setTdLabor] = useState(SAVED?.tdLabor ?? 10000000);
  const [tdFraud, setTdFraud] = useState(SAVED?.tdFraud ?? 500000);
  const [tdCount, setTdCount] = useState(SAVED?.tdCount || { Check: 1000000, Wire: 100000, "Same-Day ACH": 0, ACH: 40000000, Instant: 0 });
  const [tdNet, setTdNet] = useState(SAVED?.tdNet || defaultNet());

  // auto-save everything to the browser on any change
  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify({
        simple, stage, userName, bankName, tab, unit, presetName, vol, oneTime, annual, subst, disc, horizon, costs, overrides,
        tdLabor, tdFraud, tdCount, tdNet,
      }));
    } catch { /* storage unavailable — ignore */ }
  }, [simple, stage, userName, bankName, tab, unit, presetName, vol, oneTime, annual, subst, disc, horizon, costs, overrides, tdLabor, tdFraud, tdCount, tdNet]);

  function resetAll() {
    if (typeof window !== "undefined" && !window.confirm("Reset all inputs to the default example? This clears your saved progress in this browser.")) return;
    try { window.localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    const p = PRESETS["Mid CFI (~$1B)"];
    setPresetName("Mid CFI (~$1B)");
    setVol({ Check: p.Check, Wire: p.Wire, "Same-Day ACH": p["Same-Day ACH"], ACH: p.ACH });
    setOneTime(p.oneTime); setAnnual(p.annual);
    setSubst({ ...SUBST_DEFAULT }); setDisc(10); setHorizon(5);
    setCosts(clone(DEFAULTS)); setOverrides({ Check: "", Wire: "", "Same-Day ACH": "", ACH: "", Instant: "" }); setUnit("Annual");
    setUserName(""); setBankName("");
    setTdLabor(10000000); setTdFraud(500000);
    setTdCount({ Check: 1000000, Wire: 100000, "Same-Day ACH": 0, ACH: 40000000, Instant: 0 });
    setTdNet(defaultNet());
    setTab("calc"); setSimple(true); setStage("wizard");
  }

  const mult = unit === "Monthly" ? 12 : 1;                        // display->annual
  const disp = (r) => Math.round(vol[r] / mult);
  const setDisp = (r, v) => setVol({ ...vol, [r]: v * mult });

  function applyPreset(name) {
    setPresetName(name); const p = PRESETS[name];
    setVol({ Check: p.Check, Wire: p.Wire, "Same-Day ACH": p["Same-Day ACH"], ACH: p.ACH });
    setOneTime(p.oneTime); setAnnual(p.annual);
  }
  function applyFromAssistant({ vol: v, oneTime: ot, annual: an, subst: s }) {
    setVol(v); setOneTime(ot); setAnnual(an); setSubst(s); setPresetName("Custom (from assistant)"); setUnit("Annual"); setTab("calc");
  }
  function finishWizard({ vol: v, oneTime: ot, annual: an, subst: s, firstName, bank }) {
    setVol(v); setOneTime(ot); setAnnual(an); setSubst(s); setPresetName("Custom (from assistant)"); setUnit("Annual");
    if (firstName) setUserName(firstName); if (bank) setBankName(bank);
    setSimple(true); setStage("result");
  }
  const setVolRail = (r, v) => setVol({ ...vol, [r]: v });
  const mig = subst.Wire ?? 30;
  const setMig = (v) => setSubst({ Check: v, Wire: v, "Same-Day ACH": v, ACH: 0 });

  // ---- saved scenarios ("versions") ----
  const [scenarios, setScenarios] = useState(() => loadScenarios());
  function saveScenario(name) {
    const r = runBottomUp(vol, costs, subst, oneTime, annual, disc, horizon, overrides);
    const sc = makeScenario(name, { bankName, mig, vol: clone(vol), costs: clone(costs), subst: clone(subst), overrides: clone(overrides), oneTime, annual, disc, horizon, result: r });
    setScenarios(addScenario(sc));
    return sc;
  }
  function deleteScenario(id) { setScenarios(removeScenario(id)); }
  function loadScenario(sc) {
    setVol(clone(sc.vol)); setCosts(clone(sc.costs)); setSubst(clone(sc.subst));
    if (sc.overrides) setOverrides(clone(sc.overrides));
    setOneTime(sc.oneTime); setAnnual(sc.annual); setDisc(sc.disc); setHorizon(sc.horizon);
    if (sc.bankName) setBankName(sc.bankName);
    setSimple(false); setTab("calc");
  }
  const setComp = (rail, key, v) => { const c = clone(costs); c[rail][key] = v; setCosts(c); };
  const setOverride = (rail, v) => setOverrides({ ...overrides, [rail]: v });
  const applyToAll = (key, value) => { const c = clone(costs); RAILS.forEach((r) => { c[r][key] = value; }); setCosts(c); };

  const res = useMemo(() => runBottomUp(vol, costs, subst, oneTime, annual, disc, horizon, overrides), [vol, costs, subst, oneTime, annual, disc, horizon, overrides]);
  const implied = useMemo(() => impliedTotalCost(vol, costs, overrides), [vol, costs, overrides]);

  const savings = res.rows.map((r) => ({ name: r.rail, value: Math.round(r.ann), color: RAIL_COLOR[r.rail] })).filter((d) => d.value > 0);
  const layerData = ["Wire", "Check", "Same-Day ACH", "Instant", "ACH"].map((r) => {
    const lt = layerTotals(costs[r]);
    return { name: r, Network: +lt.network.toFixed(3), Provider: +lt.provider.toFixed(3), Internal: +lt.internal.toFixed(3) };
  });
  const topSaver = [...res.rows].sort((a, b) => b.ann - a.ann)[0];

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
    <ClientResult
      vol={vol} setVolRail={setVolRail} costs={costs} subst={subst} mig={mig} setMig={setMig} overrides={overrides}
      oneTime={oneTime} annual={annual} disc={disc} horizon={horizon}
      userName={userName} bankName={bankName}
      scenarios={scenarios} onSaveScenario={saveScenario} onDeleteScenario={deleteScenario} onLoadScenario={loadScenario}
      onAdvanced={() => setSimple(false)}
      onRestart={() => setStage("wizard")}
      onSources={() => { setSimple(false); setTab("data"); }}
      onCompare={() => { setSimple(false); setTab("compare"); }}
    />
  );

  // ---- advanced analyst view (the full toolkit) ----
  return (
    <div className="app">
      <header className="hero"><div className="wrap">
        <div className="herotop">
          <div className="brand">PAYFINIA · MONEY MOVEMENT ANALYTICS</div>
          <div className="herobtns">
            <span className="savedtag">✓ Auto-saved</span>
            <button className="guidedbtn accent" onClick={() => { setSimple(true); setStage("result"); }}>← Simple view</button>
            <button className="guidedbtn" onClick={() => { setSimple(true); setStage("wizard"); }}>↺ Guided setup</button>
            <button className="guidedbtn" onClick={resetAll}>Reset</button>
          </div>
        </div>
        <h1>Instant Payments ROI Calculator</h1>
        <p>{userName ? <>Welcome, <strong>{userName}</strong>{bankName ? <> — here's the picture for <strong>{bankName}</strong>.</> : "."} </> : null}
          What your bank saves by moving the payments it <b>sends</b> (checks &amp; wires) to instant payments.
          <strong> Costs split into network · provider · your own — every figure sourced.</strong></p>
      </div></header>

      <nav className="tabs wrap">
        <button className={tab === "assum" ? "on" : ""} onClick={() => setTab("assum")}>Cost Assumptions</button>
        <button className={tab === "td" ? "on" : ""} onClick={() => setTab("td")}>Use My Financials</button>
        <button className={tab === "calc" ? "on" : ""} onClick={() => setTab("calc")}>Savings Calculator</button>
        <button className={tab === "why" ? "on" : ""} onClick={() => setTab("why")}>Why Migrate</button>
        <button className={tab === "compare" ? "on" : ""} onClick={() => setTab("compare")}>Compare Versions{scenarios.length ? ` (${scenarios.length})` : ""}</button>
        <button className={tab === "data" ? "on" : ""} onClick={() => setTab("data")}>Rail Data &amp; Sources</button>
      </nav>

      <main className="wrap">
        {/* ============ CALCULATOR ============ */}
        {tab === "calc" && (
          <>
            <div className="assistcta">
              <span>👋 New here? Let the <b>Savings Assistant</b> ask a few questions and fill this in.</span>
              <span className="arrow">💬 button, bottom-right →</span>
            </div>

            <details className="method">
              <summary>How the math works — read this once and every number below makes sense</summary>
              <div className="methodbody">
                <div className="mcol">
                  <h4>1 · What each payment really costs you</h4>
                  <p>Every rail has a fully-loaded cost per transaction, split into three layers: the <b>network fee</b>
                    (published by the Fed/TCH — exact), the <b>provider fee</b> (what Payfinia charges), and <b>your own
                    internal cost</b> (staff, failures, fraud, compliance). Defaults are public benchmarks; edit any of them
                    on the Cost Assumptions tab.</p>
                </div>
                <div className="mcol">
                  <h4>2 · How savings are computed</h4>
                  <p>For each rail you send: <b>savings = (your cost − instant cost) × payments shifted</b>. We only count
                    <b> outbound</b> payments (you can't control what others send you), and only the share you choose to
                    shift. Net benefit subtracts your annual platform cost; ROI and payback compare against the one-time
                    setup cost.</p>
                </div>
                <div className="mcol">
                  <h4>3 · Where the numbers come from</h4>
                  <p>Volumes, fees and fraud figures trace to the <a href="https://www.frbservices.org/resources/financial-services/fednow/volume-value-stats" target="_blank" rel="noreferrer">Federal Reserve</a>,{" "}
                    <a href="https://www.nacha.org/content/ach-network-volume-and-value-statistics" target="_blank" rel="noreferrer">Nacha</a>,{" "}
                    <a href="https://www.theclearinghouse.org/payment-systems/rtp" target="_blank" rel="noreferrer">The Clearing House</a> and the AFP Fraud Survey —
                    every line on the Rail Data tab has a verify link. Anything not directly citable is labelled <b>Estimate</b>.</p>
                </div>
                <div className="mcol">
                  <h4>4 · Trust check</h4>
                  <p>The <b>Sanity check</b> card shows the total your inputs imply you spend on payments today — compare it
                    with the ops line on your NCUA/FDIC call report. If it's in the ballpark, the estimate is grounded in
                    your reality, not ours.</p>
                </div>
              </div>
            </details>
            <div className="grid">
              <section className="card inputs">
                <h2>1 · Your bank</h2>
                <label className="fld"><span>Start from an example</span>
                  <select value={presetName} onChange={(e) => applyPreset(e.target.value)}>
                    {Object.keys(PRESETS).map((k) => <option key={k}>{k}</option>)}
                    {presetName === "Custom (from assistant)" && <option>Custom (from assistant)</option>}
                  </select></label>

                <div className="unitrow">
                  <span>Enter volumes as:</span>
                  <div className="toggle small">
                    {["Annual", "Monthly"].map((u) => <button key={u} className={unit === u ? "on" : ""} onClick={() => setUnit(u)}>{u}</button>)}
                  </div>
                </div>
                {["Check", "Wire", "Same-Day ACH", "ACH"].map((r) => (
                  <label className="fld" key={r}>
                    <span>{r === "ACH" ? "Standard ACH" : r}s you send ({unit.toLowerCase()})</span>
                    <NumberInput value={disp(r)} onChange={(v) => setDisp(r, v)} />
                  </label>
                ))}
                <p className="hint">These are <b>outbound</b> payments you originate — the only ones you control. What comes IN (deposits, incoming wires) is set by the sender, so it's not modeled.</p>

                <label className="fld"><span>One-time setup cost ($)</span><NumberInput value={oneTime} onChange={setOneTime} /></label>
                <label className="fld"><span>Annual platform cost ($/yr)</span><NumberInput value={annual} onChange={setAnnual} /></label>

                <h2>2 · How much you shift to instant</h2>
                {LEGACY.map((r) => (
                  <label className="fld slider" key={r}>
                    <span>{r} you send instantly instead: <b>{subst[r]}%</b></span>
                    <input type="range" min="0" max="100" value={subst[r]} onChange={(e) => setSubst({ ...subst, [r]: +e.target.value })} />
                  </label>
                ))}
                <p className="hint">Destination: <b>Instant Payments (FedNow / RTP)</b>. This is "ACH-shrinking": a share of your outbound file goes instant instead. Bounds: <a href={SUBST_SRC.url} target="_blank" rel="noreferrer">{SUBST_SRC.publisher}</a>.</p>
                <div className="two">
                  <label className="fld slider"><span>Discount rate: <b>{disc}%</b></span><input type="range" min="0" max="20" value={disc} onChange={(e) => setDisc(+e.target.value)} /></label>
                  <label className="fld slider"><span>Horizon: <b>{horizon} yr</b></span><input type="range" min="1" max="10" value={horizon} onChange={(e) => setHorizon(+e.target.value)} /></label>
                </div>
              </section>

              <section className="results">
                <div className={res.net > 0 ? "savehero" : "savehero neg"}>
                  <div className="lbl">Estimated savings from moving outbound volume to instant</div>
                  <div className="big">{res.net > 0 ? money(res.net) : "—"}<span> / year</span></div>
                  {res.net > 0 && <div className="subrow">
                    <span>≈ <b>{money(res.net / 12)}</b>/month</span>
                    <span>Pays back in <b>{res.payback === Infinity ? "—" : res.payback.toFixed(1)} months</b></span>
                    <span>5-year value <b>{money(res.npv)}</b></span>
                  </div>}
                </div>
                <div className={res.net > 0 ? "note" : "note warn"}>
                  {res.net > 0
                    ? <>Instant costs about <b>{money2(res.instant)}</b> per transaction all-in. Biggest win: <b>{topSaver.rail}</b> ({money(topSaver.ann)}/yr). Checks and wires drive it; standard ACH is already cheaper than instant.</>
                    : <>⚠️ At these numbers the migration doesn't pay back yet. Increase outbound check/wire volume or the % shifted, or lower setup cost.</>}
                </div>

                <div className="metrics3">
                  <div className="metric"><span>Year-1 ROI</span><b>{Math.round(res.roi * 100)}%</b></div>
                  <div className="metric"><span>Gross savings</span><b>{money(res.gross)}</b></div>
                  <div className="metric"><span>Annual platform cost</span><b>{money(annual)}</b></div>
                </div>

                <div className="card chart">
                  <h3>Cost per transaction — by layer (network · provider · your own)</h3>
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
                  <h3>Where your savings come from (per year)</h3>
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
                  <h3>Sanity check</h3>
                  <p>Your inputs imply it costs about <b>{money(implied)}/year</b> to support your current outbound checks, wires &amp; ACH.
                    Compare that to your books (payment-operations line on your <a href={GROUNDING_SRC.url} target="_blank" rel="noreferrer">NCUA/FDIC call report</a>). If it's in the ballpark, your assumptions are sound; if not, adjust the cost inputs on the Assumptions tab.</p>
                </div>

                <div className="card">
                  <h3>Detail by rail</h3>
                  <table className="tbl">
                    <thead><tr><th>Rail</th><th>Your cost $/txn</th><th>Save $/txn</th><th>Sent instantly</th><th>Savings / yr</th></tr></thead>
                    <tbody>
                      {res.rows.map((r) => (
                        <tr key={r.rail}><td>{r.rail}</td><td>{money2(r.legacy)}</td>
                          <td className={r.per < 0 ? "neg" : ""}>{money2(r.per)}</td><td>{num(r.migrated)}</td><td>{money(r.ann)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        )}

        {/* ============ USE MY FINANCIALS (top-down) ============ */}
        {tab === "td" && (
          <div className="grid">
            <section className="card inputs">
              <h2>Enter what you already know</h2>
              <p className="hint">Most banks don't know their per-check cost — but they know their totals. Enter aggregate numbers from your books; we allocate them across rails using our researched weights.</p>
              <label className="fld"><span>Total labor to support payments ($/yr)</span><NumberInput value={tdLabor} onChange={setTdLabor} /></label>
              <label className="fld"><span>Total fraud losses ($/yr)</span><NumberInput value={tdFraud} onChange={setTdFraud} /></label>
              <h2>Payments per year, by rail</h2>
              {RAILS.map((r) => (
                <label className="fld" key={r}><span>{r === "ACH" ? "Standard ACH" : r}</span>
                  <NumberInput value={tdCount[r]} onChange={(v) => setTdCount({ ...tdCount, [r]: v })} /></label>
              ))}

              <h2>Network fee per item ($) — enter your own</h2>
              <p className="hint">Pre-filled with published rail fees (FedNow/RTP $0.045, Fedwire ~$0.78). Overwrite each with the exact fee your processor charges — these feed the calculation directly.</p>
              {RAILS.map((r) => (
                <label className="fld" key={r}><span>{r === "ACH" ? "Standard ACH" : r} network fee ($/item)</span>
                  <input type="number" step="0.001" value={tdNet[r]} onChange={(e) => setTdNet({ ...tdNet, [r]: +e.target.value })} /></label>
              ))}
              <p className="hint">Example pre-loaded from Payfinia's illustration ($10M labor, $500k fraud; 40M ACH, 100k wires, 1M checks).</p>
            </section>
            <section className="results">
              <div className="savehero">
                <div className="lbl">Total cost to support payments (from your totals)</div>
                <div className="big">{money(td.grand)}</div>
                <div className="subrow"><span>Labor <b>{money(tdLabor)}</b></span><span>Network <b>{money(td.totNet)}</b></span><span>Fraud <b>{money(tdFraud)}</b></span></div>
              </div>
              <div className="note">We work the left side of the equation: network fees are exact (rate × count); your total labor and fraud are split across rails by each rail's researched intensity × volume — a wire carries far more labor per item than an ACH, but every piece sums back to your real totals.</div>
              <div className="card">
                <h3>Cost breakdown by rail</h3>
                <table className="tbl">
                  <thead><tr><th>Rail</th><th>Count</th><th>Labor</th><th>Network</th><th>Fraud</th><th>Total</th><th>$/txn</th></tr></thead>
                  <tbody>
                    {td.rows.filter((r) => r.count > 0).map((r) => (
                      <tr key={r.rail}><td className="rl">{r.rail}</td><td>{num(r.count)}</td><td>{money(r.labor)}</td>
                        <td>{money(r.network)}</td><td>{money(r.fraud)}</td><td><b>{money(r.totalCost)}</b></td><td>{money2(r.perTxn)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="fine">The "$/txn" here is your OWN cost per transaction — derived from your real totals, not our assumptions.</p>
              </div>
            </section>
          </div>
        )}

        {/* ============ RAIL DATA ============ */}
        {tab === "data" && (
          <div className="datawrap">
            <p className="lead">Real figures for each rail — every statistic states the number, the year, and links to the publisher.</p>
            {RAILS.map((rail) => (
              <div className="card railcard" key={rail}>
                <h3><span className="dot" style={{ background: RAIL_COLOR[rail] }} />{rail === "Instant" ? "Instant Payments (FedNow & RTP)" : rail}
                  {rail === "Instant" && <span className="badge">migration target</span>}</h3>
                <table className="tbl">
                  <thead><tr><th>Metric</th><th>Value / figure</th><th>As of</th><th>Publisher</th><th></th></tr></thead>
                  <tbody>{RAIL_FACTS[rail].map(([m, v, y, p, url], i) => (
                    <tr key={i}><td>{m}</td><td>{v}</td><td>{y}</td><td>{p}</td><td><a href={url} target="_blank" rel="noreferrer">verify ↗</a></td></tr>))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* ============ WHY MIGRATE ============ */}
        {tab === "why" && (
          <div className="datawrap">
            <p className="lead">The case for moving each rail to instant — pulled live from your cost assumptions, so it stays honest if you edit them. Standard ACH is intentionally flagged “keep,” because it's already cheaper than instant.</p>
            <WhyMigrate costs={costs} />
          </div>
        )}

        {/* ============ COMPARE VERSIONS ============ */}
        {tab === "compare" && <Compare scenarios={scenarios} onLoad={loadScenario} onDelete={deleteScenario} />}

        {/* ============ COST ASSUMPTIONS (3 layers + mini-calcs) ============ */}
        {tab === "assum" && <Assumptions costs={costs} setComp={setComp} vol={vol} overrides={overrides} setOverride={setOverride} applyToAll={applyToAll} />}
      </main>

      <footer className="wrap">
        Payfinia · USF FinTech Graduate Project · Cost = Network + Provider + FI internal · Migration = outbound volume you originate ·
        Figures current as of the 2025–2026 research pass · Estimate, not a guarantee.
      </footer>
      <ChatAssistant onApply={applyFromAssistant} />
    </div>
  );
}

// ---------- Cost Assumptions tab: 3-layer table + mini-calculators + sources ----------
function Assumptions({ costs, setComp, vol, overrides, setOverride, applyToAll }) {
  const [rail, setRail] = useState("Check");
  const c = costs[rail];
  const ovActive = overrides[rail] !== "" && !isNaN(+overrides[rail]);
  // mini-calc local inputs
  const [fte, setFte] = useState(2), [salary, setSalary] = useState(55000), [items, setItems] = useState(vol[rail] || 100000);
  const [failed, setFailed] = useState(1500), [perFail, setPerFail] = useState(8);
  const [fraudUsd, setFraudUsd] = useState(50000), [fItems, setFItems] = useState(vol[rail] || 100000);
  const [fpUsd, setFpUsd] = useState(12000), [fpItems, setFpItems] = useState(vol[rail] || 100000);
  const [amlUsd, setAmlUsd] = useState(15000), [amlItems, setAmlItems] = useState(vol[rail] || 100000);
  const [recFte, setRecFte] = useState(1), [recSalary, setRecSalary] = useState(55000), [recItems, setRecItems] = useState(vol[rail] || 100000);
  const [liqBal, setLiqBal] = useState(500000), [liqRate, setLiqRate] = useState(4), [liqItems, setLiqItems] = useState(vol[rail] || 100000);

  const procPer = items > 0 ? (fte * salary) / items : 0;
  const failRate = fItemsSafe(items) > 0 ? failed / items : 0;
  const fraudPer = fItems > 0 ? fraudUsd / fItems : 0;
  const fpPer = fpItems > 0 ? fpUsd / fpItems : 0;
  const amlPer = amlItems > 0 ? amlUsd / amlItems : 0;
  const recPer = recItems > 0 ? (recFte * recSalary) / recItems : 0;
  const liqPer = liqItems > 0 ? (liqBal * (liqRate / 100)) / liqItems : 0;

  const layers = layerTotals(c);
  return (
    <div className="datawrap">
      <details className="method">
        <summary>How to use this tab — read once</summary>
        <div className="methodbody">
          <div className="mcol"><h4>1 · Pick a rail</h4><p>Choose a payment type up top. Its cost per transaction shows split into <b>Network</b>, <b>Provider</b> (Instant only — Payfinia doesn't charge on your legacy rails) and your <b>Internal</b> cost.</p></div>
          <div className="mcol"><h4>2 · Build from what you know</h4><p>Use the <b>Cost Builder</b> on the left to turn figures you have (staff × salary, fraud $, failed items) into a per-item cost, then hit <b>Apply</b>. All values are <b>$ per transaction</b> unless marked “rate.”</p></div>
          <div className="mcol"><h4>3 · Apply to all rails</h4><p>The <b>⇊ all</b> button next to any value copies it to every rail at once — handy for a fee that's identical everywhere, so you don't retype it five times.</p></div>
          <div className="mcol"><h4>4 · Or override the total</h4><p>If you already know your true all-in cost for a rail, type it into <b>Override total</b> at the bottom of the stack — the calculator uses that number and every result updates automatically.</p></div>
        </div>
      </details>
      <p className="lead">Cost per transaction, split into <b>3 layers</b>: the <b style={{ color: L1 }}>network</b> charges, the <b style={{ color: L2 }}>provider (Payfinia, Instant only)</b> charge, and your <b style={{ color: L3 }}>own internal</b> cost. All values are <b>$ per transaction</b> unless marked “rate.” Build the internal numbers from figures you actually have — or override the total outright.</p>

      <div className="assumgrid">
        <div className="card assum-stack">
          <h3>Cost stack by layer — {rail}</h3>
          <label className="fld"><span>Choose a rail</span>
            <select value={rail} onChange={(e) => setRail(e.target.value)}>{RAILS.map((r) => <option key={r}>{r}</option>)}</select></label>
          <table className="tbl small">
            <thead><tr><th>Layer</th><th>Component</th><th>Value</th></tr></thead>
            <tbody>
              {COMP_FIELDS.filter((f) => f.key !== "provider" || rail === "Instant").map((f) => (
                <tr key={f.key}>
                  <td><span className="layerpill" style={{ background: (f.layer === "Network" ? L1 : f.layer === "Provider" ? L2 : L3) + "22", color: f.layer === "Network" ? L1 : f.layer === "Provider" ? L2 : L3 }}>{f.layer}</span></td>
                  <td>{f.label}</td>
                  <td><span className="valwrap">
                    {f.kind === "$" && <span className="pfx">$</span>}
                    <input type="number" step={f.kind === "%" ? "0.001" : "0.01"} value={c[f.key]}
                      onChange={(e) => setComp(rail, f.key, +e.target.value)} style={{ width: 76 }} />
                    {f.kind === "%" && <span className="sfx">rate</span>}
                    <button className="applyall" title={`Apply this ${f.label} to all rails`} onClick={() => applyToAll(f.key, c[f.key])}>⇊ all</button>
                  </span></td>
                </tr>
              ))}
              <tr><td colSpan="2" className="rl">Layer totals →</td>
                <td className="tot">{money2(railTotal(c))}</td></tr>
            </tbody>
          </table>
          <p className="fine"><b style={{ color: L1 }}>Network</b> {money2(layers.network)} · {rail === "Instant" && <><b style={{ color: L2 }}>Provider</b> {money2(layers.provider)} · </>}<b style={{ color: L3 }}>Internal</b> {money2(layers.internal)} = <b>{money2(railTotal(c))}</b>/txn</p>

          <div className="overridebox">
            <label className="fld" style={{ marginBottom: 6 }}>
              <span>Override total $/txn for {rail} <em>(optional — use your own all-in number)</em></span>
              <span className="valwrap"><span className="pfx">$</span>
                <input type="number" step="0.01" value={overrides[rail]} placeholder={railTotal(c).toFixed(2)}
                  onChange={(e) => setOverride(rail, e.target.value)} style={{ width: 110 }} /></span>
            </label>
            {ovActive
              ? <p className="fine ovon">✓ Using your override of <b>{money2(+overrides[rail])}</b>/txn for {rail} — the stack above is ignored, and all results use this. <button type="button" className="linkbtn" onClick={() => setOverride(rail, "")}>Clear override</button></p>
              : <p className="fine">Leave blank to use the built-up stack ({money2(railTotal(c))}/txn).</p>}
          </div>
        </div>

        <div className="card assum-builder">
          <h3>Cost Builder — build the internal cost from numbers you have</h3>
          <p className="fine">You probably can't say "$2.00 per check" off the top of your head — but you know these. Compute it, then apply.</p>

          <div className="minicalc">
            <b>Processing / labor</b>
            <div className="mc-row"><label>Staff (FTE) on {rail}</label><input type="number" value={fte} onChange={(e) => setFte(+e.target.value)} /></div>
            <div className="mc-row"><label>Avg loaded salary ($/yr)</label><NumberInput value={salary} onChange={setSalary} /></div>
            <div className="mc-row"><label>{rail}s handled / yr</label><NumberInput value={items} onChange={setItems} /></div>
            <div className="mc-out">= <b>{money2(procPer)}</b> / item <button onClick={() => setComp(rail, "processing", +procPer.toFixed(3))}>Apply</button></div>
          </div>

          <div className="minicalc">
            <b>Failure / exception</b>
            <div className="mc-row"><label>Items failed / returned / yr</label><NumberInput value={failed} onChange={setFailed} /></div>
            <div className="mc-row"><label>Cost per failed item ($)</label><input type="number" value={perFail} onChange={(e) => setPerFail(+e.target.value)} /></div>
            <div className="mc-out">rate = <b>{(failRate * 100).toFixed(2)}%</b> <button onClick={() => { setComp(rail, "failure_rate", +failRate.toFixed(4)); setComp(rail, "cost_per_failure", perFail); }}>Apply</button></div>
          </div>

          <div className="minicalc">
            <b>Fraud loss</b>
            <div className="mc-row"><label>Total fraud $ on {rail} / yr</label><NumberInput value={fraudUsd} onChange={setFraudUsd} /></div>
            <div className="mc-row"><label>{rail}s / yr</label><NumberInput value={fItems} onChange={setFItems} /></div>
            <div className="mc-out">= <b>{money2(fraudPer)}</b> / item <button onClick={() => setComp(rail, "fraud_loss", +fraudPer.toFixed(3))}>Apply</button></div>
          </div>

          <div className="minicalc">
            <b>Fraud prevention (screening &amp; tools)</b>
            <div className="mc-row"><label>Fraud tools + staff ($/yr) on {rail}</label><NumberInput value={fpUsd} onChange={setFpUsd} /></div>
            <div className="mc-row"><label>{rail}s / yr</label><NumberInput value={fpItems} onChange={setFpItems} /></div>
            <div className="mc-out">= <b>{money2(fpPer)}</b> / item <button onClick={() => setComp(rail, "fraud_prevention", +fpPer.toFixed(3))}>Apply</button></div>
          </div>

          <div className="minicalc">
            <b>Compliance (AML / BSA)</b>
            <div className="mc-row"><label>AML/BSA &amp; OFAC cost ($/yr) on {rail}</label><NumberInput value={amlUsd} onChange={setAmlUsd} /></div>
            <div className="mc-row"><label>{rail}s / yr</label><NumberInput value={amlItems} onChange={setAmlItems} /></div>
            <div className="mc-out">= <b>{money2(amlPer)}</b> / item <button onClick={() => setComp(rail, "compliance", +amlPer.toFixed(3))}>Apply</button></div>
          </div>

          <div className="minicalc">
            <b>Reconciliation</b>
            <div className="mc-row"><label>Recon staff (FTE) on {rail}</label><input type="number" value={recFte} onChange={(e) => setRecFte(+e.target.value)} /></div>
            <div className="mc-row"><label>Avg loaded salary ($/yr)</label><NumberInput value={recSalary} onChange={setRecSalary} /></div>
            <div className="mc-row"><label>{rail}s / yr</label><NumberInput value={recItems} onChange={setRecItems} /></div>
            <div className="mc-out">= <b>{money2(recPer)}</b> / item <button onClick={() => setComp(rail, "reconciliation", +recPer.toFixed(3))}>Apply</button></div>
          </div>

          <div className="minicalc">
            <b>Liquidity / prefunding</b>
            <div className="mc-row"><label>Avg prefunded balance ($)</label><NumberInput value={liqBal} onChange={setLiqBal} /></div>
            <div className="mc-row"><label>Cost of funds (% / yr)</label><input type="number" step="0.1" value={liqRate} onChange={(e) => setLiqRate(+e.target.value)} /></div>
            <div className="mc-row"><label>{rail}s / yr</label><NumberInput value={liqItems} onChange={setLiqItems} /></div>
            <div className="mc-out">= <b>{money2(liqPer)}</b> / item <button onClick={() => setComp(rail, "liquidity", +liqPer.toFixed(4))}>Apply</button></div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Sources for each cost line</h3>
        <table className="tbl">
          <thead><tr><th>Layer</th><th>Cost line</th><th>Supports / how to get it</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {Object.entries(SRC).map(([k, v]) => (
              <tr key={k}><td><span className="layerpill" style={{ background: (v.layer === "Network" ? L1 : v.layer === "Provider" ? L2 : L3) + "22", color: v.layer === "Network" ? L1 : v.layer === "Provider" ? L2 : L3 }}>{v.layer}</span></td>
                <td>{k}</td><td>{v.supports}</td><td><StatusTag status={v.status} /></td><td><a href={v.url} target="_blank" rel="noreferrer">open ↗</a></td></tr>
            ))}
          </tbody>
        </table>
        <p className="fine">Default internal costs are grounded in <a href={GROUNDING_SRC.url} target="_blank" rel="noreferrer">{GROUNDING_SRC.publisher}</a> — replace with your own via the Cost Builder above.</p>
      </div>
    </div>
  );
}
function fItemsSafe(x) { return x; }
