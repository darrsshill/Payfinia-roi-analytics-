// =====================================================================
// Payfinia ROI Calculator — sourced data + shared model logic
// v3 — client feedback (Justin & Nizar):
//   • Cost is split into 3 LAYERS: Network fee · Provider (Payfinia/TPSP)
//     fee · the FI's own internal cost.
//   • Numbers can be built from things a bank actually knows (mini-calcs).
//   • Migration = OUTBOUND volume the FI originates (only what they control).
//   • Instant Payments (FedNow + RTP) is ONE destination.
// Every figure is a real, cited public statistic. Mirrors roi_model.py.
// =====================================================================

export const U = {
  FRPS: "https://www.federalreserve.gov/paymentsystems/fr-payments-study.htm",
  AFP: "https://www.financialprofessionals.org/training-resources/resources/survey-research-economic-data/details/payments-fraud",
  NACHA: "https://www.nacha.org/content/ach-network-volume-and-value-statistics",
  FEDWIRE: "https://www.frbservices.org/resources/financial-services/wires/volume-value-stats/annual-stats.html",
  FEDNOW: "https://www.frbservices.org/resources/financial-services/fednow/volume-value-stats",
  FEDNOW_ORG: "https://www.frbservices.org/financial-services/fednow/organizations",
  FEDNOW_FEE: "https://www.frbservices.org/resources/fees/fednow-2026",
  RTP: "https://www.theclearinghouse.org/payment-systems/rtp",
  RTP_INST: "https://www.theclearinghouse.org/payment-systems/rtp/institution",
  FFIEC: "https://ithandbook.ffiec.gov/it-booklets/retail-payment-systems/",
  REGII: "https://www.federalreserve.gov/paymentsystems/regii-about.htm",
  PIX: "https://paymentscmi.com/insights/pix-in-brazil-latest-statistics-central-bank/",
  NCUA: "https://mapping.ncua.gov/",
  FDIC: "https://banks.data.fdic.gov/bankfind-suite/",
};

export const RAILS = ["Check", "Wire", "Same-Day ACH", "ACH", "Instant"];
export const LEGACY = ["Check", "Wire", "Same-Day ACH", "ACH"];

// Each rail's cost, grouped into 3 layers. failure cost = rate x cost_per_failure.
// Provider fee applies ONLY to Instant — Payfinia charges for the instant product,
// not for the FI's existing check / wire / ACH rails. So provider = 0 on legacy rails.
export const DEFAULTS = {
  "Check":        { network: 0.03,  provider: 0.00, processing: 2.00, failure_rate: 0.015, cost_per_failure: 8.00, fraud_loss: 0.40, fraud_prevention: 0.10, compliance: 0.03, reconciliation: 0.30, liquidity: 0.00 },
  "Wire":         { network: 0.82,  provider: 0.00, processing: 12.00, failure_rate: 0.010, cost_per_failure: 25.00, fraud_loss: 2.00, fraud_prevention: 1.00, compliance: 2.00, reconciliation: 0.50, liquidity: 0.00 },
  "Same-Day ACH": { network: 0.05,  provider: 0.00, processing: 0.80, failure_rate: 0.015, cost_per_failure: 6.00, fraud_loss: 0.15, fraud_prevention: 0.10, compliance: 0.05, reconciliation: 0.10, liquidity: 0.00 },
  "ACH":          { network: 0.005, provider: 0.00, processing: 0.15, failure_rate: 0.015, cost_per_failure: 4.00, fraud_loss: 0.05, fraud_prevention: 0.05, compliance: 0.03, reconciliation: 0.05, liquidity: 0.00 },
  "Instant":      { network: 0.045, provider: 0.10, processing: 0.10, failure_rate: 0.005, cost_per_failure: 5.00, fraud_loss: 0.25, fraud_prevention: 0.15, compliance: 0.10, reconciliation: 0.05, liquidity: 0.00 },
};

// Editable component fields, tagged by layer.
export const COMP_FIELDS = [
  { key: "network", label: "Network fee", layer: "Network", kind: "$" },
  { key: "provider", label: "Provider fee (Payfinia / TPSP)", layer: "Provider", kind: "$" },
  { key: "processing", label: "Processing / labor", layer: "Internal", kind: "$" },
  { key: "failure_rate", label: "Failure/return rate", layer: "Internal", kind: "%" },
  { key: "cost_per_failure", label: "Cost per failed item", layer: "Internal", kind: "$" },
  { key: "fraud_loss", label: "Fraud loss", layer: "Internal", kind: "$" },
  { key: "fraud_prevention", label: "Fraud prevention", layer: "Internal", kind: "$" },
  { key: "compliance", label: "Compliance (AML)", layer: "Internal", kind: "$" },
  { key: "reconciliation", label: "Reconciliation", layer: "Internal", kind: "$" },
  { key: "liquidity", label: "Liquidity / prefunding", layer: "Internal", kind: "$" },
];

