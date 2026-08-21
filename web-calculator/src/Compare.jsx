import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList, Tooltip } from "recharts";
import { LEGACY, RAIL_COLOR } from "./data.js";
import { exportScenario, exportAllScenarios } from "./scenarios.js";

const money = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x);

const RAIL_LABEL = { "Check": "Checks", "Wire": "Wires", "Same-Day ACH": "SD ACH", "ACH": "Std ACH" };

export default function Compare({ scenarios, onLoad, onDelete }) {
  if (!scenarios.length) {
    return (
      <div className="datawrap">
        <div className="card empty">
          <h3>No saved scenarios yet</h3>
          <p className="lead" style={{ marginBottom: 0 }}>
            Use <b>Save scenario</b> on any result to store a configuration. Save several — different migration rates,
            different cost assumptions, a before and after — and they line up here for side-by-side comparison.
          </p>
        </div>
      </div>
    );
  }

  const chart = scenarios.map((s) => ({ name: s.name, value: Math.round(s.result.net) }));

  return (
    <div className="datawrap">
      <div className="cardhead" style={{ marginBottom: 4 }}>
        <p className="lead" style={{ margin: 0 }}>Every saved scenario, side by side. <b>Load</b> one back into the model to keep editing it.</p>
        <button className="guidedbtn" onClick={() => exportAllScenarios(scenarios)}>Export all ↓</button>
      </div>

      <div className="card">
        <div className="cardhead">
          <h3>Net annual savings by scenario</h3>
          <span className="cardnote">After annual platform cost</span>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(150, chart.length * 46 + 20)}>
          <BarChart data={[...chart].reverse()} layout="vertical" margin={{ left: 8, right: 120, top: 4, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={190} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => money(v)} />
            <Bar dataKey="value" radius={[0, 5, 5, 0]} fill="#12b39c">
              <LabelList dataKey="value" position="right" formatter={(v) => money(v)} style={{ fontSize: 12, fill: "#0B1A2B", fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="cardhead">
          <h3>Scenario detail</h3>
          <span className="cardnote">Savings by rail</span>
        </div>
        <div className="tablewrap">
          <table className="dtbl">
            <thead>
              <tr>
                <th scope="col">Scenario</th>
                <th scope="col" className="n">Net / yr</th>
                <th scope="col" className="n">ROI</th>
                <th scope="col" className="n">Payback</th>
                <th scope="col" className="n">5-yr value</th>
                {LEGACY.map((r) => <th key={r} className="n nowrap"><span className="dot" style={{ background: RAIL_COLOR[r] }} />{RAIL_LABEL[r]}</th>)}
                <th scope="col" className="n"></th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => {
                const byRail = {}; s.result.rows.forEach((r) => { byRail[r.rail] = r.ann; });
                return (
                  <tr key={s.id}>
                    <th scope="row">{s.name}<em className="rowsub">{new Date(s.savedAt).toLocaleDateString()}</em></th>
                    <td className="n strong">{money(s.result.net)}</td>
                    <td className="n">{Math.round(s.result.roi * 100)}%</td>
                    <td className="n">{s.result.payback == null ? "—" : s.result.payback.toFixed(1) + " mo"}</td>
                    <td className="n">{money(s.result.npv)}</td>
                    {LEGACY.map((r) => <td key={r} className={"n" + ((byRail[r] || 0) < 0 ? " negval" : "")}>{money(byRail[r] || 0)}</td>)}
                    <td className="n nowrap">
                      <button className="minibtn" onClick={() => onLoad(s)}>Load</button>{" "}
                      <button className="minibtn" onClick={() => exportScenario(s)}>Export ↓</button>{" "}
                      <button className="minibtn danger" onClick={() => onDelete(s.id)} aria-label="Delete scenario">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="fine">Net per year is savings after the annual platform cost. Per-rail columns show where each
          scenario's savings originate — standard ACH is often negative because it is already cheaper than instant.</p>
      </div>
    </div>
  );
}
