import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList, Tooltip } from "recharts";
import {
  COMPONENTS, RAILS, LEGACY, DEFAULTS, SUBST_DEFAULT, PRESETS,
  SRC, SUBST_SRC, RAIL_FACTS, RAIL_COLOR, U,
} from "./data.js";

const money = (x) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x);
const money2 = (x) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(x);
const money3 = (x) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 3 }).format(x);
const num = (x) => new Intl.NumberFormat("en-US").format(Math.round(x));

const total = (c) => c[0] + c[1] + c[2] * c[3] + c[4] + c[5] + c[6] + c[7] + c[8];

function StatusTag({ status }) {
  const cls = status === "Cited" ? "tag cited" : status === "Estimate" ? "tag est" : "tag partly";
  return <span className={cls}>{status}</span>;
}

export default function App() {
  const [tab, setTab] = useState("calc");

  // ---------- bottom-up state ----------
  const [presetName, setPresetName] = useState("Mid CFI (~$1B)");
  const p0 = PRESETS["Mid CFI (~$1B)"];
  const [vol, setVol] = useState({ Check: p0.Check, Wire: p0.Wire, "Same-Day ACH": p0["Same-Day ACH"], ACH: p0.ACH });
  const [oneTime, setOneTime] = useState(p0.oneTime);
  const [annual, setAnnual] = useState(p0.annual);
  const [dest, setDest] = useState("FedNow");
  const [subst, setSubst] = useState({ ...SUBST_DEFAULT });
  const [disc, setDisc] = useState(10);
  const [horizon, setHorizon] = useState(5);
  const [costs, setCosts] = useState(() => JSON.parse(JSON.stringify(DEFAULTS)));

  // ---------- top-down state (defaults = Justin's example) ----------
  const [tdLabor, setTdLabor] = useState(10000000);
  const [tdFraud, setTdFraud] = useState(500000);
  const [tdCount, setTdCount] = useState({ Check: 1000000, Wire: 100000, "Same-Day ACH": 0, ACH: 40000000, FedNow: 0, RTP: 0 });

  function applyPreset(name) {
    setPresetName(name);
    const p = PRESETS[name];
    setVol({ Check: p.Check, Wire: p.Wire, "Same-Day ACH": p["Same-Day ACH"], ACH: p.ACH });
    setOneTime(p.oneTime); setAnnual(p.annual);
  }

  // ---------- bottom-up compute ----------
  const res = useMemo(() => {
    const instant = total(costs[dest]);
    let gross = 0;
    const rows = LEGACY.map((rail) => {
      const legacy = total(costs[rail]);
      const per = legacy - instant;
      const migrated = vol[rail] * (subst[rail] / 100);
      const ann = migrated * per;
      gross += ann;
      return { rail, legacy, per, migrated, ann };
    });
    const net = gross - annual;
    const roi = oneTime ? net / oneTime : 0;
    const payback = net > 0 ? (oneTime / net) * 12 : Infinity;
    const af = (1 - Math.pow(1 + disc / 100, -horizon)) / (disc / 100);
    const npv = net * af - oneTime;
    return { instant, gross, net, roi, payback, npv, rows };
  }, [costs, dest, vol, subst, annual, oneTime, disc, horizon]);

  // ---------- top-down compute (allocate real totals across rails) ----------
  const td = useMemo(() => {
    const laborW = {}, fraudW = {}, netFee = {};
    RAILS.forEach((r) => { laborW[r] = DEFAULTS[r][1]; fraudW[r] = DEFAULTS[r][4]; netFee[r] = DEFAULTS[r][0]; });
    let sumL = 0, sumF = 0;
    RAILS.forEach((r) => { sumL += laborW[r] * tdCount[r]; sumF += fraudW[r] * tdCount[r]; });
    let totNet = 0;
    const rows = RAILS.map((r) => {
      const c = tdCount[r];
      const labor = sumL > 0 ? tdLabor * (laborW[r] * c) / sumL : 0;
      const fraud = sumF > 0 ? tdFraud * (fraudW[r] * c) / sumF : 0;
      const network = netFee[r] * c;
      totNet += network;
      const totalCost = labor + network + fraud;
      const perTxn = c > 0 ? totalCost / c : 0;
      return { rail: r, count: c, labor, network, fraud, totalCost, perTxn };
    });
    const grand = tdLabor + totNet + tdFraud;
    return { rows, grand, totNet };
  }, [tdLabor, tdFraud, tdCount]);

  const savingsData = res.rows.map((r) => ({ name: r.rail, value: Math.round(r.ann), color: RAIL_COLOR[r.rail] }));
  const costOrder = ["Wire", "Check", "Same-Day ACH", "FedNow", "RTP", "ACH"];
  const costData = costOrder.map((r) => ({ name: r, value: +total(costs[r]).toFixed(2), color: RAIL_COLOR[r] }));
  const tdChart = td.rows.filter((r) => r.count > 0).map((r) => ({ name: r.rail, value: Math.round(r.totalCost), color: RAIL_COLOR[r.rail] }));

  return (
    <div className="app">
      <header className="hero">
        <div className="wrap">
          <div className="brand">PAYFINIA · MONEY MOVEMENT ANALYTICS</div>
          <h1>Migration ROI Calculator</h1>
          <p>See what a community bank spends on payments and saves by moving to instant rails —
            <strong> two ways to model it, FedNow &amp; RTP separate, every number sourced.</strong></p>
        </div>
      </header>

      <nav className="tabs wrap">
        <button className={tab === "calc" ? "on" : ""} onClick={() => setTab("calc")}>🧮 Bottom-Up ROI</button>
        <button className={tab === "td" ? "on" : ""} onClick={() => setTab("td")}>🔻 Top-Down Cost</button>
        <button className={tab === "data" ? "on" : ""} onClick={() => setTab("data")}>📊 Rail Data &amp; Sources</button>
        <button className={tab === "assum" ? "on" : ""} onClick={() => setTab("assum")}>⚙️ Cost Assumptions</button>
      </nav>

      <main className="wrap">
        {/* ================= BOTTOM-UP ================= */}
        {tab === "calc" && (
          <div className="grid">
            <section className="card inputs">
              <h2>1 · The bank</h2>
              <label className="fld">
                <span>Start from an example</span>
                <select value={presetName} onChange={(e) => applyPreset(e.target.value)}>
                  {Object.keys(PRESETS).map((k) => <option key={k}>{k}</option>)}
                </select>
              </label>
              {["Check", "Wire", "Same-Day ACH", "ACH"].map((r) => (
                <label className="fld" key={r}>
                  <span>{r === "ACH" ? "Standard ACH" : r}s / year</span>
                  <input type="number" min="0" value={vol[r]} onChange={(e) => setVol({ ...vol, [r]: +e.target.value })} />
                </label>
              ))}
              <label className="fld"><span>One-time implementation ($)</span>
                <input type="number" min="0" value={oneTime} onChange={(e) => setOneTime(+e.target.value)} /></label>
              <label className="fld"><span>Annual fixed cost ($/yr)</span>
                <input type="number" min="0" value={annual} onChange={(e) => setAnnual(+e.target.value)} /></label>

              <h2>2 · Migrate to</h2>
              <div className="toggle">
                {["FedNow", "RTP"].map((d) => <button key={d} className={dest === d ? "on" : ""} onClick={() => setDest(d)}>{d}</button>)}
              </div>
              <p className="hint">FedNow (Federal Reserve) and RTP (The Clearing House) — two separate U.S. instant rails. See the Rail Data tab.</p>

              <h2>3 · Migration assumptions</h2>
              {LEGACY.map((r) => (
                <label className="fld slider" key={r}>
                  <span>{r} that migrate: <b>{subst[r]}%</b></span>
                  <input type="range" min="0" max="100" value={subst[r]} onChange={(e) => setSubst({ ...subst, [r]: +e.target.value })} />
                </label>
              ))}
              <p className="hint">Bounds source: <a href={SUBST_SRC.url} target="_blank" rel="noreferrer">{SUBST_SRC.publisher}</a> ({SUBST_SRC.asOf})</p>
              <div className="two">
                <label className="fld slider"><span>Discount rate: <b>{disc}%</b></span>
                  <input type="range" min="0" max="20" value={disc} onChange={(e) => setDisc(+e.target.value)} /></label>
                <label className="fld slider"><span>Horizon: <b>{horizon} yr</b></span>
                  <input type="range" min="1" max="10" value={horizon} onChange={(e) => setHorizon(+e.target.value)} /></label>
              </div>
            </section>

            <section className="results">
              <div className="metrics">
                <div className="metric"><span>Net annual benefit</span><b>{money(res.net)}</b></div>
                <div className="metric"><span>Year-1 ROI</span><b>{Math.round(res.roi * 100)}%</b></div>
                <div className="metric"><span>Payback</span><b>{res.payback === Infinity ? "—" : res.payback.toFixed(1) + " mo"}</b></div>
                <div className="metric"><span>5-year NPV</span><b>{money(res.npv)}</b></div>
              </div>
              <div className={res.net > 0 ? "note" : "note warn"}>
                {res.net > 0
                  ? <>💡 {dest} costs <b>{money2(res.instant)}</b>/txn all-in. Savings come from displacing checks ({money2(total(costs.Check))}) and wires ({money2(total(costs.Wire))}). Standard ACH is already cheaper than instant, so migrating it does not help.</>
                  : <>⚠️ At these inputs the migration does not pay back. Increase check/wire volume or migration share, or lower the one-time cost.</>}
              </div>
              <div className="card chart">
                <h3>Annual savings by rail</h3>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={savingsData} layout="vertical" margin={{ left: 8, right: 70, top: 4, bottom: 4 }}>
                    <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => money(v)} />
                    <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                      {savingsData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      <LabelList dataKey="value" position="right" formatter={(v) => money(v)} style={{ fontSize: 12, fill: "#1F3864", fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card chart">
                <h3>Fully-loaded cost per transaction</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={costData} layout="vertical" margin={{ left: 8, right: 60, top: 4, bottom: 4 }}>
                    <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => money2(v)} />
                    <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                      {costData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      <LabelList dataKey="value" position="right" formatter={(v) => money2(v)} style={{ fontSize: 12, fill: "#1F3864", fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <h3>Per-rail savings detail</h3>
                <table className="tbl">
                  <thead><tr><th>Rail</th><th>Legacy $/txn</th><th>Save $/txn</th><th>Migrated txns</th><th>Annual savings</th></tr></thead>
                  <tbody>
                    {res.rows.map((r) => (
                      <tr key={r.rail}><td>{r.rail}</td><td>{money2(r.legacy)}</td>
                        <td className={r.per < 0 ? "neg" : ""}>{money2(r.per)}</td><td>{num(r.migrated)}</td><td>{money(r.ann)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="fine">Gross {money(res.gross)} − annual fixed {money(annual)} = net {money(res.net)}. Analytical estimate, not a guarantee.</p>
              </div>
            </section>
          </div>
        )}

        {/* ================= TOP-DOWN ================= */}
        {tab === "td" && (
          <div className="grid">
            <section className="card inputs">
              <h2>What you already know</h2>
              <p className="hint">Enter the totals from your books. We allocate them across rails using our researched cost weights, so you see the real cost to support each rail — calibrated to your actual spend.</p>
              <label className="fld"><span>Total labor to support all payments ($/yr)</span>
                <input type="number" min="0" step="100000" value={tdLabor} onChange={(e) => setTdLabor(+e.target.value)} /></label>
              <label className="fld"><span>Total fraud losses ($/yr)</span>
                <input type="number" min="0" step="10000" value={tdFraud} onChange={(e) => setTdFraud(+e.target.value)} /></label>
              <h2>Transactions per year, by rail</h2>
              {RAILS.map((r) => (
                <label className="fld" key={r}>
                  <span>{r === "ACH" ? "Standard ACH" : r}</span>
                  <input type="number" min="0" value={tdCount[r]} onChange={(e) => setTdCount({ ...tdCount, [r]: +e.target.value })} />
                </label>
              ))}
              <p className="hint">Leave a rail at 0 if you don't use it. Example pre-loaded from Payfinia's illustration ($10M labor, $500k fraud; 40M ACH, 100k wires, 1M checks).</p>
            </section>

            <section className="results">
              <div className="metrics">
                <div className="metric"><span>Total cost to support payments</span><b>{money(td.grand)}</b></div>
                <div className="metric"><span>Labor (your input)</span><b>{money(tdLabor)}</b></div>
                <div className="metric"><span>Network fees (computed)</span><b>{money(td.totNet)}</b></div>
                <div className="metric"><span>Fraud (your input)</span><b>{money(tdFraud)}</b></div>
              </div>
              <div className="note">🔻 <b>Top-down:</b> we work the left side of the equation. Network fees are exact (published rate × your count). Your total labor and fraud are allocated across rails by each rail's researched intensity × volume — so a wire carries far more labor per item than an ACH, but every piece sums back to your real totals.</div>

              <div className="card chart">
                <h3>Total cost to support each rail</h3>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={tdChart} layout="vertical" margin={{ left: 8, right: 80, top: 4, bottom: 4 }}>
                    <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => money(v)} />
                    <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                      {tdChart.map((d, i) => <Cell key={i} fill={d.color} />)}
                      <LabelList dataKey="value" position="right" formatter={(v) => money(v)} style={{ fontSize: 12, fill: "#1F3864", fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <h3>Cost breakdown by rail</h3>
                <table className="tbl">
                  <thead><tr><th>Rail</th><th>Count</th><th>Labor</th><th>Network</th><th>Fraud</th><th>Total cost</th><th>Implied $/txn</th></tr></thead>
                  <tbody>
                    {td.rows.filter((r) => r.count > 0).map((r) => (
                      <tr key={r.rail}>
                        <td className="rl">{r.rail}</td><td>{num(r.count)}</td><td>{money(r.labor)}</td>
                        <td>{money(r.network)}</td><td>{money(r.fraud)}</td><td><b>{money(r.totalCost)}</b></td>
                        <td>{money3(r.perTxn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="fine">The "Implied $/txn" is your own cost per transaction on each rail — derived from your real totals, not our assumptions. Use it to see which rails cost you the most, and feed it into the Bottom-Up tab for a calibrated migration ROI.</p>
              </div>

              <div className="card">
                <h3>How each total is split — and the source of the weights</h3>
                <table className="tbl">
                  <thead><tr><th>Input</th><th>How it's allocated</th><th>Source of the weight</th><th></th></tr></thead>
                  <tbody>
                    <tr><td>Labor</td><td>By each rail's relative labor-intensity × volume</td><td>Processing benchmarks (Deliverable 1)</td><td><a href={U.NACHA} target="_blank" rel="noreferrer">open ↗</a></td></tr>
                    <tr><td>Network fees</td><td>Exact: published rate × your count (not allocated)</td><td>Fed / Nacha / TCH fee schedules</td><td><a href={U.FEDNOW_FEE} target="_blank" rel="noreferrer">open ↗</a></td></tr>
                    <tr><td>Fraud</td><td>By each rail's fraud propensity × volume</td><td>AFP Payments Fraud Survey</td><td><a href={U.AFP} target="_blank" rel="noreferrer">open ↗</a></td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ================= RAIL DATA ================= */}
        {tab === "data" && (
          <div className="datawrap">
            <p className="lead">Real figures for each rail — every statistic names the number, the year, and links to the publisher.</p>
            {RAILS.map((rail) => (
              <div className="card railcard" key={rail}>
                <h3><span className="dot" style={{ background: RAIL_COLOR[rail] }} />{rail}
                  {(rail === "FedNow" || rail === "RTP") && <span className="badge">instant rail</span>}</h3>
                <table className="tbl">
                  <thead><tr><th>Metric</th><th>Value / figure</th><th>As of</th><th>Publisher</th><th></th></tr></thead>
                  <tbody>
                    {RAIL_FACTS[rail].map(([m, v, y, pub, url], i) => (
                      <tr key={i}><td>{m}</td><td>{v}</td><td>{y}</td><td>{pub}</td>
                        <td><a href={url} target="_blank" rel="noreferrer">verify ↗</a></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <div className="note">FedNow (Federal Reserve) and RTP (The Clearing House) are separate operators and networks. A bank can join one or both. Their per-transaction economics are near-identical; they differ on request-for-payment fees and reach.</div>
          </div>
        )}

        {/* ================= ASSUMPTIONS ================= */}
        {tab === "assum" && (
          <div className="datawrap">
            <p className="lead">Cost per transaction by rail — edit any number. Each cost line's source is on the right.</p>
            <div className="assumgrid">
              <div className="card">
                <h3>Cost stack (editable)</h3>
                <div className="stackscroll">
                  <table className="tbl small">
                    <thead><tr><th>Rail</th>{COMPONENTS.map((c) => <th key={c}>{c}</th>)}<th>Total</th></tr></thead>
                    <tbody>
                      {RAILS.map((rail) => (
                        <tr key={rail}>
                          <td className="rl">{rail}</td>
                          {COMPONENTS.map((c, ci) => (
                            <td key={ci}>
                              <input type="number" step={ci === 2 ? "0.001" : "0.01"} value={costs[rail][ci]}
                                onChange={(e) => { const nc = JSON.parse(JSON.stringify(costs)); nc[rail][ci] = +e.target.value; setCosts(nc); }} />
                            </td>
                          ))}
                          <td className="tot">{money2(total(costs[rail]))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="fine">Failure cost = Failure rate × Cost per failure. Reset by reloading the page.</p>
              </div>
              <div className="card">
                <h3>📎 Source for each cost line</h3>
                <table className="tbl">
                  <thead><tr><th>Cost line</th><th>Supports</th><th>As of</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {Object.entries(SRC).map(([k, v]) => (
                      <tr key={k}><td>{k}</td><td>{v.supports}</td><td>{v.asOf}</td>
                        <td><StatusTag status={v.status} /></td>
                        <td><a href={v.url} target="_blank" rel="noreferrer">open ↗</a></td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="fine"><span className="tag cited">Cited</span> direct from source · <span className="tag partly">Partly cited</span> rate cited, $ estimated · <span className="tag est">Estimate</span> calibrate with Payfinia data</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="wrap">
        Payfinia · Money Movement Analytics · USF FinTech Graduate Project · Two models: bottom-up (assume $/txn) &amp; top-down (allocate your real totals) ·
        Figures current as of the 2025–2026 research pass · This tool estimates; it is not a guarantee of savings.
      </footer>
    </div>
  );
}
