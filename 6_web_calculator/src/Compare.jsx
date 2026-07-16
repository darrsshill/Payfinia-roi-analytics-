import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList, Tooltip } from "recharts";
import { LEGACY, RAIL_COLOR } from "./data.js";

const money = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x);

export default function Compare({ scenarios, onLoad, onDelete }) {
  if (!scenarios.length) {
    return (
      <div className="datawrap">
        <div className="card">
          <h3>No saved versions yet</h3>
          <p className="lead" style={{ marginBottom: 0 }}>
            On any result, click <b>“Save this scenario.”</b> Save a few configurations — different migration rates,
            different cost assumptions, a before/after — and they'll line up here side by side so you can compare
            savings rail by rail.
          </p>
        </div>
      </div>
    );
  }

  const chart = scenarios.map((s) => ({ name: s.name, value: Math.round(s.result.net) }));

  return (
    <div className="datawrap">
      <p className="lead">Every version you saved, side by side. <b>Load</b> one back into the calculator to keep editing, or remove it.</p>

      <div className="card">
        <h3>Net savings per year — by version</h3>
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
        <h3>Details — savings by rail</h3>
        <div className="stackscroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Version</th><th>Net / yr</th><th>ROI</th><th>Payback</th><th>5-yr value</th>
                {LEGACY.map((r) => <th key={r}><span className="dot" style={{ background: RAIL_COLOR[r] }} /> {r}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => {
                const byRail = {}; s.result.rows.forEach((r) => { byRail[r.rail] = r.ann; });
                return (
                  <tr key={s.id}>
                    <td className="rl">{s.name}<div className="fine" style={{ margin: 0 }}>{new Date(s.savedAt).toLocaleDateString()}</div></td>
                    <td><b>{money(s.result.net)}</b></td>
                    <td>{Math.round(s.result.roi * 100)}%</td>
                    <td>{s.result.payback == null ? "—" : s.result.payback.toFixed(1) + " mo"}</td>
                    <td>{money(s.result.npv)}</td>
                    {LEGACY.map((r) => <td key={r}>{money(byRail[r] || 0)}</td>)}
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="minibtn" onClick={() => onLoad(s)}>Load</button>{" "}
                      <button className="minibtn danger" onClick={() => onDelete(s.id)}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="fine">“Net / yr” is savings after the annual platform cost. Per-rail columns show where each version's savings come from — note standard ACH is often negative because it's already cheaper than instant.</p>
      </div>
    </div>
  );
}
