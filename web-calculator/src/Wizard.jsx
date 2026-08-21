import { useState, useEffect } from "react";
import { PRESETS, APPETITE, SEGMENTS, SEG_META, LEGACY, mixFromCustomers } from "./data.js";

const num = (x) => new Intl.NumberFormat("en-US").format(Math.round(x || 0));

// Plain-language description of each outbound rail, shown beside its input so
// the person entering numbers knows exactly which items to count.
const RAIL_COPY = {
  "Check": { title: "Checks", sub: "Paper items you issue — AP runs, official checks, member disbursements." },
  "Wire": { title: "Wires", sub: "Fedwire originations. Highest cost and fraud exposure per item." },
  "Same-Day ACH": { title: "Same-Day ACH", sub: "Credits you originate on the same-day windows." },
  "ACH": { title: "Standard ACH", sub: "Next-day credits — payroll, vendor files, account transfers." },
};

// comma-formatted numeric input that stays in sync when a preset changes
function WNum({ value, onChange, autoFocus }) {
  const [txt, setTxt] = useState(num(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setTxt(num(value)); }, [value, editing]);
  return (
    <input
      className="wizinput" inputMode="numeric" value={txt} autoFocus={autoFocus}
      onFocus={() => setEditing(true)}
      onChange={(e) => { setTxt(e.target.value); const n = parseFloat(e.target.value.replace(/[^0-9.]/g, "")); onChange(isNaN(n) ? 0 : n); }}
      onBlur={() => { setEditing(false); setTxt(num(value)); }} />
  );
}

const SIZE_KEYS = Object.keys(PRESETS);

