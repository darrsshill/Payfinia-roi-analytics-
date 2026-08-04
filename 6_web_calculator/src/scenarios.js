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

// ---- export: turn saved scenarios into downloadable files ----
export const slug = (s) => (s || "institution").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "institution";

function scenarioToExport(s) {
  return {
    institution: s.bankName || null,
    scenarioName: s.name,
    savedAt: s.savedAt,
    migrationSharePct: s.mig,
    inputs: {
      outboundVolumeAnnual: s.vol,
      oneTimeSetupCost: s.oneTime,
      annualPlatformCost: s.annual,
      discountRatePct: s.disc,
      horizonYears: s.horizon,
    },
    results: {
      netAnnualSavings: s.result.net,
      grossAnnualSavings: s.result.gross,
      firstYearRoiPct: Math.round(s.result.roi * 100),
      paybackMonths: s.result.payback,
      fiveYearValue: s.result.npv,
      instantCostPerTxn: s.result.instant,
      byRail: s.result.rows,
    },
  };
}

function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function exportScenario(s) {
  const date = new Date().toISOString().slice(0, 10);
  downloadJSON(`payfinia-roi-${slug(s.bankName)}-${slug(s.name)}-${date}.json`, scenarioToExport(s));
}

export function exportAllScenarios(scenarios) {
  const date = new Date().toISOString().slice(0, 10);
  downloadJSON(`payfinia-roi-scenarios-${date}.json`, scenarios.map(scenarioToExport));
}