export const SUBST_DEFAULT = { "Check": 25, "Wire": 30, "Same-Day ACH": 20, "ACH": 5 };
export const APPETITE = {
  "Conservative": { "Check": 15, "Wire": 15, "Same-Day ACH": 10, "ACH": 3 },
  "Moderate":     { "Check": 25, "Wire": 30, "Same-Day ACH": 20, "ACH": 5 },
  "Aggressive":   { "Check": 40, "Wire": 45, "Same-Day ACH": 30, "ACH": 8 },
};
// Volumes below are OUTBOUND (originated) annual counts — what the FI controls.
export const PRESETS = {
  "Small CFI (~$200M)": { label: "Small (~$200M assets)", "Check": 120000, "Wire": 2000, "Same-Day ACH": 30000, "ACH": 400000, oneTime: 60000, annual: 30000 },
  "Mid CFI (~$1B)":     { label: "Mid (~$1B assets)", "Check": 600000, "Wire": 12000, "Same-Day ACH": 150000, "ACH": 2500000, oneTime: 150000, annual: 60000 },
  "Large CFI (~$5B)":   { label: "Large (~$5B assets)", "Check": 3000000, "Wire": 60000, "Same-Day ACH": 800000, "ACH": 14000000, oneTime: 350000, annual: 150000 },
};

// per cost line: { publisher, supports, url, asOf, status, layer }
export const SRC = {
  "Network fee": { layer: "Network", publisher: "Federal Reserve & The Clearing House fee schedules", supports: "FedNow & RTP $0.045/credit transfer; Fedwire $0.97 gross (~$0.78 discounted)", url: U.FEDNOW_FEE, asOf: "2025–2026", status: "Cited" },
  "Provider fee (Payfinia / TPSP)": { layer: "Provider", publisher: "Third-party service provider pricing (Payfinia to set)", supports: "Hosting + per-transaction send/receive fees the provider charges the FI", url: U.FEDNOW_FEE, asOf: "—", status: "Estimate" },
  "Processing / labor": { layer: "Internal", publisher: "Bank's own staff & systems (build from your numbers)", supports: "Staff time to originate/handle one item — derive from FTEs × salary ÷ volume", url: U.NACHA, asOf: "2024", status: "Estimate" },
  "Failure & exception": { layer: "Internal", publisher: "Nacha Operating Rules; your processor", supports: "Return rate ~1.5% (Nacha); or enter your own failed-item count", url: U.NACHA, asOf: "2024–2025", status: "Partly cited" },
  "Fraud loss": { layer: "Internal", publisher: "AFP Fraud Survey; or your fraud $ ÷ volume", supports: "Incidence cited (check 58%, ACH 30%, wire 25%); enter your own $ loss to calibrate", url: U.AFP, asOf: "2025", status: "Partly cited" },
  "Fraud prevention": { layer: "Internal", publisher: "AFP survey / fraud-tooling vendors", supports: "Real-time screening & monitoring per item", url: U.AFP, asOf: "2025", status: "Estimate" },
  "Compliance (AML)": { layer: "Internal", publisher: "FFIEC BSA/AML; Fed Reg II", supports: "AML/OFAC screening per item", url: U.REGII, asOf: "current (12 CFR 235)", status: "Partly cited" },
  "Reconciliation": { layer: "Internal", publisher: "FFIEC / exception-management research", supports: "Matching & breaks handling per item", url: U.FFIEC, asOf: "2024", status: "Estimate" },
  "Liquidity / prefunding": { layer: "Internal", publisher: "Federal Reserve FedNow / TCH RTP", supports: "Prefunding / liquidity carrying cost (24/7 settlement)", url: U.FEDNOW, asOf: "2025", status: "Estimate" },
};
export const SUBST_SRC = { publisher: "Banco Central do Brasil (Pix) & Pay.UK", url: U.PIX, asOf: "2024" };
export const GROUNDING_SRC = { publisher: "NCUA call reports (credit unions) & FDIC (banks)", url: U.NCUA, asOf: "2025" };

