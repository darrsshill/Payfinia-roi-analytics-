import { useState } from "react";
import { PRESETS } from "./data.js";

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
  const [mig, setMig] = useState(30);

  function pickSize(k) {
    setSizeKey(k); const pp = PRESETS[k];
    setChecks(pp.Check); setWires(pp.Wire); setOneTime(pp.oneTime); setAnnual(pp.annual);
  }

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
      key: "mig",
      render: () => (
        <>
          <div className="wizkicker">Step 3 · The switch</div>
          <h2>How much would you move to instant?</h2>
          <p className="wizsub">A realistic starting point is around a quarter to a third. You can fine-tune this on the results screen.</p>
          <div className="wizmig">
            <div className="wizmigval">{mig}%</div>
            <input type="range" min="0" max="100" value={mig} onChange={(e) => setMig(+e.target.value)} className="wizrange" />
            <div className="wizmiglabels"><span>Keep as-is</span><span>Move most of it</span></div>
          </div>
          <p className="wizsub" style={{ marginTop: 16 }}>You'd move <b>{mig}%</b> of your checks &amp; wires (≈ {num((checks + wires) * mig / 100)} payments) to instant.</p>
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
      subst: { Check: mig, Wire: mig, "Same-Day ACH": mig, ACH: 0 },
      mig, firstName: first.trim(), bank: bank.trim(),
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
