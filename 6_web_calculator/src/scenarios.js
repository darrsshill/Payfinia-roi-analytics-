// =====================================================================
// Saved scenarios ("versions") — a bank can save an estimate and compare
// several configurations side by side.
//
// Today this persists to the browser (localStorage). It is written as a
// small data-access layer so that swapping in a real database later means
// changing ONLY this file — the UI calls loadScenarios/addScenario/etc.
// and doesn't care where the data lives. See DATABASE_SETUP.md.
// =====================================================================

const SC_KEY = "payfinia_scenarios_v1";

export function loadScenarios() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    return JSON.parse(window.localStorage.getItem(SC_KEY)) || [];
  } catch { return []; }
}

function persist(list) {
  try { window.localStorage.setItem(SC_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

// snapshot: everything needed to (a) reload into the calculator and
// (b) display the saved result without recomputing.
export function makeScenario(name, snap) {
  const r = snap.result;
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
    name: name && name.trim() ? name.trim() : (snap.bankName || "Scenario") + ` · ${snap.mig}%`,
    savedAt: new Date().toISOString(),
    bankName: snap.bankName || "",
    mig: snap.mig,
    // inputs (to reload)
    vol: snap.vol, costs: snap.costs, subst: snap.subst, overrides: snap.overrides || {},
    oneTime: snap.oneTime, annual: snap.annual, disc: snap.disc, horizon: snap.horizon,
    // result (to display) — payback Infinity -> null so it survives JSON
    result: {
      net: r.net, gross: r.gross, roi: r.roi, npv: r.npv, instant: r.instant,
      payback: r.payback === Infinity ? null : r.payback,
      rows: r.rows.map((x) => ({ rail: x.rail, ann: x.ann, per: x.per, migrated: x.migrated, legacy: x.legacy })),
    },
  };
}

export function addScenario(sc) { const list = loadScenarios(); list.unshift(sc); persist(list); return list; }
export function removeScenario(id) { const list = loadScenarios().filter((s) => s.id !== id); persist(list); return list; }
export function clearScenarios() { persist([]); return []; }
