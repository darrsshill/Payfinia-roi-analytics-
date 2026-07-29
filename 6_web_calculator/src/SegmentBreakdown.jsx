// =====================================================================
// SegmentBreakdown — shows the modular result: each customer segment is
// costed independently, then aggregated.
//
// Nizar Jamal, 2026-07-28: "restructure the calculator into a modular format
// where cost components for different segments (Retail, Business, Internal)
// can be calculated independently and then aggregated."
// =====================================================================
import { SEGMENTS, SEG_META, LEGACY, SEG_SOURCING, railTotal } from "./data.js";

const money = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x || 0);
const money2 = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(x || 0);
const num = (x) => new Intl.NumberFormat("en-US").format(Math.round(x || 0));

function Tag({ status }) {
  const cls = status === "Cited" ? "tag cited" : status === "Estimate" ? "tag est" : status === "Derived" ? "tag derived" : "tag partly";
  return <span className={cls}>{status}</span>;
}

export default function SegmentBreakdown({ result, segCosts, volBySeg }) {
  const total = result.gross || 0;
  const ordered = [...SEGMENTS].sort((a, b) => (result.segments[b]?.gross || 0) - (result.segments[a]?.gross || 0));
  const top = ordered[0];

  return (
    <section className="segwrap">
      <div className="seghead">
        <h3>Where the savings come from — by customer segment</h3>
        <p>
          Each segment is costed on its own stack and aggregated. This replaces the flat per-rail cost, which charged a
          consumer ACH and a commercial wire the same internal cost.
          {total > 0 && top && (
            <> Biggest contributor: <b style={{ color: SEG_META[top].color }}>{SEG_META[top].label}</b> at{" "}
              <b>{money(result.segments[top].gross)}</b>/yr ({Math.round((result.segments[top].gross / total) * 100)}% of gross).</>
          )}
        </p>
      </div>

      {/* contribution bar */}
      {total > 0 && (
        <div className="segbar" role="img" aria-label="Share of gross savings by segment">
          {ordered.map((s) => {
            const g = result.segments[s]?.gross || 0;
            const pct = (g / total) * 100;
            if (pct <= 0) return null;
            return (
              <div key={s} className="segbarseg" style={{ width: pct + "%", background: SEG_META[s].color }}
                title={`${SEG_META[s].label}: ${money(g)} (${pct.toFixed(0)}%)`}>
                {pct > 9 && <span>{SEG_META[s].label} · {pct.toFixed(0)}%</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="segcards">
        {SEGMENTS.map((seg) => {
          const s = result.segments[seg];
          if (!s) return null;
          const meta = SEG_META[seg];
          const vols = volBySeg[seg] || {};
          const totVol = LEGACY.reduce((a, r) => a + (vols[r] || 0), 0);
          return (
            <div className="segcard" key={seg} style={{ borderTopColor: meta.color }}>
              <div className="segcardhead">
                <div>
                  <h4 style={{ color: meta.color }}>{meta.label}</h4>
                  <span className="segshort">{meta.short}</span>
                </div>
                <div className="segtotal">
                  <b>{money(s.gross)}</b>
                  <span>gross / yr</span>
                </div>
              </div>
              <p className="segblurb">{meta.blurb}</p>

              <div className="segstats">
                <div><span>Outbound volume</span><b>{num(totVol)}</b></div>
                <div><span>Instant cost / txn</span><b>{money2(s.instant)}</b></div>
              </div>

              <table className="segtable">
                <thead>
                  <tr><th>Rail</th><th>Cost / txn</th><th>Shift</th><th>Migrated</th><th>Savings / yr</th></tr>
                </thead>
                <tbody>
                  {s.rows.map((r) => {
                    const src = SEG_SOURCING[seg]?.[r.rail];
                    return (
                      <tr key={r.rail} className={r.ann < 0 ? "neg" : ""}>
                        <td>
                          {r.rail}
                          {src && <Tag status={src.status} />}
                        </td>
                        <td title={src?.basis}>{money2(r.legacy)}</td>
                        <td>{r.pct}%</td>
                        <td>{num(r.migrated)}</td>
                        <td className={r.ann < 0 ? "negval" : ""}>
                          {r.ann < 0 ? "−" : ""}{money(Math.abs(r.ann))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {s.rows.some((r) => r.ann < 0) && (
                <p className="segnote">
                  Negative rows are rails where instant costs <b>more</b> than the rail you'd move off. Shifting those
                  destroys value — keep them where they are.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
