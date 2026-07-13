import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList, Tooltip, Legend } from "recharts";
import {
  RAILS, LEGACY, DEFAULTS, COMP_FIELDS, SUBST_DEFAULT, PRESETS, SRC, SUBST_SRC,
  GROUNDING_SRC, RAIL_FACTS, RAIL_COLOR, U, railTotal, layerTotals, runBottomUp, impliedTotalCost,
} from "./data.js";
import ChatAssistant from "./ChatAssistant.jsx";

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

export default function App() {
  const [tab, setTab] = useState("calc");
  const [unit, setUnit] = useState("Annual");           // Annual | Monthly
  const [presetName, setPresetName] = useState("Mid CFI (~$1B)");
  const p0 = PRESETS["Mid CFI (~$1B)"];
  const [vol, setVol] = useState({ Check: p0.Check, Wire: p0.Wire, "Same-Day ACH": p0["Same-Day ACH"], ACH: p0.ACH });  // ANNUAL, outbound
  const [oneTime, setOneTime] = useState(p0.oneTime);
  const [annual, setAnnual] = useState(p0.annual);
  const [subst, setSubst] = useState({ ...SUBST_DEFAULT });
  const [disc, setDisc] = useState(10);
  const [horizon, setHorizon] = useState(5);
  const [costs, setCosts] = useState(() => clone(DEFAULTS));

  // top-down state (Justin's example)
  const [tdLabor, setTdLabor] = useState(10000000);
  const [tdFraud, setTdFraud] = useState(500000);
  const [tdCount, setTdCount] = useState({ Check: 1000000, Wire: 100000, "Same-Day ACH": 0, ACH: 40000000, Instant: 0 });

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
  const setComp = (rail, key, v) => { const c = clone(costs); c[rail][key] = v; setCosts(c); };

  const res = useMemo(() => runBottomUp(vol, costs, subst, oneTime, annual, disc, horizon), [vol, costs, subst, oneTime, annual, disc, horizon]);
  const implied = useMemo(() => impliedTotalCost(vol, costs), [vol, costs]);

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
      const network = DEFAULTS[r].network * c; totNet += network;
      const totalCost = labor + network + fraud;
      return { rail: r, count: c, labor, network, fraud, totalCost, perTxn: c > 0 ? totalCost / c : 0 };
    });
    return { rows, grand: tdLabor + totNet + tdFraud, totNet };
  }, [tdLabor, tdFraud, tdCount]);

  return (
    <div className="app">
      <header className="hero"><div className="wrap">
        <div className="brand">PAYFINIA · MONEY MOVEMENT ANALYTICS</div>
        <h1>Instant Payments ROI Calculator</h1>
        <p>What your bank saves by moving the payments it <b>sends</b> (checks &amp; wires) to instant payments.
          <strong> Costs split into network · provider · your own — every figure sourced.</strong></p>
      </div></header>

      <nav className="tabs wrap">
        <button className={tab === "calc" ? "on" : ""} onClick={() => setTab("calc")}>Savings Calculator</button>
        <button className={tab === "td" ? "on" : ""} onClick={() => setTab("td")}>Use My Financials</button>
        <button className={tab === "data" ? "on" : ""} onClick={() => setTab("data")}>Rail Data &amp; Sources</button>
        <button className={tab === "assum" ? "on" : ""} onClick={() => setTab("assum")}>Cost Assumptions</button>
      </nav>

      <main className="wrap">
        {/* ============ CALCULATOR ============ */}
        {tab === "calc" && (
          <>
            <div className="assistcta">
              <span>👋 New here? Let the <b>Savings Assistant</b> ask a few questions and fill this in.</span>
              <span className="arrow">💬 button, bottom-right →</span>
            </div>
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

        {/* ============ COST ASSUMPTIONS (3 layers + mini-calcs) ============ */}
        {tab === "assum" && <Assumptions costs={costs} setComp={setComp} vol={vol} />}
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
function Assumptions({ costs, setComp, vol }) {
  const [rail, setRail] = useState("Check");
  const c = costs[rail];
  // mini-calc local inputs
  const [fte, setFte] = useState(2), [salary, setSalary] = useState(55000), [items, setItems] = useState(vol[rail] || 100000);
  const [failed, setFailed] = useState(1500), [perFail, setPerFail] = useState(8);
  const [fraudUsd, setFraudUsd] = useState(50000), [fItems, setFItems] = useState(vol[rail] || 100000);

  const procPer = items > 0 ? (fte * salary) / items : 0;
  const failRate = fItemsSafe(items) > 0 ? failed / items : 0;
  const fraudPer = fItems > 0 ? fraudUsd / fItems : 0;

  const layers = layerTotals(c);
  return (
    <div className="datawrap">
      <p className="lead">Cost per transaction, split into <b>3 layers</b>: the <b style={{ color: L1 }}>network</b> charges, the <b style={{ color: L2 }}>provider (Payfinia)</b> charges, and your <b style={{ color: L3 }}>own internal</b> cost. Build the internal numbers from figures you actually have.</p>

      <div className="assumgrid">
        <div className="card">
          <h3>Cost stack by layer — {rail}</h3>
          <label className="fld"><span>Choose a rail</span>
            <select value={rail} onChange={(e) => setRail(e.target.value)}>{RAILS.map((r) => <option key={r}>{r}</option>)}</select></label>
          <table className="tbl small">
            <thead><tr><th>Layer</th><th>Component</th><th>Value</th></tr></thead>
            <tbody>
              {COMP_FIELDS.map((f) => (
                <tr key={f.key}>
                  <td><span className="layerpill" style={{ background: (f.layer === "Network" ? L1 : f.layer === "Provider" ? L2 : L3) + "22", color: f.layer === "Network" ? L1 : f.layer === "Provider" ? L2 : L3 }}>{f.layer}</span></td>
                  <td>{f.label}</td>
                  <td><input type="number" step={f.kind === "%" ? "0.001" : "0.01"} value={c[f.key]}
                    onChange={(e) => setComp(rail, f.key, +e.target.value)} style={{ width: 80 }} /></td>
                </tr>
              ))}
              <tr><td colSpan="2" className="rl">Layer totals →</td>
                <td className="tot">{money2(railTotal(c))}</td></tr>
            </tbody>
          </table>
          <p className="fine"><b style={{ color: L1 }}>Network</b> {money2(layers.network)} · <b style={{ color: L2 }}>Provider</b> {money2(layers.provider)} · <b style={{ color: L3 }}>Internal</b> {money2(layers.internal)} = <b>{money2(railTotal(c))}</b>/txn</p>
        </div>

        <div className="card">
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