export const RAIL_FACTS = {
  "Check": [
    ["Volume", "~3.0 billion commercial checks (Reserve Banks), down 5.4% YoY", "2024", "Federal Reserve Payments Study", U.FRPS],
    ["Consumer use", "7% of consumers paid by check (was 19% in 2020)", "2024", "Federal Reserve", U.FRPS],
    ["Fraud", "58% of organizations targeted — the most of any instrument", "2025", "AFP Payments Fraud Survey", U.AFP],
    ["Fully-loaded cost", "~$2.98 per transaction (model)", "2025 est.", "Estimate — Deliverable 1", U.NACHA],
  ],
  "Wire": [
    ["Volume", "209.9 million Fedwire Funds transfers", "2024", "Fedwire Funds Service Annual Statistics", U.FEDWIRE],
    ["Value", "$1.133 quadrillion; average $5.4 million per transfer", "2024", "Fedwire Annual Statistics", U.FEDWIRE],
    ["Fee", "$0.97 gross (~$0.78 with small-volume discount)", "2026 schedule", "Federal Reserve fee schedule", U.FEDNOW_FEE],
    ["Fraud", "25% of organizations targeted; high value-at-risk", "2025", "AFP Payments Fraud Survey", U.AFP],
    ["Fully-loaded cost", "~$18.57 per transaction (model)", "2025 est.", "Estimate — Deliverable 1", U.FEDWIRE],
  ],
  "Same-Day ACH": [
    ["Volume", "1.4 billion payments", "2025", "Nacha", U.NACHA],
    ["Value", "$3.9 trillion", "2025", "Nacha", U.NACHA],
    ["Growth", "+16.7% volume / +21.4% value YoY", "2025", "Nacha", U.NACHA],
    ["Fully-loaded cost", "~$1.34 per transaction (model)", "2025 est.", "Estimate — Deliverable 1", U.NACHA],
  ],
  "ACH": [
    ["Volume", "35.2 billion payments", "2025", "Nacha", U.NACHA],
    ["Value", "$93.1 trillion", "2025", "Nacha", U.NACHA],
    ["Growth", "+4.9% volume YoY", "2025", "Nacha", U.NACHA],
    ["Fraud", "ACH debit: 30% of organizations targeted", "2025", "AFP Payments Fraud Survey", U.AFP],
    ["Fully-loaded cost", "~$0.40 per transaction (model)", "2025 est.", "Estimate — Deliverable 1", U.NACHA],
  ],
  "Instant": [
    ["FedNow settled (2025)", "8.4 million payments (up from 1.5M in 2024); $853.4B; +460% YoY", "2025", "Federal Reserve — FedNow", U.FEDNOW],
    ["FedNow participants", "1,600 financial institutions, all 50 states", "2025", "Federal Reserve", U.FEDNOW_ORG],
    ["RTP volume (2025)", "~1.2 million payments/day; Q2: 107M txns / $481B", "2025", "The Clearing House", U.RTP],
    ["RTP participants", "1,031 institutions; 94% under $10B assets; 72%+ account reach", "Aug 2025", "The Clearing House", U.RTP_INST],
    ["Pricing", "$0.045 per credit transfer (both FedNow & RTP)", "2025–2026", "Fed / TCH fee schedules", U.FEDNOW_FEE],
    ["Fully-loaded cost", "~$0.82 per transaction (incl. provider fee)", "2025 est.", "Estimate — Deliverable 1", U.FEDNOW],
  ],
};
export const RAIL_COLOR = { "Check": "#E76F51", "Wire": "#F4A259", "Same-Day ACH": "#2E5496", "ACH": "#9AA7C7", "Instant": "#2EC4B6" };

// ---------- shared model logic ----------
export const railTotal = (c) =>
  c.network + c.provider + c.processing + c.failure_rate * c.cost_per_failure +
  c.fraud_loss + c.fraud_prevention + c.compliance + c.reconciliation + c.liquidity;

export const layerTotals = (c) => ({
  network: c.network,
  provider: c.provider,
  internal: c.processing + c.failure_rate * c.cost_per_failure + c.fraud_loss +
            c.fraud_prevention + c.compliance + c.reconciliation + c.liquidity,
});

// effective per-txn cost: a user override (typed all-in number) wins over the
// bottom-up component stack. Empty / invalid override => use the stack.
export const effTotal = (costs, ov, rail) => {
  const o = ov && ov[rail];
  return (o !== undefined && o !== null && o !== "" && !isNaN(+o)) ? +o : railTotal(costs[rail]);
};

// volumes are ANNUAL, outbound. subst in %. ov = optional per-rail total overrides.
export function runBottomUp(vol, costs, subst, oneTime, annual, disc, horizon, ov) {
  const instant = effTotal(costs, ov, "Instant");
  let gross = 0;
  const rows = LEGACY.map((rail) => {
    const legacy = effTotal(costs, ov, rail);
    const per = legacy - instant;
    const migrated = vol[rail] * (subst[rail] / 100);
    const ann = migrated * per;
    gross += ann;
    return { rail, legacy, per, migrated, ann };
  });
  const net = gross - annual;
  const roi = oneTime ? net / oneTime : 0;
  const payback = net > 0 ? (oneTime / net) * 12 : Infinity;
  const af = (1 - Math.pow(1 + disc / 100, -horizon)) / (disc / 100);
  const npv = net * af - oneTime;
  return { instant, gross, net, roi, payback, npv, rows };
}

// implied total annual cost to support ALL current volume (the sanity check)
export function impliedTotalCost(vol, costs, ov) {
  return LEGACY.reduce((s, rail) => s + vol[rail] * effTotal(costs, ov, rail), 0);
}
