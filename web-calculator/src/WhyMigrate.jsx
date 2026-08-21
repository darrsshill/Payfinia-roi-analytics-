import { RAIL_COLOR, LEGACY, SEG_META, effTotal, railTotal } from "./data.js";

const money2 = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(x);

// Valid, sourced reasons per rail. The ACH entry deliberately says "don't migrate".
const REASONS = {
  "Check": [
    "Most-defrauded instrument — 58% of organizations are hit (AFP Fraud Survey).",
    "Clears in days and can still bounce; an instant payment settles in seconds and is final.",
    "Eliminates printing, postage, manual handling and slow, drawn-out reconciliation.",
  ],
  "Wire": [
    "By far the most expensive rail to send — instant delivers the same real-time, final settlement for a fraction of the cost.",
    "Manual, high-touch process bound by cutoff windows; instant runs 24/7/365.",
    "25% of organizations are targeted for wire fraud, with high value at risk per item.",
  ],
  "Same-Day ACH": [
    "Still moves in scheduled batch windows and isn't truly final; instant is real-time and irrevocable.",
    "Modest per-item savings, but a real upgrade for time-sensitive payments.",
    "Available nights, weekends and holidays — not just banking hours.",
  ],
  "ACH": [
    "Standard ACH is already cheaper per item than instant — migrating it in bulk destroys value.",
    "Keep routine, non-urgent payments here; move only the few that genuinely need speed or finality.",
    "The model recommends against switching this rail, which is what makes the other recommendations credible.",
  ],
};

const RAIL_LABEL = { "Check": "Checks", "Wire": "Wires", "Same-Day ACH": "Same-Day ACH", "ACH": "Standard ACH" };

function verdict(save) {
  if (save > 1.5) return { label: "Migrate — top priority", cls: "mv-strong" };
  if (save > 0.15) return { label: "Migrate", cls: "mv-good" };
  if (save > 0) return { label: "Consider", cls: "mv-consider" };
  return { label: "Keep on this rail", cls: "mv-keep" };
}

// `ov` (per-rail all-in overrides) and `segment` must be threaded through, or
// these cards silently disagree with the headline result: everything else in
// the model resolves cost via effTotal, which lets a typed override win over
// the built-up component stack.
export default function WhyMigrate({ costs, ov, segment }) {
  const instant = effTotal(costs, ov, "Instant");
  const rows = LEGACY.map((rail) => {
    const today = effTotal(costs, ov, rail);
    return { rail, today, save: today - instant };
  });

  // If instant costs more than most of the rails you'd move off, the comparison
  // is being driven by the cost assumptions rather than by the rails. Say so
  // rather than rendering four "keep" badges and letting the reader conclude
  // the model is broken.
  const cheaperRails = rows.filter((r) => r.save <= 0);
  const suspect = cheaperRails.length >= 2;

  return (
    <>
      <div className="mvcontext">
        <span className="mvctxseg">
          <i style={{ background: SEG_META[segment]?.color || "var(--muted)" }} />
          {`${SEG_META[segment]?.label || segment} segment`}
        </span>
        <span className="mvctxinstant">Instant all-in <b>{money2(instant)}</b> / item</span>
        {ov && Object.values(ov).some((v) => v !== "" && !isNaN(+v)) && (
          <span className="mvctxov">Manual override in effect</span>
        )}
      </div>

      {suspect && (
        <div className="mvwarn">
          <b>Check your instant cost assumption.</b> At <b>{money2(instant)}</b> per item, instant is more expensive than{" "}
          {cheaperRails.length} of the {rows.length} rails below, so most cards read “keep”. That usually means a
          high-touch cost band is applied to this segment while the legacy rails sit at their median — the two are not
          measured on the same basis. Set the instant figure on the <b>Cost assumptions</b> tab before using these
          recommendations.
        </div>
      )}

      <div className="whymig">
        {rows.map(({ rail, today, save }) => {
          const v = verdict(save);
          const keep = save <= 0;
          return (
            <div className="mvcard" key={rail} style={{ borderTopColor: RAIL_COLOR[rail] }}>
              <div className="mvhead">
                <h4><span className="dot" style={{ background: RAIL_COLOR[rail] }} /> {RAIL_LABEL[rail] || rail}</h4>
                <span className={"mvbadge " + v.cls}>{v.label}</span>
              </div>
              <div className="mvcost">
                <span className="mvleg"><i>Today</i><b>{money2(today)}</b></span>
                <span className="mvarrow" aria-hidden="true">→</span>
                <span className="mvleg"><i>Instant</i><b>{money2(instant)}</b></span>
                <span className={"mvsave" + (save > 0 ? "" : " neg")}>
                  {save > 0 ? `${money2(save)} saved` : money2(save)}<i>per item</i>
                </span>
              </div>
              <ul className="mvreasons">
                {keep && rail !== "ACH" && (
                  <li className="mvcaveat">
                    On cost alone this rail stays put: {money2(today)} today against {money2(instant)} instant. The
                    qualitative case below still holds — speed, finality and fraud exposure — but it does not pay for
                    itself at these assumptions.
                  </li>
                )}
                {REASONS[rail].map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}

// Kept for callers that only have a flat cost table and no overrides.
export { railTotal };
