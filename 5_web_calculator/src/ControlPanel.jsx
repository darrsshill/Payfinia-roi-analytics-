// =====================================================================
// ControlPanel — the persistent left-hand panel.
//
// Every input the guided setup collects is editable here and the panel is
// mounted in both the client and analyst views, so a mistyped number is never
// a dead end and no one has to clear storage to start again.
// =====================================================================
import { useState } from "react";
import { LEGACY, SEGMENTS, SEG_META, APPETITE, PRESETS, SEG_MIX_DEFAULT, SEG_MIX_SRC, mixFromCustomers } from "./data.js";

const num = (x) => new Intl.NumberFormat("en-US").format(Math.round(x || 0));

const RAIL_LABEL = {
  "Check": "Checks",
  "Wire": "Wires",
  "Same-Day ACH": "Same-Day ACH",
  "ACH": "Standard ACH",
};

function NumField({ value, onChange, ...rest }) {
  const [txt, setTxt] = useState(num(value));
  const [focus, setFocus] = useState(false);
  return (
    <input
      className="cp-num" inputMode="numeric" value={focus ? txt : num(value)}
      onFocus={() => { setTxt(String(Math.round(value || 0))); setFocus(true); }}
      onChange={(e) => { setTxt(e.target.value); const n = parseFloat(e.target.value.replace(/[^0-9.]/g, "")); onChange(isNaN(n) ? 0 : n); }}
      onBlur={() => setFocus(false)}
      {...rest}
    />
  );
}

// A label/control pair laid out on one line so a column of numbers aligns.
function Row({ label, hint, children, wide }) {
  return (
    <div className={"cp-row" + (wide ? " wide" : "")}>
      <span className="cp-rowlbl">{label}{hint ? <em>{hint}</em> : null}</span>
      <span className="cp-rowctl">{children}</span>
    </div>
  );
}

function Section({ n, title, children, badge, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={"cp-sec" + (open ? " open" : "")}>
      <button className="cp-sechead" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="cp-secnum">{n}</span>
        <span className="cp-sectitle">{title}</span>
        {badge ? <span className="cp-badge">{badge}</span> : null}
        <span className="cp-caret" aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="cp-secbody">{children}</div>}
    </section>
  );
}

