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
const num = (x) => new Intl.NumberFormat("en-US").format(Math.round(x));

const total = (c) => c[0] + c[1] + c[2] * c[3] + c[4] + c[5] + c[6] + c[7] + c[8];

function StatusTag({ status }) {
  const cls = status === "Cited" ? "tag cited" : status === "Estimate" ? "tag est" : "tag partly";
  return <span className={cls}>{status}</span>;
}

export default function App() {
  const [tab, setTab] = useState("calc");
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

  function applyPreset(name) {
    setPresetName(name);
    const p = PRESETS[name];
    setVol({ Check: p.Check, Wire: p.Wire, "Same-Day ACH": p["Same-Day ACH"], ACH: p.ACH });
    setOneTime(p.oneTime); setAnnual(p.annual);
  }

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

  const savingsData = res.rows.map((r) => ({ name: r.rail, value: Math.round(r.ann), color: RAIL_COLOR[r.rail] }));
  const costOrder = ["Wire", "Check", "Same-Day ACH", "FedNow", "RTP", "ACH"];
  const costData = costOrder.map((r) => ({ name: r, value: +total(costs[r]).toFixed(2), color: RAIL_COLOR[r] }));

  return (
    <div className="app">
      <header className="hero">
        <div className="wrap">
          <div className="brand">PAYFINIA · MONEY MOVEMENT ANALYTICS</div>
          <h1>Migration ROI Calculator</h1>
          <p>See what a community bank saves by moving checks &amp; wires to instant payments —
            <strong> FedNow and RTP shown separately, every number sourced.</strong></p>
        </div>
      </header>

      <nav className="tabs wrap">
        <button className={tab === "calc" ? "on" : ""} onClick={() => setTab("calc")}>🧮 Calculator</button>
        <button className={tab === "data" ? "on" : ""} onClick={() => setTab("data")}>📊 Rail Data &amp; Sources</button>
        <button className={tab === "assum" ? "on" : ""} onClick={() => setTab("assum")}>⚙️ Cost Assumptions</button>
      </nav>

      <main className="wrap">
        {tab === "calc" && (
          <div className="grid">
            {/* INPUTS */}
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
                  <input type="number" min="0" value={vol[r]}
                    onChange={(e) => setVol({ ...vol, [r]: +e.target.value })} />
                </label>
              ))}
              <label className="fld">
                <span>One-time implementation ($)</span>
                <input type="number" min="0" value={oneTime} onChange={(e) => setOneTime(+e.target.value)} />
              </label>
              <label className="fld">
                <span>Annual fixed cost ($/yr)</span>
                <input type="number" min="0" value={annual} onChange={(e) => setAnnual(+e.target.value)} />
              </label>

              <h2>2 · Migrate to</h2>
              <div className="toggle">
                {["FedNow", "RTP"].map((d) => (
                  <button key={d} className={dest === d ? "on" : ""} onClick={() => setDest(d)}>{d}</button>
                ))}
              </div>
              <p className="hint">Two separate U.S. instant rails — FedNow (Federal Reserve) and RTP (The Clearing House). Costs are near-identical; see the Rail Data tab.</p>

              <h2>3 · Migration assumptions</h2>
              {LEGACY.map((r) => (
                <label className="fld slider" key={r}>
                  <span>{r} that migrate: <b>{subst[r]}%</b></span>
                  <input type="range" min="0" max="100" value={subst[r]}
                    onChange={(e) => setSubst({ ...subst, [r]: +e.target.value })} />
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

            {/* RESULTS */}
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
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} />
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
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} />
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
                      <tr key={r.rail}>
                        <td>{r.rail}</td><td>{money2(r.legacy)}</td>
                        <td className={r.per < 0 ? "neg" : ""}>{money2(r.per)}</td>
                        <td>{num(r.migrated)}</td><td>{money(r.ann)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="fine">Gross {money(res.gross)} − annual fixed {money(annual)} = net {money(res.net)}. Analytical estimate, not a guarantee.</p>
              </div>
            </section>
          </div>
        )}

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
                      <tr key={i}>
                        <td>{m}</td><td>{v}</td><td>{y}</td><td>{pub}</td>
                        <td><a href={url} target="_blank" rel="noreferrer">verify ↗</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            <div className="note">FedNow (Federal Reserve) and RTP (The Clearing House) are separate operators and networks. A bank can join one or both. Their per-transaction economics are near-identical; they differ on request-for-payment fees and reach.</div>
          </div>
        )}

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
                                onChange={(e) => {
                                  const nc = JSON.parse(JSON.stringify(costs));
                                  nc[rail][ci] = +e.target.value; setCosts(nc);
                                }} />
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
                      <tr key={k}>
                        <td>{k}</td><td>{v.supports}</td><td>{v.asOf}</td>
                        <td><StatusTag status={v.status} /></td>
                        <td><a href={v.url} target="_blank" rel="noreferrer">open ↗</a></td>
                      </tr>
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
        Payfinia · Money Movement Analytics · USF FinTech Graduate Project · Figures current as of the 2025–2026 research pass ·
        This tool estimates; it is not a guarantee of savings.
      </footer>
    </div>
  );
}
