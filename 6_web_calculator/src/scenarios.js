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

// ---- export: turn saved scenarios into customer-friendly downloadable files ----
// CSV, not JSON — opens directly in Excel/Sheets for bank & credit union staff.
export const slug = (s) => (s || "institution").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "institution";

const RAIL_LABEL_EXPORT = { "Check": "Checks", "Wire": "Wires", "Same-Day ACH": "Same-Day ACH", "ACH": "Standard ACH" };

// wrap a field in quotes if it needs it, doubling any internal quotes
const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRow = (cells) => cells.map(csvCell).join(",");
// match the app's on-screen precision instead of dumping raw floats
const fmt0 = (n) => (n == null || isNaN(n) ? "" : Math.round(n));
const fmt2 = (n) => (n == null || isNaN(n) ? "" : (+n).toFixed(2));

function downloadCSV(filename, csvText) {
  // BOM so Excel opens UTF-8 correctly
  const blob = new Blob(["﻿" + csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// one scenario/result as a readable report: summary block, then a rail-by-rail table
function scenarioToCSV(s) {
  const lines = [];
  lines.push(csvRow(["Payfinia — Instant Payments ROI"]));
  lines.push(csvRow(["Institution", s.bankName || ""]));
  lines.push(csvRow(["Scenario", s.name || ""]));
  lines.push(csvRow(["Saved", s.savedAt ? new Date(s.savedAt).toLocaleString() : ""]));
  lines.push("");
  lines.push(csvRow(["Inputs"]));
  lines.push(csvRow(["Outbound volume — Checks / yr", s.vol?.Check ?? ""]));
  lines.push(csvRow(["Outbound volume — Wires / yr", s.vol?.Wire ?? ""]));
  lines.push(csvRow(["Outbound volume — Same-Day ACH / yr", s.vol?.["Same-Day ACH"] ?? ""]));
  lines.push(csvRow(["Outbound volume — Standard ACH / yr", s.vol?.ACH ?? ""]));
  lines.push(csvRow(["Share moving to instant (%)", s.mig ?? ""]));
  lines.push(csvRow(["One-time setup cost ($)", s.oneTime ?? ""]));
  lines.push(csvRow(["Annual platform cost ($)", s.annual ?? ""]));
  lines.push(csvRow(["Discount rate (%)", s.disc ?? ""]));
  lines.push(csvRow(["Horizon (years)", s.horizon ?? ""]));
  lines.push("");
  lines.push(csvRow(["Results"]));
  lines.push(csvRow(["Net annual savings ($)", fmt0(s.result.net)]));
  lines.push(csvRow(["Gross annual savings ($)", fmt0(s.result.gross)]));
  lines.push(csvRow(["First-year ROI (%)", Math.round(s.result.roi * 100)]));
  lines.push(csvRow(["Payback (months)", s.result.payback == null ? "—" : s.result.payback.toFixed(1)]));
  lines.push(csvRow(["5-year value ($)", fmt0(s.result.npv)]));
  lines.push(csvRow(["Instant cost per transaction ($)", fmt2(s.result.instant)]));
  lines.push("");
  lines.push(csvRow(["By rail", "Cost per txn ($)", "Saved per txn ($)", "Payments migrated", "Annual savings ($)"]));
  s.result.rows.forEach((r) => {
    lines.push(csvRow([RAIL_LABEL_EXPORT[r.rail] || r.rail, fmt2(r.legacy), fmt2(r.per), fmt0(r.migrated), fmt0(r.ann)]));
  });
  return lines.join("\n");
}

export function exportScenario(s) {
  const date = new Date().toISOString().slice(0, 10);
  downloadCSV(`payfinia-roi-${slug(s.bankName)}-${slug(s.name)}-${date}.csv`, scenarioToCSV(s));
}

// the current, unsaved result on screen — same report shape as a saved scenario
export function exportCurrentResult({ bankName, userName, vol, mig, oneTime, annual, disc, horizon, result }) {
  const date = new Date().toISOString().slice(0, 10);
  const s = {
    bankName, userName, name: userName ? `Prepared for ${userName}` : "Current result",
    savedAt: new Date().toISOString(), mig, vol, oneTime, annual, disc, horizon, result,
  };
  downloadCSV(`payfinia-roi-${slug(bankName)}-${date}.csv`, scenarioToCSV(s));
}

// all saved scenarios as one table — one row per scenario, easy to sort/filter in Excel
export function exportAllScenarios(scenarios) {
  const date = new Date().toISOString().slice(0, 10);
  const header = [
    "Institution", "Scenario", "Saved", "Migration share (%)",
    "Net annual savings ($)", "Gross annual savings ($)", "First-year ROI (%)",
    "Payback (months)", "5-year value ($)", "Instant cost/txn ($)",
    "Checks savings ($)", "Wires savings ($)", "Same-Day ACH savings ($)", "Standard ACH savings ($)",
  ];
  const lines = [csvRow(header)];
  scenarios.forEach((s) => {
    const byRail = {}; s.result.rows.forEach((r) => { byRail[r.rail] = r.ann; });
    lines.push(csvRow([
      s.bankName || "", s.name || "", s.savedAt ? new Date(s.savedAt).toLocaleString() : "", s.mig ?? "",
      fmt0(s.result.net), fmt0(s.result.gross), Math.round(s.result.roi * 100),
      s.result.payback == null ? "—" : s.result.payback.toFixed(1), fmt0(s.result.npv), fmt2(s.result.instant),
      fmt0(byRail.Check || 0), fmt0(byRail.Wire || 0), fmt0(byRail["Same-Day ACH"] || 0), fmt0(byRail.ACH || 0),
    ]));
  });
  downloadCSV(`payfinia-roi-scenarios-${date}.csv`, lines.join("\n"));
}
