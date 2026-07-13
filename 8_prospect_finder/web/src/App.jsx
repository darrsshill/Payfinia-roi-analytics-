import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList, Tooltip } from "recharts";
import prospects from "./prospects.json";

const money = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x);
const TIER_COLOR = {
  "Micro community": "#9AA7C7", "Small community": "#2E5496",
  "Mid-size / multi-branch": "#F4A259", "Large / regional": "#2EC4B6",
};

export default function App() {
  const states = useMemo(() => [...new Set(prospects.map((p) => p.state))].sort(), []);
  const tiers = useMemo(() => [...new Set(prospects.map((p) => p.tier))], []);
  const [state, setState] = useState("");
  const [tier, setTier] = useState("");
  const [search, setSearch] = useState("");
  const [minBenefit, setMinBenefit] = useState(0);

  const rows = useMemo(() => {
    let r = prospects.filter((p) =>
      (!state || p.state === state) &&
      (!tier || p.tier === tier) &&
      p.est_net_benefit >= minBenefit &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase()))
    );
    return r.sort((a, b) => b.est_net_benefit - a.est_net_benefit);
  }, [state, tier, search, minBenefit]);

  const total = rows.reduce((s, p) => s + p.est_net_benefit, 0);
  const avgRoi = rows.length ? rows.reduce((s, p) => s + p.roi_pct, 0) / rows.length : 0;
  const chart = rows.slice(0, 15).map((p) => ({ name: `${p.name} (${p.state})`, value: Math.round(p.est_net_benefit), tier: p.tier }));

  function download() {
    const cols = ["priority_rank", "name", "state", "city", "tier", "assets_musd", "offices", "est_net_benefit", "roi_pct"];
    const csv = [cols.join(",")].concat(rows.map((r) => cols.map((c) => `"${r[c]}"`).join(","))).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "payfinia_prospects_filtered.csv"; a.click();
  }

  return (
    <div>
      <header className="hero"><div className="wrap">
        <h1>🎯 Payfinia Prospect Finder</h1>
        <p>Every U.S. community bank, ranked by the dollars it stands to save by migrating to instant payments.
          <b> Top of the list = call first.</b> Data: FDIC BankFind (real).</p>
      </div></header>

      <div className="wrap layout">
        <aside>
          <div className="card">
            <h3>Filter prospects</h3>
            <label className="fld"><span>State</span>
              <select value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">All states</option>{states.map((s) => <option key={s}>{s}</option>)}
              </select></label>
            <label className="fld"><span>Bank type</span>
              <select value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">All types</option>{tiers.map((t) => <option key={t}>{t}</option>)}
              </select></label>
            <label className="fld"><span>Min. benefit ($/yr)</span>
              <input type="number" step="50000" value={minBenefit} onChange={(e) => setMinBenefit(+e.target.value || 0)} /></label>
            <label className="fld"><span>Search bank name</span>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Eagle" /></label>
            <button className="dl" onClick={download}>⬇ Download list (CSV)</button>
          </div>
        </aside>

        <main>
          <div className="metrics">
            <div className="metric"><span>Prospects shown</span><b>{rows.length}</b></div>
            <div className="metric"><span>Total opportunity / yr</span><b>{money(total)}</b></div>
            <div className="metric"><span>Top prospect</span><b style={{ fontSize: 15 }}>{rows[0]?.name ?? "—"}</b></div>
            <div className="metric"><span>Avg ROI</span><b>{avgRoi.toFixed(0)}%</b></div>
          </div>

          <div className="card">
            <h3>Top prospects by estimated annual value</h3>
            <ResponsiveContainer width="100%" height={430}>
              <BarChart data={[...chart].reverse()} layout="vertical" margin={{ left: 8, right: 110, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={230} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                  {[...chart].reverse().map((d, i) => <Cell key={i} fill={TIER_COLOR[d.tier] || "#2E5496"} />)}
                  <LabelList dataKey="value" position="right" formatter={(v) => money(v)} style={{ fontSize: 11, fill: "#1F3864", fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3>Ranked prospect list ({rows.length})</h3>
            <div className="scroll">
              <table className="tbl">
                <thead><tr><th>#</th><th>Bank</th><th>State</th><th>Type</th><th>Assets ($M)</th><th>Offices</th><th>Est. benefit / yr</th><th>ROI</th></tr></thead>
                <tbody>
                  {rows.map((p, i) => (
                    <tr key={p.name + i}>
                      <td>{i + 1}</td><td>{p.name}</td><td>{p.state}</td>
                      <td><span className="pill" style={{ background: (TIER_COLOR[p.tier] || "#2E5496") + "22", color: TIER_COLOR[p.tier] || "#2E5496" }}>{p.tier}</span></td>
                      <td>{p.assets_musd.toLocaleString()}</td><td>{p.offices}</td>
                      <td><b>{money(p.est_net_benefit)}</b></td><td>{p.roi_pct.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="fine">Bank facts (assets, deposits, offices, income) are REAL FDIC data. Estimated benefit uses the
              Deliverable-2 ROI model with rail-mix volumes scaled from asset size (the calibration gap). Ships with 50 real
              top prospects; run <code>fetch_payfinia_banks.py</code> to load all ~4,089. Estimate, not a guarantee.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
