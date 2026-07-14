import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList, Tooltip } from "recharts";
import prospects from "./prospects.json";

const money = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x);
const moneyM = (x) => "$" + (x / 1e6).toFixed(1) + "M";
const SEG_COLOR = {
  "A — Target first": "#12b39c", "B — Strong": "#2E5496",
  "C — Moderate": "#F4A259", "D — Low priority": "#9AA7C7",
};
const SEG_ORDER = ["A — Target first", "B — Strong", "C — Moderate", "D — Low priority"];
const TABLE_CAP = 250;

export default function App() {
  const states = useMemo(() => [...new Set(prospects.map((p) => p.state))].filter(Boolean).sort(), []);
  const [state, setState] = useState("");
  const [segment, setSegment] = useState("");
  const [search, setSearch] = useState("");
  const [minBenefit, setMinBenefit] = useState(0);

  // segment summary from the FULL dataset (the strategic guide)
  const segAgg = useMemo(() => SEG_ORDER.map((s) => {
    const g = prospects.filter((p) => p.segment === s);
    return {
      seg: s, n: g.length,
      total: g.reduce((a, p) => a + p.est_net_benefit, 0),
      medAssets: g.length ? [...g].sort((a, b) => a.assets_musd - b.assets_musd)[Math.floor(g.length / 2)].assets_musd : 0,
      avgRoi: g.length ? g.reduce((a, p) => a + p.roi_pct, 0) / g.length : 0,
    };
  }), []);

  const rows = useMemo(() => prospects.filter((p) =>
    (!state || p.state === state) &&
    (!segment || p.segment === segment) &&
    p.est_net_benefit >= minBenefit &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => b.est_net_benefit - a.est_net_benefit), [state, segment, search, minBenefit]);

  const total = rows.reduce((s, p) => s + p.est_net_benefit, 0);
  const avgRoi = rows.length ? rows.reduce((s, p) => s + p.roi_pct, 0) / rows.length : 0;
  const chart = rows.slice(0, 15).map((p) => ({ name: `${p.name} (${p.state})`, value: Math.round(p.est_net_benefit), segment: p.segment }));

  function download() {
    const cols = ["priority_rank", "name", "state", "city", "segment", "tier", "assets_musd", "offices", "est_net_benefit", "roi_pct"];
    const csv = [cols.join(",")].concat(rows.map((r) => cols.map((c) => `"${r[c]}"`).join(","))).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "payfinia_prospects_filtered.csv"; a.click();
  }

  return (
    <div>
      <header className="hero"><div className="wrap">
        <div className="brand">PAYFINIA · GO-TO-MARKET</div>
        <h1>Prospect Finder</h1>
        <p>All {prospects.length.toLocaleString()} U.S. community banks, segmented by K-means into target tiers and ranked by
          the dollars each stands to save on instant payments. <b>Start with Segment A.</b> Data: FDIC BankFind (real).</p>
      </div></header>

      <div className="wrap">
        {/* ---- target segments (K-means) ---- */}
        <div className="seggrid">
          {segAgg.map((s, i) => (
            <div className={"segcard" + (i === 0 ? " lead" : "")} key={s.seg} style={{ borderTopColor: SEG_COLOR[s.seg] }}>
              <div className="segname" style={{ color: SEG_COLOR[s.seg] }}>{s.seg}</div>
              <div className="segbig">{moneyM(s.total)}<span> / yr</span></div>
              <div className="segmeta">{s.n.toLocaleString()} banks · median ${s.medAssets >= 1000 ? (s.medAssets / 1000).toFixed(1) + "B" : Math.round(s.medAssets) + "M"} · {s.avgRoi.toFixed(0)}% ROI</div>
            </div>
          ))}
        </div>
        <div className="note">🎯 <b>Where to start:</b> Segment A is {segAgg[0].n} large/regional banks worth <b>{moneyM(segAgg[0].total)}/yr</b> combined — the highest value and highest ROI. Work down from A to D.</div>

        <div className="layout">
          <aside>
            <div className="card">
              <h3>Filter</h3>
              <label className="fld"><span>Target segment</span>
                <select value={segment} onChange={(e) => setSegment(e.target.value)}>
                  <option value="">All segments</option>{SEG_ORDER.map((s) => <option key={s}>{s}</option>)}
                </select></label>
              <label className="fld"><span>State</span>
                <select value={state} onChange={(e) => setState(e.target.value)}>
                  <option value="">All states</option>{states.map((s) => <option key={s}>{s}</option>)}
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
              <div className="metric"><span>Prospects shown</span><b>{rows.length.toLocaleString()}</b></div>
              <div className="metric"><span>Total opportunity / yr</span><b>{moneyM(total)}</b></div>
              <div className="metric"><span>Top prospect</span><b style={{ fontSize: 15 }}>{rows[0]?.name ?? "—"}</b></div>
              <div className="metric"><span>Avg ROI</span><b>{avgRoi.toFixed(0)}%</b></div>
            </div>

            <div className="card">
              <h3>Top 15 by estimated annual value</h3>
              <ResponsiveContainer width="100%" height={430}>
                <BarChart data={[...chart].reverse()} layout="vertical" margin={{ left: 8, right: 110, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={230} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                    {[...chart].reverse().map((d, i) => <Cell key={i} fill={SEG_COLOR[d.segment] || "#2E5496"} />)}
                    <LabelList dataKey="value" position="right" formatter={(v) => money(v)} style={{ fontSize: 11, fill: "#0B1A2B", fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3>Ranked prospects — {rows.length.toLocaleString()} match{rows.length === 1 ? "" : "es"}{rows.length > TABLE_CAP ? ` (showing top ${TABLE_CAP})` : ""}</h3>
              <div className="scroll">
                <table className="tbl">
                  <thead><tr><th>#</th><th>Bank</th><th>State</th><th>Segment</th><th>Assets ($M)</th><th>Offices</th><th>Est. benefit / yr</th><th>ROI</th></tr></thead>
                  <tbody>
                    {rows.slice(0, TABLE_CAP).map((p, i) => (
                      <tr key={p.name + i}>
                        <td>{i + 1}</td><td>{p.name}</td><td>{p.state}</td>
                        <td><span className="pill" style={{ background: (SEG_COLOR[p.segment] || "#2E5496") + "22", color: SEG_COLOR[p.segment] || "#2E5496" }}>{p.segment?.split(" ")[0]}</span></td>
                        <td>{p.assets_musd.toLocaleString()}</td><td>{p.offices}</td>
                        <td><b>{money(p.est_net_benefit)}</b></td><td>{p.roi_pct.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="fine">Segments are K-means clusters on bank size &amp; branch network (silhouette 0.39). Bank facts are REAL FDIC data;
                estimated benefit uses the ROI model with rail-mix scaled from asset size (calibration gap). Download exports all {rows.length.toLocaleString()} filtered rows. Estimate, not a guarantee.</p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