export default function ControlPanel({
  open, onToggle,
  bankName, setBankName, userName, setUserName,
  presetName, applyPreset,
  unit, setUnit,
  vol, setVolRail,
  customers, setCustomers,
  mix, setMixCell, resetMix,
  appetite, applyAppetite,
  subst, setSubstCell,
  oneTime, setOneTime, annual, setAnnual,
  disc, setDisc, horizon, setHorizon,
  onRestartWizard, onReset,
  activeSegment, setActiveSegment,
}) {
  const [mixMode, setMixMode] = useState("counts");   // counts | manual
  const mult = unit === "Monthly" ? 12 : 1;
  const totalItems = LEGACY.reduce((s, r) => s + (vol[r] || 0), 0);

  if (!open) {
    return (
      <button className="cp-fab" onClick={onToggle} title="Open the input panel">
        <span className="cp-fabicon" aria-hidden="true">☰</span>
        <span className="cp-fablabel">Inputs</span>
      </button>
    );
  }

  return (
    <aside className="cp" aria-label="Model inputs">
      <header className="cp-top">
        <div className="cp-topmain">
          <div className="cp-eyebrow">Model inputs</div>
          <div className="cp-title">Adjust anything, anytime</div>
        </div>
        <button className="cp-close" onClick={onToggle} title="Collapse panel" aria-label="Collapse panel">‹</button>
      </header>

      <div className="cp-scroll">
        <p className="cp-lede">Every answer from the guided setup lives here. Change one and results update instantly.</p>

        <Section n="1" title="Institution" defaultOpen>
          <Row label="Your name" wide>
            <input className="cp-txt" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="First name" />
          </Row>
          <Row label="Institution" wide>
            <input className="cp-txt" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Riverbend Credit Union" />
          </Row>
          <Row label="Size band" wide>
            <select className="cp-sel" value={presetName} onChange={(e) => applyPreset(e.target.value)}>
              {Object.keys(PRESETS).map((k) => <option key={k}>{k}</option>)}
              {!PRESETS[presetName] && <option>{presetName}</option>}
            </select>
          </Row>
        </Section>

        <Section n="2" title="Outbound volume" badge={unit} defaultOpen>
          <Row label="Enter as">
            <div className="cp-toggle">
              {["Annual", "Monthly"].map((u) => (
                <button key={u} className={unit === u ? "on" : ""} onClick={() => setUnit(u)}>{u}</button>
              ))}
            </div>
          </Row>
          {LEGACY.map((r) => (
            <Row key={r} label={RAIL_LABEL[r]}>
              <NumField value={(vol[r] || 0) / mult} onChange={(v) => setVolRail(r, v * mult)} />
            </Row>
          ))}
          <div className="cp-total">
            <span>Total outbound</span><b>{num(totalItems)} / yr</b>
          </div>
          <p className="cp-hint">Outbound only — items you originate. Incoming volume is set by the sender.</p>
        </Section>

        <Section n="3" title="Customer segments" badge={mixMode === "counts" ? "From counts" : "Manual"}>
          <p className="cp-hint">
            Volume on each rail is split across Retail · Business · Internal, and each segment is costed independently.
          </p>
          <div className="cp-toggle wide">
            <button className={mixMode === "counts" ? "on" : ""} onClick={() => setMixMode("counts")}>From counts</button>
            <button className={mixMode === "manual" ? "on" : ""} onClick={() => setMixMode("manual")}>Set mix directly</button>
          </div>

          {mixMode === "counts" ? (
            <>
              <Row label="Retail members">
                <NumField value={customers.retail} onChange={(v) => setCustomers({ ...customers, retail: v })} />
              </Row>
              <Row label="Small business">
                <NumField value={customers.smb} onChange={(v) => setCustomers({ ...customers, smb: v })} />
              </Row>
              <Row label="Mid-market">
                <NumField value={customers.midmarket} onChange={(v) => setCustomers({ ...customers, midmarket: v })} />
              </Row>
              <button className="cp-btn" onClick={() => resetMix(mixFromCustomers(customers))}>
                Recompute mix from counts
              </button>
              <p className="cp-hint tiny">
                Uses relative origination intensity per customer type — a mid-market client originates far more wires than a
                consumer. Those weights are an <b>estimate</b>; replace them with your own data when available.
              </p>
            </>
          ) : (
            <div className="cp-mixgrid">
              <div className="cp-mixhead">
                <span>Rail</span>
                {SEGMENTS.map((s) => <span key={s} title={SEG_META[s].blurb}>{s === "Internal" ? "Int." : s === "Business" ? "Bus." : "Ret."}</span>)}
                <span>Σ</span>
              </div>
              {LEGACY.map((rail) => {
                const row = mix[rail] || SEG_MIX_DEFAULT[rail];
                const tot = SEGMENTS.reduce((s, seg) => s + (+row[seg] || 0), 0);
                const bad = Math.abs(tot - 100) > 0.5;
                return (
                  <div className="cp-mixrow" key={rail}>
                    <span className="cp-mixlabel">
                      {RAIL_LABEL[rail]}
                      <em className={"cp-tag " + (SEG_MIX_SRC[rail]?.status === "Cited" ? "cited" : SEG_MIX_SRC[rail]?.status === "Estimate" ? "est" : "partly")}>
                        {SEG_MIX_SRC[rail]?.status}
                      </em>
                    </span>
                    {SEGMENTS.map((seg) => (
                      <input key={seg} className={"cp-pct" + (bad ? " bad" : "")} type="number" min="0" max="100"
                        value={row[seg]} onChange={(e) => setMixCell(rail, seg, +e.target.value)} />
                    ))}
                    <span className={"cp-mixsum" + (bad ? " bad" : "")}>{tot.toFixed(0)}</span>
                  </div>
                );
              })}
              <p className="cp-hint tiny">Each row must total 100%.</p>
            </div>
          )}
        </Section>

        <Section n="4" title="Migration appetite" badge={appetite}>
          <div className="cp-toggle wide">
            {Object.keys(APPETITE).map((a) => (
              <button key={a} className={appetite === a ? "on" : ""} onClick={() => applyAppetite(a)}>{a}</button>
            ))}
          </div>
          <p className="cp-hint">
            Business volume migrates more slowly than retail at the same appetite. Pick a segment and tune any rail.
          </p>
          <div className="cp-segtabs">
            {SEGMENTS.map((s) => (
              <button key={s} className={activeSegment === s ? "on" : ""} onClick={() => setActiveSegment(s)}
                style={activeSegment === s ? { borderColor: SEG_META[s].color, color: SEG_META[s].color } : undefined}>
                {SEG_META[s].label}
              </button>
            ))}
          </div>
          {LEGACY.map((r) => (
            <div className="cp-slider" key={r}>
              <span className="cp-slidertop">{RAIL_LABEL[r]}<b>{subst[activeSegment]?.[r] ?? 0}%</b></span>
              <input type="range" min="0" max="100" value={subst[activeSegment]?.[r] ?? 0}
                onChange={(e) => setSubstCell(activeSegment, r, +e.target.value)} />
            </div>
          ))}
        </Section>

        <Section n="5" title="Investment & finance">
          <Row label="One-time setup" hint="$"><NumField value={oneTime} onChange={setOneTime} /></Row>
          <Row label="Annual platform" hint="$ / yr"><NumField value={annual} onChange={setAnnual} /></Row>
          <div className="cp-slider">
            <span className="cp-slidertop">Discount rate<b>{disc}%</b></span>
            <input type="range" min="0" max="20" value={disc} onChange={(e) => setDisc(+e.target.value)} />
          </div>
          <div className="cp-slider">
            <span className="cp-slidertop">Horizon<b>{horizon} yr</b></span>
            <input type="range" min="1" max="10" value={horizon} onChange={(e) => setHorizon(+e.target.value)} />
          </div>
        </Section>
      </div>

      <footer className="cp-foot">
        <button className="cp-btn ghost" onClick={onRestartWizard}>Guided setup</button>
        <button className="cp-btn ghost danger" onClick={onReset}>Reset</button>
        <p className="cp-saved">Saved automatically in this browser</p>
      </footer>
    </aside>
  );
}
