// =====================================================================
// ControlPanel — the persistent left-hand panel.
//
// Nizar Jamal, 2026-07-28: "users who make input errors are currently forced
// to clear session tokens or restart the entire flow because the initial
// wizard lacks a mechanism to return to previous choices."
//
// This panel is mounted in BOTH the simple and advanced views and stays on
// screen at all times. Every input the wizard collects is editable here, so
// a mistake is never a dead end. Collapsible so it doesn't crowd the result.
// =====================================================================
import { useState } from "react";
import { LEGACY, SEGMENTS, SEG_META, APPETITE, PRESETS, SEG_MIX_DEFAULT, SEG_MIX_SRC, mixFromCustomers } from "./data.js";

const num = (x) => new Intl.NumberFormat("en-US").format(Math.round(x || 0));

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

function Section({ title, children, badge, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={"cp-sec" + (open ? " open" : "")}>
      <button className="cp-sechead" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="cp-caret">{open ? "▾" : "▸"}</span>
        <span className="cp-sectitle">{title}</span>
        {badge ? <span className="cp-badge">{badge}</span> : null}
      </button>
      {open && <div className="cp-secbody">{children}</div>}
    </div>
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

  if (!open) {
    return (
      <button className="cp-fab" onClick={onToggle} title="Open the control panel">
        <span>⚙</span><span className="cp-fablabel">Adjust inputs</span>
      </button>
    );
  }

  return (
    <aside className="cp">
      <div className="cp-top">
        <div>
          <div className="cp-eyebrow">Control panel</div>
          <div className="cp-title">Adjust anything, anytime</div>
        </div>
        <button className="cp-close" onClick={onToggle} title="Collapse">×</button>
      </div>
      <p className="cp-lede">Every answer from the guided setup lives here. Change one and the results update — you never have to start over.</p>

      <Section title="1 · Who you are" defaultOpen>
        <label className="cp-fld"><span>Your name</span>
          <input className="cp-txt" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="First name" /></label>
        <label className="cp-fld"><span>Institution</span>
          <input className="cp-txt" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Riverbend Credit Union" /></label>
        <label className="cp-fld"><span>Start from an example</span>
          <select className="cp-sel" value={presetName} onChange={(e) => applyPreset(e.target.value)}>
            {Object.keys(PRESETS).map((k) => <option key={k}>{k}</option>)}
            {!PRESETS[presetName] && <option>{presetName}</option>}
          </select></label>
      </Section>

      <Section title="2 · Outbound volume" badge={unit}>
        <div className="cp-unitrow">
          <span>Enter as</span>
          <div className="cp-toggle">
            {["Annual", "Monthly"].map((u) => (
              <button key={u} className={unit === u ? "on" : ""} onClick={() => setUnit(u)}>{u}</button>
            ))}
          </div>
        </div>
        {LEGACY.map((r) => (
          <label className="cp-fld" key={r}>
            <span>{r === "ACH" ? "Standard ACH" : r}</span>
            <NumField value={(vol[r] || 0) / mult} onChange={(v) => setVolRail(r, v * mult)} />
          </label>
        ))}
        <p className="cp-hint">Outbound only — payments you originate. What comes in is set by the sender.</p>
      </Section>

      <Section title="3 · Customer segments" badge={mixMode === "counts" ? "from counts" : "manual"}>
        <p className="cp-hint">
          Keith Riddle's ask: size the book by customer type, not just raw item counts. The mix below drives how each
          rail's volume is split across Retail · Business · Internal, and each is costed independently.
        </p>
        <div className="cp-toggle wide">
          <button className={mixMode === "counts" ? "on" : ""} onClick={() => setMixMode("counts")}>From customer counts</button>
          <button className={mixMode === "manual" ? "on" : ""} onClick={() => setMixMode("manual")}>Set mix directly</button>
        </div>

        {mixMode === "counts" ? (
          <>
            <label className="cp-fld"><span>Retail members / consumers</span>
              <NumField value={customers.retail} onChange={(v) => setCustomers({ ...customers, retail: v })} /></label>
            <label className="cp-fld"><span>Small business (SMB)</span>
              <NumField value={customers.smb} onChange={(v) => setCustomers({ ...customers, smb: v })} /></label>
            <label className="cp-fld"><span>Mid-market / commercial</span>
              <NumField value={customers.midmarket} onChange={(v) => setCustomers({ ...customers, midmarket: v })} /></label>
            <button className="cp-btn" onClick={() => resetMix(mixFromCustomers(customers))}>
              Recompute mix from these counts
            </button>
            <p className="cp-hint tiny">
              Uses relative origination intensity per customer type (a mid-market client originates far more wires than a
              consumer). Those weights are an <b>Estimate</b> — replace with the FI's own data when available.
            </p>
          </>
        ) : (
          <div className="cp-mixgrid">
            <div className="cp-mixhead">
              <span></span>
              {SEGMENTS.map((s) => <span key={s} title={SEG_META[s].blurb}>{SEG_META[s].label}</span>)}
            </div>
            {LEGACY.map((rail) => {
              const row = mix[rail] || SEG_MIX_DEFAULT[rail];
              const tot = SEGMENTS.reduce((s, seg) => s + (+row[seg] || 0), 0);
              return (
                <div className="cp-mixrow" key={rail}>
                  <span className="cp-mixlabel">
                    {rail}
                    <em className={"cp-tag " + (SEG_MIX_SRC[rail]?.status === "Cited" ? "cited" : SEG_MIX_SRC[rail]?.status === "Estimate" ? "est" : "partly")}>
                      {SEG_MIX_SRC[rail]?.status}
                    </em>
                  </span>
                  {SEGMENTS.map((seg) => (
                    <input key={seg} className={"cp-pct" + (Math.abs(tot - 100) > 0.5 ? " bad" : "")} type="number" min="0" max="100"
                      value={row[seg]} onChange={(e) => setMixCell(rail, seg, +e.target.value)} />
                  ))}
                  {Math.abs(tot - 100) > 0.5 && <span className="cp-mixwarn">{tot.toFixed(0)}%</span>}
                </div>
              );
            })}
            <p className="cp-hint tiny">Each row must total 100%.</p>
          </div>
        )}
      </Section>

      <Section title="4 · How much shifts to instant" badge={appetite}>
        <div className="cp-toggle wide">
          {Object.keys(APPETITE).map((a) => (
            <button key={a} className={appetite === a ? "on" : ""} onClick={() => applyAppetite(a)}>{a}</button>
          ))}
        </div>
        <p className="cp-hint">
          Business volume migrates more slowly than retail at the same appetite — contractual terms, AP file cycles and
          supplier onboarding all slow it down. Tune any cell below.
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
          <label className="cp-fld slider" key={r}>
            <span>{r} <b>{subst[activeSegment]?.[r] ?? 0}%</b></span>
            <input type="range" min="0" max="100" value={subst[activeSegment]?.[r] ?? 0}
              onChange={(e) => setSubstCell(activeSegment, r, +e.target.value)} />
          </label>
        ))}
      </Section>

      <Section title="5 · Investment & finance">
        <label className="cp-fld"><span>One-time setup ($)</span><NumField value={oneTime} onChange={setOneTime} /></label>
        <label className="cp-fld"><span>Annual platform ($/yr)</span><NumField value={annual} onChange={setAnnual} /></label>
        <label className="cp-fld slider"><span>Discount rate <b>{disc}%</b></span>
          <input type="range" min="0" max="20" value={disc} onChange={(e) => setDisc(+e.target.value)} /></label>
        <label className="cp-fld slider"><span>Horizon <b>{horizon} yr</b></span>
          <input type="range" min="1" max="10" value={horizon} onChange={(e) => setHorizon(+e.target.value)} /></label>
      </Section>

      <div className="cp-foot">
        <button className="cp-btn ghost" onClick={onRestartWizard}>↺ Guided setup</button>
        <button className="cp-btn ghost danger" onClick={onReset}>Reset all</button>
      </div>
      <p className="cp-saved">✓ Auto-saved in this browser</p>
    </aside>
  );
}
