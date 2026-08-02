import { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList, Tooltip } from "recharts";
import { RAIL_COLOR, LEGACY, runBottomUp, railTotal } from "./data.js";
import WhyMigrate from "./WhyMigrate.jsx";
import SegmentBreakdown from "./SegmentBreakdown.jsx";

const money = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x);
const money2 = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(x);
const num = (x) => new Intl.NumberFormat("en-US").format(Math.round(x || 0));

const RAIL_LABEL = { "Check": "Checks", "Wire": "Wires", "Same-Day ACH": "Same-Day ACH", "ACH": "Standard ACH" };

function CNum({ value, onChange }) {
  const [txt, setTxt] = useState(num(value));
  useEffect(() => { setTxt(num(value)); }, [value]);
  return (
    <input className="cinput" inputMode="numeric" value={txt}
      onChange={(e) => { setTxt(e.target.value); const n = parseFloat(e.target.value.replace(/[^0-9.]/g, "")); onChange(isNaN(n) ? 0 : n); }}
      onBlur={() => setTxt(num(value))} />
  );
}

const slug = (s) => (s || "institution").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "institution";

export default function ClientResult({
  vol, setVolRail, costs, subst, mig, setMig, overrides, oneTime, annual, disc, horizon,
  userName, bankName, scenarios = [], onSaveScenario, onDeleteScenario, onLoadScenario,
  onAdvanced, onRestart, onSources, onCompare,
  result, volBySeg, segCosts,
}) {
  const [scName, setScName] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  // The segmented result is computed once in App and passed down. A local
  // recompute would use the flat single-segment path and silently disagree
  // with the analyst view, so `result` wins whenever it is present.
  const local = useMemo(
    () => runBottomUp(vol, costs, subst, oneTime, annual, disc, horizon, overrides),
    [vol, costs, subst, oneTime, annual, disc, horizon, overrides]
  );
  const res = result || local;
  const topSaver = [...res.rows].sort((a, b) => b.ann - a.ann)[0] || { rail: "—", ann: 0 };

  function doSave() {
    onSaveScenario(scName);
    setScName(""); setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2200);
  }

  function doExport() {
    const payload = {
      institution: bankName || null,
      preparedFor: userName || null,
      exportedAt: new Date().toISOString(),
      inputs: {
        outboundVolumeAnnual: vol,
        shareMovingToInstantPct: mig,
        oneTimeSetupCost: oneTime,
        annualPlatformCost: annual,
        discountRatePct: disc,
        horizonYears: horizon,
      },
      results: {
        netAnnualSavings: res.net,
        grossAnnualSavings: res.gross,
        firstYearRoiPct: Math.round(res.roi * 100),
        paybackMonths: res.payback === Infinity ? null : +res.payback.toFixed(1),
        fiveYearValue: res.npv,
        instantCostPerTxn: res.instant,
        byRail: res.rows.map((r) => ({
          rail: RAIL_LABEL[r.rail] || r.rail,
          costPerTxn: r.legacy,
          savedPerTxn: r.per,
          paymentsMigrated: r.migrated,
          annualSavings: r.ann,
        })),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payfinia-roi-${slug(bankName)}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  const savings = res.rows
    .map((r) => ({ name: RAIL_LABEL[r.rail] || r.rail, value: Math.round(r.ann), color: RAIL_COLOR[r.rail] }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const pos = res.net > 0;
  const totMigrated = res.rows.reduce((s, r) => s + r.migrated, 0);

  return (
    <div className="client">
      <header className="chero">
        <div className="wrap chinner">
          <div className="cbrandwrap">
            <div className="cbrand">Payfinia</div>
            <div className="cbrandsub">Instant Payments ROI</div>
          </div>
          <div className="cheadbtns">
            <button className="cghost" onClick={onRestart}>Start over</button>
            <button className="cghost" onClick={doExport}>Export data ↓</button>
            <button className="cghost solid" onClick={onAdvanced}>Full model →</button>
          </div>
        </div>
      </header>

      <main className="wrap cbody">
        <div className="cpagehead">
          <div>
            <div className="ceyebrow">Instant payments · savings estimate</div>
            <h1 className="ctitle">{bankName ? bankName : "Your institution"}</h1>
            <p className="csubtitle">
              {userName ? `Prepared for ${userName}. ` : ""}
              Modelled on {num(LEGACY.reduce((s, r) => s + (vol[r] || 0), 0))} outbound payments a year across checks,
              wires and ACH.
            </p>
          </div>
        </div>

        <div className={"csave" + (pos ? "" : " neg")}>
          <div className="csavelbl">Estimated annual net savings</div>
          <div className="cbig">{pos ? money(res.net) : "—"}<span>/ year</span></div>
          {pos ? (
            <div className="cstats">
              <div><span>First-year ROI</span><b>{Math.round(res.roi * 100)}%</b></div>
              <div><span>Payback period</span><b>{res.payback === Infinity ? "—" : `${res.payback.toFixed(1)} mo`}</b></div>
              <div><span>5-year value</span><b>{money(res.npv)}</b></div>
              <div><span>Payments migrated</span><b>{num(totMigrated)}</b></div>
            </div>
          ) : (
            <p className="cnegnote">At these inputs the migration does not pay back yet. Increase the share of checks and
              wires moving to instant, or revise the setup cost in the full model.</p>
          )}
        </div>

        <div className="cgrid">
          <section className="ccard">
            <div className="ccardhead">
              <h3>Your outbound volume</h3>
              <span className="ccardnote">Annual, items you originate</span>
            </div>
            <div className="crails">
              {LEGACY.map((r) => (
                <label className="crail" key={r}>
                  <span className="craillbl">{RAIL_LABEL[r]}</span>
                  <CNum value={vol[r]} onChange={(v) => setVolRail(r, v)} />
                </label>
              ))}
            </div>
            <div className="cslider">
              <span className="cslidertop">Share moving to instant<b>{mig}%</b></span>
              <input type="range" min="0" max="100" value={mig} onChange={(e) => setMig(+e.target.value)} />
              <span className="cslidermarks"><i>Hold steady</i><i>Move everything</i></span>
            </div>
            <p className="cfine">Business volume is shifted more conservatively than retail at the same setting. Every
              figure updates live.</p>
          </section>

          <section className="ccard">
            <div className="ccardhead">
              <h3>Where the savings come from</h3>
              <span className="ccardnote">Per year, by rail</span>
            </div>
            {savings.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={savings} layout="vertical" margin={{ left: 0, right: 96, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={112} tickLine={false} axisLine={false} tick={{ fontSize: 13, fill: "#26384c" }} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                    {savings.map((d, i) => <Cell key={i} fill={d.color} />)}
                    <LabelList dataKey="value" position="right" formatter={(v) => money(v)} style={{ fontSize: 12.5, fill: "#0B1A2B", fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="cfine">Move some volume to instant to see where savings come from.</p>}
            <div className="cunitcost">
              <div><span>Wire today</span><b>{money2(railTotal(costs.Wire))}</b></div>
              <div><span>Check today</span><b>{money2(railTotal(costs.Check))}</b></div>
              <div className="accent"><span>Instant</span><b>{money2(res.instant)}</b></div>
            </div>
            {pos && <p className="cfine">Largest single win: <b>{RAIL_LABEL[topSaver.rail] || topSaver.rail}</b> at {money(topSaver.ann)} a year.</p>}
          </section>
        </div>

        <section className="ccard">
          <div className="ccardhead">
            <h3>Detail by rail</h3>
            <span className="ccardnote">Blended across all customer segments</span>
          </div>
          <div className="tablewrap">
            <table className="dtbl">
              <colgroup><col style={{ width: "26%" }} /><col /><col /><col /><col /></colgroup>
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
                    <th scope="row"><span className="railname"><i className="raildot" style={{ background: RAIL_COLOR[r.rail] }} />{RAIL_LABEL[r.rail] || r.rail}</span></th>
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
                  <td className="n">—</td>
                  <td className="n">—</td>
                  <td className="n">{num(totMigrated)}</td>
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
        </section>

        {res.segments && volBySeg && (
          <section className="ccard">
            <SegmentBreakdown result={res} segCosts={segCosts} volBySeg={volBySeg} />
          </section>
        )}

        <section className="ccard">
          <div className="ccardhead">
            <h3>The case for each payment type</h3>
            <span className="ccardnote">Including where switching is not worth it</span>
          </div>
          <WhyMigrate costs={costs} ov={overrides} segment="Retail" />
        </section>

        <section className="ccard csave-versions">
          <div className="ccardhead">
            <h3>Save &amp; compare scenarios</h3>
            <span className="ccardnote">Stored locally in this browser</span>
          </div>
          <div className="csaverow">
            <input className="cinput" value={scName} onChange={(e) => setScName(e.target.value)}
              placeholder={`Name this scenario — e.g. "${bankName || "Base case"} · ${mig}%"`} />
            <button className="cbtn" onClick={doSave}>{justSaved ? "✓ Saved" : "Save scenario"}</button>
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
                      <button className="minibtn danger" onClick={() => onDeleteScenario(s.id)} aria-label="Delete scenario">✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="clink" onClick={onCompare} style={{ marginTop: 14 }}>Compare all {scenarios.length} side by side →</button>
            </>
          )}
        </section>

        <section className="ccta">
          <div>
            <div className="cctahead">Ready to validate these numbers?</div>
            <p>Payfinia can calibrate this model to your actual cost and volume data and show exactly what the migration
              looks like — with no change to your core.</p>
          </div>
          <a className="cctabtn" href="mailto:hello@payfinia.com?subject=Instant%20payments%20ROI%20review">Talk to Payfinia →</a>
        </section>

        <div className="ctrust">
          <div>
            <b>Built on public data</b> — Federal Reserve, Nacha, The Clearing House and the AFP cost and fraud surveys.
            Nothing you enter leaves your browser.
          </div>
          <button className="clink" onClick={onSources}>Sources &amp; assumptions →</button>
        </div>

        <p className="cdisc">Estimate for discussion, not a guarantee of savings. Figures use published benchmarks unless
          replaced with your own inputs.</p>
      </main>
    </div>
  );
}