export default function Wizard({ onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [first, setFirst] = useState("");
  const [bank, setBank] = useState("");
  const [sizeKey, setSizeKey] = useState("Mid CFI (~$1B)");
  const p = PRESETS[sizeKey];

  // All four outbound rails are collected. Same-Day ACH and standard ACH were
  // previously pre-filled and never asked for, which left two of the four
  // volume drivers invisible to the person doing the intake.
  const [vol, setVol] = useState({
    "Check": p.Check, "Wire": p.Wire, "Same-Day ACH": p["Same-Day ACH"], "ACH": p.ACH,
  });
  const [unit, setUnit] = useState("Annual");           // how the user types them
  const [oneTime, setOneTime] = useState(p.oneTime);
  const [annual, setAnnual] = useState(p.annual);
  const [appetite, setAppetite] = useState("Moderate");
  const [cust, setCust] = useState({ ...p.customers });

  const mult = unit === "Monthly" ? 12 : 1;             // display -> annual
  const setRail = (rail, shown) => setVol((v) => ({ ...v, [rail]: shown * mult }));

  function pickSize(k) {
    setSizeKey(k);
    const pp = PRESETS[k];
    setVol({ "Check": pp.Check, "Wire": pp.Wire, "Same-Day ACH": pp["Same-Day ACH"], "ACH": pp.ACH });
    setOneTime(pp.oneTime); setAnnual(pp.annual);
    if (pp.customers) setCust({ ...pp.customers });
  }

  const mix = mixFromCustomers(cust);
  const totalItems = LEGACY.reduce((s, r) => s + (vol[r] || 0), 0);
  const totalCustomers = (+cust.retail || 0) + (+cust.smb || 0) + (+cust.midmarket || 0);
  const migrating = LEGACY.reduce((s, rail) =>
    s + SEGMENTS.reduce((t, seg) =>
      t + (vol[rail] || 0) * ((mix[rail]?.[seg] || 0) / 100) * (APPETITE[appetite][seg][rail] / 100), 0), 0);

  const steps = [
    {
      key: "welcome",
      label: "Welcome",
      render: () => (
        <>
          <h2>Let's size the opportunity for your institution.</h2>
          <p className="wizsub">Four short steps, about a minute. Nothing you type leaves your browser.</p>
          <div className="wizsolo">
            <label className="wizfield">
              <span className="wizlbl">Your name</span>
              <input className="wizinput" autoFocus value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Jordan Ellis" />
            </label>
          </div>
        </>
      ),
      canNext: () => first.trim().length > 0,
    },
    {
      key: "bank",
      label: "Institution",
      render: () => (
        <>
          <h2>Tell us about your institution.</h2>
          <p className="wizsub">Choosing a size band pre-fills typical volumes. You'll confirm every number on the next step.</p>
          <div className="wizsolo">
            <label className="wizfield">
              <span className="wizlbl">Institution name <em>optional</em></span>
              <input className="wizinput" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Riverbend Community Bank" />
            </label>
          </div>
          <div className="wizgrouplbl">Asset size</div>
          <div className="sizegrid three">
            {SIZE_KEYS.map((k) => (
              <button key={k} className={"sizebtn" + (sizeKey === k ? " on" : "")} onClick={() => pickSize(k)}>
                <b>{PRESETS[k].label}</b>
                <span>{num(PRESETS[k].Check + PRESETS[k].Wire + PRESETS[k]["Same-Day ACH"] + PRESETS[k].ACH)} outbound items / yr</span>
              </button>
            ))}
          </div>
        </>
      ),
      canNext: () => true,
    },
    {
      key: "vol",
      label: "Volume",
      render: () => (
        <>
          <h2>How many payments do you send?</h2>
          <p className="wizsub">
            Outbound only — items your institution originates. Incoming payments are set by the sender, so they aren't
            part of the migration.
          </p>

          <div className="wizunitrow">
            <span className="wizgrouplbl">Enter volumes as</span>
            <div className="wizseg">
              {["Annual", "Monthly"].map((u) => (
                <button key={u} className={unit === u ? "on" : ""} onClick={() => setUnit(u)}>{u}</button>
              ))}
            </div>
          </div>

          <div className="wizrails">
            {LEGACY.map((rail, i) => (
              <label className="wizrail" key={rail}>
                <span className="wizraillbl">
                  <b>{RAIL_COPY[rail].title}</b>
                  <em>{RAIL_COPY[rail].sub}</em>
                </span>
                <span className="wizrailinput">
                  <WNum value={(vol[rail] || 0) / mult} onChange={(v) => setRail(rail, v)} autoFocus={i === 0} />
                  <i>/ {unit === "Monthly" ? "mo" : "yr"}</i>
                </span>
              </label>
            ))}
          </div>

          <div className="wiztotal">
            <span>Total outbound volume</span>
            <b>{num(totalItems)} items / yr</b>
          </div>
        </>
      ),
      canNext: () => true,
    },
    {
      key: "segments",
      label: "Customers",
      render: () => (
        <>
          <h2>How is your customer base split?</h2>
          <p className="wizsub">
            A commercial wire costs far more to process than a consumer one — positive pay, callbacks, dual control. Retail,
            business and internal payments are therefore costed separately rather than averaged. Approximate counts are fine.
          </p>

          <div className="wizrails compact">
            <label className="wizrail">
              <span className="wizraillbl"><b>Retail members</b><em>Consumer accounts and account holders</em></span>
              <span className="wizrailinput"><WNum value={cust.retail} onChange={(v) => setCust({ ...cust, retail: v })} autoFocus /></span>
            </label>
            <label className="wizrail">
              <span className="wizraillbl"><b>Small business</b><em>SMB operating and treasury accounts</em></span>
              <span className="wizrailinput"><WNum value={cust.smb} onChange={(v) => setCust({ ...cust, smb: v })} /></span>
            </label>
            <label className="wizrail">
              <span className="wizraillbl"><b>Mid-market / commercial</b><em>Higher-touch clients with AP/AR workflow</em></span>
              <span className="wizrailinput"><WNum value={cust.midmarket} onChange={(v) => setCust({ ...cust, midmarket: v })} /></span>
            </label>
          </div>

          <div className="wiztotal">
            <span>Total relationships</span>
            <b>{num(totalCustomers)}</b>
          </div>

          <div className="wizmixpreview">
            <div className="wizmixhead">
              <span>Implied split of your outbound volume</span>
              <div className="wizmixkey">
                {SEGMENTS.map((s) => (
                  <span key={s}><i style={{ background: SEG_META[s].color }} />{SEG_META[s].label}</span>
                ))}
              </div>
            </div>
            {LEGACY.map((rail) => (
              <div className="wizmixrow" key={rail}>
                <span className="wizmixrail">{RAIL_COPY[rail].title}</span>
                <div className="wizmixbar">
                  {SEGMENTS.map((s) => {
                    const pct = mix[rail]?.[s] || 0;
                    if (pct <= 0) return null;
                    return (
                      <div key={s} style={{ width: pct + "%", background: SEG_META[s].color }}
                        title={`${SEG_META[s].label} ${pct.toFixed(0)}%`}>
                        {pct > 14 && <span>{pct.toFixed(0)}%</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      ),
      canNext: () => true,
    },
    {
      key: "mig",
      label: "Migration",
      render: () => (
        <>
          <h2>How quickly would you move volume?</h2>
          <p className="wizsub">
            Business volume migrates more slowly than retail at the same appetite — contract terms, AP file cycles and
            supplier onboarding all slow it down. A separate rate is applied to each segment, and every rate stays editable
            after this.
          </p>
          <div className="wizappetite">
            {Object.keys(APPETITE).map((a) => (
              <button key={a} className={"sizebtn" + (appetite === a ? " on" : "")} onClick={() => setAppetite(a)}>
                <b>{a}</b>
                <span>Retail {APPETITE[a].Retail.Check}–{APPETITE[a].Retail.Wire}%</span>
                <span>Business {APPETITE[a].Business.Check}–{APPETITE[a].Business.Wire}%</span>
              </button>
            ))}
          </div>
          <div className="wiztotal accent">
            <span>Moving to instant at <b>{appetite}</b></span>
            <b>{num(migrating)} payments / yr</b>
          </div>
        </>
      ),
      canNext: () => true,
      isLast: true,
    },
  ];

  const cur = steps[step];

  function finish() {
    onComplete({
      vol: { ...vol },
      oneTime, annual, appetite,
      customers: cust, mix,
      firstName: first.trim(), bank: bank.trim(),
    });
  }

  return (
    <div className="wizard">
      <div className="wizcard">
        <div className="wiztop">
          <div className="wizbrand">Payfinia<em>Money movement analytics</em></div>
          <button className="wizskip" onClick={onSkip}>Skip to full model →</button>
        </div>

        <ol className="wizsteps">
          {steps.map((s, i) => (
            <li key={s.key} className={i === step ? "on" : i < step ? "done" : ""}>
              <button onClick={() => i < step && setStep(i)} disabled={i > step}>
                <span className="wizstepnum">{i < step ? "✓" : i + 1}</span>
                <span className="wizsteplbl">{s.label}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="wizbody" key={cur.key}>{cur.render()}</div>

        <div className="wizbtns">
          {step > 0 ? <button className="wizback" onClick={() => setStep(step - 1)}>← Back</button> : <span />}
          {cur.isLast
            ? <button className="wiznext" onClick={finish}>View my results →</button>
            : <button className="wiznext" disabled={!cur.canNext()} onClick={() => setStep(step + 1)}>Continue →</button>}
        </div>
      </div>
    </div>
  );
}
