import { useState } from "react";
import { PRESETS, APPETITE, SEGMENTS, SEG_META, LEGACY, mixFromCustomers } from "./data.js";

const num = (x) => new Intl.NumberFormat("en-US").format(Math.round(x || 0));

// comma-formatted numeric input
function WNum({ value, onChange }) {
  const [txt, setTxt] = useState(num(value));
  return (
    <input className="wizinput" inputMode="numeric" value={txt} autoFocus
      onChange={(e) => { setTxt(e.target.value); const n = parseFloat(e.target.value.replace(/[^0-9.]/g, "")); onChange(isNaN(n) ? 0 : n); }}
      onBlur={() => setTxt(num(value))} />
  );
}

const SIZE_KEYS = Object.keys(PRESETS);

export default function Wizard({ onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [first, setFirst] = useState("");
  const [bank, setBank] = useState("");
  const [sizeKey, setSizeKey] = useState("Mid CFI (~$1B)");
  const p = PRESETS[sizeKey];
  const [checks, setChecks] = useState(p.Check);
  const [wires, setWires] = useState(p.Wire);
  const [sdach] = useState(p["Same-Day ACH"]);
  const [ach] = useState(p.ACH);
  const [oneTime, setOneTime] = useState(p.oneTime);
  const [annual, setAnnual] = useState(p.annual);
  const [appetite, setAppetite] = useState("Moderate");

  // Keith Riddle, 2026-07-28: "improve the front-end data collection by asking
  // for segmentation details like the number of retail users, SMBs, and
  // mid-market customers served, rather than just raw check and wire counts."
  const [cust, setCust] = useState({ ...p.customers });

  function pickSize(k) {
    setSizeKey(k); const pp = PRESETS[k];
    setChecks(pp.Check); setWires(pp.Wire); setOneTime(pp.oneTime); setAnnual(pp.annual);
    if (pp.customers) setCust({ ...pp.customers });
  }

  const mix = mixFromCustomers(cust);

  const steps = [
    {
      key: "welcome",
      render: () => (
        <>
          <div className="wizkicker">👋 Welcome</div>
          <h2>Let's see what your bank could save on instant payments.</h2>
          <p className="wizsub">Three quick questions — about a minute. First, what should we call you?</p>
          <label className="wizfull">Your name
            <input className="wizinput" autoFocus value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Jordan" /></label>
        </>
      ),
      canNext: () => first.trim().length > 0,
    },
    {
      key: "bank",
      render: () => (
        <>
          <div className="wizkicker">Nice to meet you{first ? `, ${first}` : ""}</div>
          <h2>Tell us about your institution.</h2>
          <p className="wizsub">Pick the size that fits — it just fills in typical numbers you'll confirm next.</p>
          <label className="wizfull">Bank / credit union name <em>(optional)</em>
            <input className="wizinput" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="e.g. Riverbend Community Bank" /></label>
          <div className="sizegrid" style={{ marginTop: 14 }}>
            {SIZE_KEYS.map((k) => (
              <button key={k} className={"sizebtn" + (sizeKey === k ? " on" : "")} onClick={() => pickSize(k)}>
                <b>{PRESETS[k].label}</b>
                <span>≈ {num(PRESETS[k].Check)} checks · {num(PRESETS[k].Wire)} wires / yr</span>
              </button>
            ))}
          </div>
        </>
      ),
      canNext: () => true,
    },
    {
      key: "vol",
      render: () => (
        <>
          <div className="wizkicker">Step 2 · What you send</div>
          <h2>How many checks and wires do you send a year?</h2>
          <p className="wizsub">These are the payments you <b>send out</b> — the expensive ones instant can replace. We pre-filled typical numbers; change them to yours if you know them.</p>
          <div className="wiztwo">
            <label>Checks sent / year<WNum value={checks} onChange={setChecks} /></label>
            <label>Wires sent / year<WNum value={wires} onChange={setWires} /></label>
          </div>
        </>
      ),
      canNext: () => true,
    },
    {
      key: "segments",
      render: () => (
        <>
          <div className="wizkicker">Step 3 · Who you serve</div>
          <h2>How is your customer base split?</h2>
          <p className="wizsub">
            A commercial wire costs far more to process than a consumer one — positive pay, callbacks, dual control. So we
            cost <b>Retail</b>, <b>Business</b> and <b>Internal</b> payments separately rather than averaging them together.
            Rough counts are fine.
          </p>
          <div className="wizthree">
            <label>Retail members<WNum value={cust.retail} onChange={(v) => setCust({ ...cust, retail: v })} /></label>
            <label>Small business<WNum value={cust.smb} onChange={(v) => setCust({ ...cust, smb: v })} /></label>
            <label>Mid-market<WNum value={cust.midmarket} onChange={(v) => setCust({ ...cust, midmarket: v })} /></label>
          </div>
          <div className="wizmixpreview">
            <div className="wizmixhead">Implied split of your outbound volume</div>
            {LEGACY.map((rail) => (
              <div className="wizmixrow" key={rail}>
                <span className="wizmixrail">{rail}</span>
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
            <div className="wizmixkey">
              {SEGMENTS.map((s) => (
                <span key={s}><i style={{ background: SEG_META[s].color }} />{SEG_META[s].label}</span>
              ))}
            </div>
          </div>
        </>
      ),
      canNext: () => true,
    },
    {
      key: "mig",
      render: () => (
        <>
          <div className="wizkicker">Step 4 · The switch</div>
          <h2>How fast would you move?</h2>
          <p className="wizsub">
            Business volume migrates more slowly than retail at the same appetite — contract terms, AP file cycles and
            supplier onboarding all slow it down. We apply a realistic rate to each segment rather than one blanket number.
            Fine-tune any of it on the results screen.
          </p>
          <div className="wizappetite">
            {Object.keys(APPETITE).map((a) => (
              <button key={a} className={"sizebtn" + (appetite === a ? " on" : "")} onClick={() => setAppetite(a)}>
                <b>{a}</b>
                <span>
                  Retail {APPETITE[a].Retail.Check}–{APPETITE[a].Retail.Wire}% · Business {APPETITE[a].Business.Check}–{APPETITE[a].Business.Wire}%
                </span>
              </button>
            ))}
          </div>
          <p className="wizsub" style={{ marginTop: 16 }}>
            At <b>{appetite}</b>, you'd move roughly <b>{num(
              LEGACY.reduce((s, rail) => {
                const v = rail === "Check" ? checks : rail === "Wire" ? wires : rail === "Same-Day ACH" ? sdach : ach;
                return s + SEGMENTS.reduce((t, seg) => t + v * ((mix[rail]?.[seg] || 0) / 100) * (APPETITE[appetite][seg][rail] / 100), 0);
              }, 0)
            )}</b> payments a year to instant.
          </p>
        </>
      ),
      canNext: () => true,
      isLast: true,
    },
  ];

  const cur = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  function finish() {
    onComplete({
      vol: { Check: checks, Wire: wires, "Same-Day ACH": sdach, ACH: ach },
      oneTime, annual,
      appetite,
      customers: cust,
      mix,
      firstName: first.trim(), bank: bank.trim(),
    });
  }

  return (
    <div className="wizard">
      <div className="wizcard">
        <div className="wiztop">
          <div className="wizbrand">PAYFINIA · SAVINGS ESTIMATE</div>
          <button className="wizskip" onClick={onSkip}>Skip →</button>
        </div>
        <div className="wizbar"><div className="wizbarfill" style={{ width: `${progress}%` }} /></div>

        <div className="wizbody" key={cur.key}>{cur.render()}</div>

        <div className="wizbtns">
          {step > 0 ? <button className="wizback" onClick={() => setStep(step - 1)}>← Back</button> : <span />}
          {cur.isLast
            ? <button className="wiznext" onClick={finish}>See my savings →</button>
            : <button className="wiznext" disabled={!cur.canNext()} onClick={() => setStep(step + 1)}>Continue →</button>}
        </div>
      </div>
    </div>
  );
}
