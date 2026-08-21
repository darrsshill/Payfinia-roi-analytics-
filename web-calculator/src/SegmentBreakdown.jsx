// =====================================================================
// SegmentBreakdown — each customer segment is costed independently on its own
// stack, then aggregated. Shows which segment the savings actually come from.
// =====================================================================
import { SEGMENTS, SEG_META, LEGACY, SEG_SOURCING } from "./data.js";

const money = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(x || 0);
const money2 = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(x || 0);
const num = (x) => new Intl.NumberFormat("en-US").format(Math.round(x || 0));

const RAIL_LABEL = { "Check": "Checks", "Wire": "Wires", "Same-Day ACH": "Same-Day ACH", "ACH": "Standard ACH" };

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
        <h3>Savings by customer segment</h3>
        <p>
          Retail, business and internal payments carry different internal costs for the same rail, so each is costed on its
          own stack and then aggregated.
          {total > 0 && top && (
            <> Largest contributor: <b style={{ color: SEG_META[top].color }}>{SEG_META[top].label}</b> at{" "}
              <b>{money(result.segments[top].gross)}</b> per year — {Math.round((result.segments[top].gross / total) * 100)}% of gross savings.</>
          )}
        </p>
      </div>

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
          const totMig = s.rows.reduce((a, r) => a + r.migrated, 0);
          return (
            <div className="segcard" key={seg} style={{ borderTopColor: meta.color }}>
              <div className="segcardhead">
                <div className="segcardid">
                  <h4 style={{ color: meta.color }}>{meta.label}</h4>
                  <span className="segshort">{meta.short}</span>
                </div>
                <div className="segtotal">
                  <b>{money(s.gross)}</b>
                  <span>gross / yr</span>
                </div>
              </div>

              <div className="segstats">
                <div><span>Outbound volume</span><b>{num(totVol)}</b></div>
                <div><span>Migrating</span><b>{num(totMig)}</b></div>
                <div><span>Instant $/txn</span><b>{money2(s.instant)}</b></div>
              </div>

              <div className="tablewrap">
                <table className="dtbl segtable">
                  <colgroup>
                    <col style={{ width: "34%" }} /><col /><col /><col /><col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Rail</th>
                      <th scope="col" className="n">Cost / txn</th>
                      <th scope="col" className="n">Shift</th>
                      <th scope="col" className="n">Migrated</th>
                      <th scope="col" className="n">Savings / yr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r) => {
                      const src = SEG_SOURCING[seg]?.[r.rail];
                      return (
                        <tr key={r.rail} className={r.ann < 0 ? "neg" : ""}>
                          <th scope="row">
                            <span className="railname">{RAIL_LABEL[r.rail]}</span>
                            {src && <Tag status={src.status} />}
                          </th>
                          <td className="n" title={src?.basis}>{money2(r.legacy)}</td>
                          <td className="n">{r.pct}%</td>
                          <td className="n">{num(r.migrated)}</td>
                          <td className={"n" + (r.ann < 0 ? " negval" : "")}>
                            {r.ann < 0 ? "−" : ""}{money(Math.abs(r.ann))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Total</th>
                      <td className="n">—</td>
                      <td className="n">—</td>
                      <td className="n">{num(totMig)}</td>
                      <td className="n">{money(s.gross)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {s.rows.some((r) => r.ann < 0) && (
                <p className="segnote">
                  Negative rows are rails where instant costs <b>more</b> than the rail you would move off. Shifting those
                  destroys value — leave them in place.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
