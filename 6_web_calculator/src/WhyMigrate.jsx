import { RAIL_COLOR, railTotal, LEGACY } from "./data.js";

const money2 = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(x);

// Valid, sourced reasons per rail. Honest: standard ACH says "don't migrate."
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
    "Standard ACH is already cheaper than instant — migrating it usually COSTS money.",
    "Keep routine, non-urgent payments here; move only the few that genuinely need instant speed or finality.",
    "This is where an honest model says 'don't switch' — which is what makes every other recommendation credible.",
  ],
};

function verdict(save) {
  if (save > 1.5) return { label: "Migrate — top priority", cls: "mv-strong" };
  if (save > 0.15) return { label: "Migrate", cls: "mv-good" };
  if (save > 0) return { label: "Consider", cls: "mv-consider" };
  return { label: "Keep on this rail", cls: "mv-keep" };
}

export default function WhyMigrate({ costs }) {
  const instant = railTotal(costs.Instant);
  return (
    <div className="whymig">
      {LEGACY.map((rail) => {
        const today = railTotal(costs[rail]);
        const save = today - instant;
        const v = verdict(save);
        return (
          <div className="mvcard" key={rail} style={{ borderTopColor: RAIL_COLOR[rail] }}>
            <div className="mvhead">
              <h4><span className="dot" style={{ background: RAIL_COLOR[rail] }} /> {rail === "ACH" ? "Standard ACH" : rail}</h4>
              <span className={"mvbadge " + v.cls}>{v.label}</span>
            </div>
            <div className="mvcost">
              <span className="mvleg">Today <b>{money2(today)}</b></span>
              <span className="mvarrow">→</span>
              <span className="mvleg">Instant <b>{money2(instant)}</b></span>
              <span className={"mvsave" + (save > 0 ? "" : " neg")}>{save > 0 ? `save ${money2(save)}/item` : `${money2(save)}/item`}</span>
            </div>
            <ul className="mvreasons">
              {REASONS[rail].map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
