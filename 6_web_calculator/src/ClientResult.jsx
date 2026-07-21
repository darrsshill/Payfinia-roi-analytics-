import { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList, Tooltip } from "recharts";
import { RAIL_COLOR, runBottomUp, railTotal } from "./data.js";
import WhyMigrate from "./WhyMigrate.jsx";

const money = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x);
const money2 = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(x);
const num = (x) => new Intl.NumberFormat("en-US").format(Math.round(x || 0));

function CNum({ value, onChange }) {
  const [txt, setTxt] = useState(num(value));
  useEffect(() => { setTxt(num(value)); }, [value]);
  return (
    <input className="cinput" inputMode="numeric" value={txt}
      onChange={(e) => { setTxt(e.target.value); const n = parseFloat(e.target.value.replace(/[^0-9.]/g, "")); onChange(isNaN(n) ? 0 : n); }}
      onBlur={() => setTxt(num(value))} />
  );
}

export default function ClientResult({
  vol, setVolRail, costs, subst, mig, setMig, overrides, oneTime, annual, disc, horizon,
  bankName, scenarios = [], onSaveScenario, onDeleteScenario, onLoadScenario,
  onAdvanced, onRestart, onSources, onCompare,
}) {
  const [scName, setScName] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const res = useMemo(
    () => runBottomUp(vol, costs, subst, oneTime, annual, disc, horizon, overrides),
    [vol, costs, subst, oneTime, annual, disc, horizon, overrides]
  );
  const topSaver = [...res.rows].sort((a, b) => b.ann - a.ann)[0];

  function doSave() {
    onSaveScenario(scName);
    setScName(""); setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2200);
  }
  const savings = res.rows.map((r) => ({ name: r.rail, value: Math.round(r.ann), color: RAIL_COLOR[r.rail] })).filter((d) => d.value > 0);
  const pos = res.net > 0;

  return (
    <div className="client">
      <header className="chero">
        <div className="wrap chinner">
          <div className="cbrand">PAYFINIA</div>
          <div className="cheadbtns">
            <button className="cghost" onClick={onRestart}>↺ Start over</button>
            <button className="cghost" onClick={onAdvanced}>Advanced view →</button>
          </div>
        </div>
      </header>

      <main className="wrap cbody">
        <div className="ceyebrow">Your instant-payments estimate</div>
        <h1 className="ctitle">{bankName ? bankName : "Your institution"} could save</h1>

        <div className={"csave" + (pos ? "" : " neg")}>
          <div className="cbig">{pos ? money(res.net) : "—"}<span> / year</span></div>
          {pos ? (
            <div className="cstats">
              <div><span>First-year ROI</span><b>{Math.round(res.roi * 100)}%</b></div>
              <div><span>Pays for itself in</span><b>{res.payback === Infinity ? "—" : res.payback.toFixed(1)} months</b></div>
              <div><span>5-year value</span><b>{money(res.npv)}</b></div>
            </div>
          ) : (
            <p className="cnegnote">At these numbers the switch doesn't pay back yet — move more of your checks &amp; wires to instant, or lower the setup cost in Advanced view.</p>
          )}
        </div>

        <div className="cgrid">
          <section className="ccard">
            <h3>Adjust your numbers</h3>
            <label className="cfld"><span>Checks you send / year</span><CNum value={vol.Check} onChange={(v) => setVolRail("Check", v)} /></label>
            <label className="cfld"><span>Wires you send / year</span><CNum value={vol.Wire} onChange={(v) => setVolRail("Wire", v)} /></label>
            <label className="cfld cslider">
              <span>Move to instant: <b>{mig}%</b></span>
              <input type="range" min="0" max="100" value={mig} onChange={(e) => setMig(+e.target.value)} />
            </label>
            <p className="cfine">Everything updates live. These are the payments you <b>send</b> — the ones instant can replace.</p>
          </section>

          <section className="ccard">
            <h3>Where the savings come from</h3>
            {savings.length ? (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={savings} layout="vertical" margin={{ left: 4, right: 96, top: 2, bottom: 2 }}>
                  <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={104} tickLine={false} axisLine={false} tick={{ fontSize: 13 }} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {savings.map((d, i) => <Cell key={i} fill={d.color} />)}
                    <LabelList dataKey="value" position="right" formatter={(v) => money(v)} style={{ fontSize: 12, fill: "#0B1A2B", fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="cfine">Move some volume to instant to see where savings come from.</p>}
            <p className="cfine">A wire costs about <b>{money2(railTotal(costs.Wire))}</b> and a check <b>{money2(railTotal(costs.Check))}</b> to send — an instant payment is about <b>{money2(res.instant)}</b>.{pos && <> Biggest win: <b>{topSaver.rail}</b>.</>}</p>
          </section>
        </div>

        {/* why migrate — per-rail case */}
        <section className="ccard">
          <h3>Why switch each payment type</h3>
          <p className="cfine" style={{ marginTop: 0, marginBottom: 4 }}>The honest case, rail by rail — including where it's <b>not</b> worth switching.</p>
          <WhyMigrate costs={costs} />
        </section>

        {/* save + compare versions */}
        <section className="ccard csave-versions">
          <h3>Save &amp; compare versions</h3>
          <p className="cfine" style={{ marginTop: 0 }}>Save this estimate, tweak your numbers, save another — then compare them side by side.</p>
          <div className="csaverow">
            <input className="cinput" value={scName} onChange={(e) => setScName(e.target.value)}
              placeholder={`Name this version (e.g. "${bankName || "Our bank"} · ${mig}%")`} />
            <button className="cbtn" onClick={doSave}>{justSaved ? "✓ Saved" : "Save this scenario"}</button>
          </div>

          {scenarios.length > 0 && (
            <>
              <div className="cverlist">
                {scenarios.map((s) => (
                  <div className="cverrow" key={s.id}>
                    <div className="cvername">{s.name}<span className="cverdate">{new Date(s.savedAt).toLocaleDateString()}</span></div>
                    <div className="cvernet">{money(s.result.net)}<span>/yr</span></div>
                    <div className="cverbtns">
                      <button className="minibtn" onClick={() => onLoadScenario(s)}>Load</button>
                      <button className="minibtn danger" onClick={() => onDeleteScenario(s.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="clink" onClick={onCompare} style={{ marginTop: 12 }}>Compare all {scenarios.length} side by side →</button>
            </>
          )}
        </section>

        {/* make the switch — Payfinia CTA */}
        <section className="ccta">
          <div>
            <div className="cctahead">Ready to capture this?</div>
            <p>Payfinia can calibrate this estimate to your real numbers and show exactly what switching looks like — no change to your core.</p>
          </div>
          <a className="cctabtn" href="mailto:hello@payfinia.com?subject=Instant%20payments%20ROI%20—%20let's%20talk">Talk to Payfinia →</a>
        </section>

        <div className="ctrust">
          <div>
            <b>Built on public data</b> — Federal Reserve, Nacha and The Clearing House. The numbers you type never leave your browser.
          </div>
          <button className="clink" onClick={onSources}>See the sources &amp; assumptions →</button>
        </div>

        <p className="cdisc">Estimate for discussion, not a guarantee of savings. Figures use public benchmarks; Payfinia can calibrate them to your actuals.</p>
      </main>
    </div>
  );
}
