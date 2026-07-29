// =====================================================================
// Payfinia ROI Calculator — sourced data + shared model logic
// v4 — client feedback (Keith Riddle & Nizar Jamal, meeting 2026-07-28):
//   • Cost is MODULAR BY CUSTOMER SEGMENT: Retail · Business · Internal (FI).
//     Each segment is costed independently, then aggregated. This replaces
//     the single flat cost per rail, which understated B2B cost badly.
//   • Cost is still split into 3 LAYERS within each segment:
//     Network fee · Provider (Payfinia/TPSP) fee · the FI's own internal cost.
//   • Numbers can be built from things a bank actually knows (mini-calcs),
//     now including the FRACTION of an FTE's time spent on a given rail.
//   • Migration = OUTBOUND volume the FI originates (only what they control).
//   • Instant Payments (FedNow + RTP) is ONE destination.
//
// SOURCING RULE: every figure is either (a) a published public statistic with
// a verify link, (b) DERIVED from one by an arithmetic rule stated in `basis`,
// or (c) explicitly tagged "Estimate" as a calibration target. Nothing is
// invented. See SEG_SOURCING below for the segment-level provenance notes.
// Mirrors 2_roi_model/roi_model.py.
// =====================================================================

export const U = {
  FRPS: "https://www.federalreserve.gov/paymentsystems/fr-payments-study.htm",
  AFP: "https://www.financialprofessionals.org/training-resources/resources/survey-research-economic-data/details/payments-fraud",
  AFP_COST: "https://www.financialprofessionals.org/training-resources/resources/survey-research-economic-data/Details/paymentscost",
  AFP_COST_PDF: "https://assets.ctfassets.net/h83dujey17us/59MRqbPnl4xJU0UufqxrhS/e84dc98d4d671e163a03b5489c202e35/2022_AFP_Payments_Cost_Survey_Final_Report__u1_.pdf",
  NACHA: "https://www.nacha.org/content/ach-network-volume-and-value-statistics",
  NACHA_B2B: "https://www.nacha.org/news/same-day-ach-and-business-business-payments-propel-ach-network-volume-growth-2025",
  FEDWIRE: "https://www.frbservices.org/resources/financial-services/wires/volume-value-stats/annual-stats.html",
  FEDNOW: "https://www.frbservices.org/resources/financial-services/fednow/volume-value-stats",
  FEDNOW_ORG: "https://www.frbservices.org/financial-services/fednow/organizations",
  FEDNOW_FEE: "https://www.frbservices.org/resources/fees/fednow-2026",
  CHECK_FEE: "https://www.frbservices.org/resources/fees/check-electronic-check-collection-2026",
  ACH_FEE: "https://www.frbservices.org/resources/fees/ach-2026",
  WIRE_FEE: "https://www.frbservices.org/resources/fees/wires-2026",
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

// ---------------------------------------------------------------------
// SEGMENTS — Keith Riddle & Nizar Jamal, 2026-07-28. The internal workflow
// and cost for the same rail differ materially by who the payment is for.
// ---------------------------------------------------------------------
export const SEGMENTS = ["Retail", "Business", "Internal"];

export const SEG_META = {
  Retail: {
    label: "Retail",
    short: "Consumer members / account holders",
    blurb: "High volume, low touch per item. Straight-through processing, self-service channels, small average ticket.",
    color: "#2E5496",
  },
  Business: {
    label: "Business",
    short: "SMB, mid-market & commercial clients",
    blurb: "Lower volume, high touch. Positive pay, AP/AR workflow, callbacks, dual control, larger tickets and far higher fraud exposure per item.",
    color: "#E76F51",
  },
  Internal: {
    label: "Internal (FI)",
    short: "The bank's own money movement",
    blurb: "Settlement, treasury, official checks and inter-account transfers. No customer servicing layer, but heavier compliance and reconciliation.",
    color: "#7A8CA8",
  },
};

// ---------------------------------------------------------------------
// LAYER 1 — NETWORK FEE. Published per-item fee schedules. Does NOT vary by
// customer segment: the Fed and TCH charge the FI the same fee per item
// regardless of who the end customer is. Cited, identical across segments.
// ---------------------------------------------------------------------
export const NETWORK_FEE = {
  "Check": 0.03,          // FRB Electronic Check Collection 2026: FedForward/FedReceipt per-item tiers $0.002–$0.107
  "Wire": 0.82,           // Fedwire Funds 2026: $0.97 gross, ~$0.78 with small-volume discount
  "Same-Day ACH": 0.05,   // FedACH 2026 origination + Same Day surcharge
  "ACH": 0.005,           // FedACH 2026 forward item
  "Instant": 0.045,       // FedNow & RTP 2026: $0.045 per credit transfer
};

// LAYER 2 — PROVIDER FEE (Payfinia / TPSP). Applies to the instant product
// only; Payfinia does not charge for the FI's existing check/wire/ACH rails.
// Payfinia to set — Estimate, identical across segments until priced.
export const PROVIDER_FEE = { "Check": 0, "Wire": 0, "Same-Day ACH": 0, "ACH": 0, "Instant": 0.10 };

// ---------------------------------------------------------------------
// LAYER 3 — THE FI'S OWN INTERNAL COST, BY SEGMENT.
// This is the layer that actually differs by segment, and the reason the
// flat model was wrong. Anchors:
//
//  Business — AFP 2022 Payments Cost Benchmarking Survey (n=347), total
//    per-item cost incl. personnel, bank fees and IT support. Published
//    anchors used here (initiating side):
//      Check  best-estimated mean $2.98/item (median range $2.01–$4.00)
//      Wire   external median $7.00 + internal median $5.00 = $12.00/item
//      ACH    external $0.25 + internal $0.15 = $0.40/item
//      RTP    median band $0.01–$2.50 → $1.25 midpoint
//    Components below are apportioned so each rail's 3 layers SUM to the
//    published AFP anchor. The split across components is our allocation;
//    the total is sourced.
//
//  Retail — the v3 FI-side stack, unchanged, which reconciles to the
//    published $0.82 all-in instant figure used in Deliverable 1.
//
//  Internal (FI) — no public source segments FI own-account cost. Every
//    figure here is an Estimate and a calibration target. Flagged in the UI.
// ---------------------------------------------------------------------
export const SEG_DEFAULTS = {
  Retail: {
    "Check":        { processing: 2.00, failure_rate: 0.015, cost_per_failure: 8.00,  fraud_loss: 0.40, fraud_prevention: 0.10, compliance: 0.03, reconciliation: 0.30, liquidity: 0.00 },
    "Wire":         { processing: 12.00, failure_rate: 0.010, cost_per_failure: 25.00, fraud_loss: 2.00, fraud_prevention: 1.00, compliance: 2.00, reconciliation: 0.50, liquidity: 0.00 },
    "Same-Day ACH": { processing: 0.80, failure_rate: 0.015, cost_per_failure: 6.00,  fraud_loss: 0.15, fraud_prevention: 0.10, compliance: 0.05, reconciliation: 0.10, liquidity: 0.00 },
    "ACH":          { processing: 0.15, failure_rate: 0.015, cost_per_failure: 4.00,  fraud_loss: 0.05, fraud_prevention: 0.05, compliance: 0.03, reconciliation: 0.05, liquidity: 0.00 },
    "Instant":      { processing: 0.10, failure_rate: 0.005, cost_per_failure: 5.00,  fraud_loss: 0.25, fraud_prevention: 0.15, compliance: 0.10, reconciliation: 0.05, liquidity: 0.00 },
  },
  Business: {
    // sums to AFP $2.98 all-in (0.03 network + 2.95 internal)
    "Check":        { processing: 2.10, failure_rate: 0.015, cost_per_failure: 12.00, fraud_loss: 0.30, fraud_prevention: 0.15, compliance: 0.05, reconciliation: 0.17, liquidity: 0.00 },
    // sums to AFP $12.00 all-in (0.82 network + 11.18 internal)
    "Wire":         { processing: 6.50, failure_rate: 0.010, cost_per_failure: 30.00, fraud_loss: 2.20, fraud_prevention: 1.10, compliance: 0.60, reconciliation: 0.48, liquidity: 0.00 },
    // derived: business ACH internal x the retail Same-Day/ACH ratio (3.3x)
    "Same-Day ACH": { processing: 0.80, failure_rate: 0.015, cost_per_failure: 7.00,  fraud_loss: 0.16, fraud_prevention: 0.10, compliance: 0.05, reconciliation: 0.10, liquidity: 0.00 },
    // sums to AFP $0.40 all-in (0.005 network + 0.395 internal)
    "ACH":          { processing: 0.18, failure_rate: 0.015, cost_per_failure: 5.00,  fraud_loss: 0.06, fraud_prevention: 0.04, compliance: 0.02, reconciliation: 0.02, liquidity: 0.00 },
    // sums to AFP RTP band midpoint $1.25 all-in (0.045 network + 0.10 provider + 1.105 internal)
    "Instant":      { processing: 0.55, failure_rate: 0.005, cost_per_failure: 8.00,  fraud_loss: 0.30, fraud_prevention: 0.15, compliance: 0.05, reconciliation: 0.015, liquidity: 0.00 },
  },
  Internal: {
    // ALL ESTIMATE — no public source segments FI own-account cost per item.
    "Check":        { processing: 1.40, failure_rate: 0.010, cost_per_failure: 8.00,  fraud_loss: 0.10, fraud_prevention: 0.05, compliance: 0.03, reconciliation: 0.20, liquidity: 0.00 },
    "Wire":         { processing: 4.00, failure_rate: 0.005, cost_per_failure: 25.00, fraud_loss: 0.30, fraud_prevention: 0.30, compliance: 0.50, reconciliation: 0.30, liquidity: 0.00 },
    "Same-Day ACH": { processing: 0.50, failure_rate: 0.010, cost_per_failure: 6.00,  fraud_loss: 0.03, fraud_prevention: 0.04, compliance: 0.03, reconciliation: 0.08, liquidity: 0.00 },
    "ACH":          { processing: 0.10, failure_rate: 0.010, cost_per_failure: 4.00,  fraud_loss: 0.01, fraud_prevention: 0.02, compliance: 0.02, reconciliation: 0.03, liquidity: 0.00 },
    "Instant":      { processing: 0.08, failure_rate: 0.003, cost_per_failure: 5.00,  fraud_loss: 0.04, fraud_prevention: 0.05, compliance: 0.04, reconciliation: 0.02, liquidity: 0.00 },
  },
};

// Provenance for each segment x rail all-in figure, surfaced in the UI so a
// reviewer can see instantly which cells are sourced and which are targets.
export const SEG_SOURCING = {
  Retail: {
    "Check":        { status: "Partly cited", basis: "v3 FI-side stack; Fed check fee schedule + AFP fraud incidence", url: U.CHECK_FEE },
    "Wire":         { status: "Partly cited", basis: "v3 FI-side stack; Fedwire 2026 fee schedule + AFP fraud incidence", url: U.WIRE_FEE },
    "Same-Day ACH": { status: "Partly cited", basis: "v3 FI-side stack; FedACH 2026 Same Day fees + Nacha return rate", url: U.ACH_FEE },
    "ACH":          { status: "Partly cited", basis: "v3 FI-side stack; FedACH 2026 fees + Nacha return rate", url: U.ACH_FEE },
    "Instant":      { status: "Partly cited", basis: "Reconciles to the $0.82 all-in instant figure in Deliverable 1", url: U.FEDNOW_FEE },
  },
  Business: {
    "Check":        { status: "Cited", basis: "AFP 2022 Payments Cost Benchmarking Survey — best-estimated mean $2.98/item to issue (median range $2.01–$4.00, n=347)", url: U.AFP_COST_PDF },
    "Wire":         { status: "Cited", basis: "AFP 2022 — initiating a wire: external median $7.00 + internal median $5.00 = $12.00/item (total median range $10.01–$15.00)", url: U.AFP_COST_PDF },
    "Same-Day ACH": { status: "Derived", basis: "AFP does not break out Same-Day. Derived: business ACH internal x the retail Same-Day/ACH cost ratio (3.3x)", url: U.AFP_COST_PDF },
    "ACH":          { status: "Cited", basis: "AFP 2022 — ACH external $0.25 + internal $0.15 = $0.40/item (median range $0.26–$0.50)", url: U.AFP_COST_PDF },
    "Instant":      { status: "Cited", basis: "AFP 2022 — RTP initiate/receive median band $0.01–$2.50; midpoint $1.25 used. 40% of firms report >$2.50, so the high-touch B2B band is available below", url: U.AFP_COST_PDF },
  },
  Internal: {
    "Check":        { status: "Estimate", basis: "No public source segments FI own-account cost. Calibration target — Payfinia production data", url: U.NCUA },
    "Wire":         { status: "Estimate", basis: "No public source segments FI own-account cost. Calibration target — Payfinia production data", url: U.NCUA },
    "Same-Day ACH": { status: "Estimate", basis: "No public source segments FI own-account cost. Calibration target — Payfinia production data", url: U.NCUA },
    "ACH":          { status: "Estimate", basis: "No public source segments FI own-account cost. Calibration target — Payfinia production data", url: U.NCUA },
    "Instant":      { status: "Estimate", basis: "No public source segments FI own-account cost. Calibration target — Payfinia production data", url: U.NCUA },
  },
};

// ---------------------------------------------------------------------
// OPEN METHODOLOGY FLAGS — surfaced in the UI rather than quietly resolved.
// These are for Nizar's cost-component review (action item, 2026-07-28).
// ---------------------------------------------------------------------
export const METHOD_FLAGS = [
  {
    id: "measurement-basis",
    severity: "high",
    title: "Business and Retail costs are measured on different bases",
    body: "The Business column is anchored to the AFP Payments Cost Benchmarking Survey, which measures what a CORPORATION spends to make a payment (their staff, their bank fees, their IT). The Retail column is the v3 stack, which measures what the FINANCIAL INSTITUTION spends to process one. These are not the same quantity. The segment structure is right; the levels are not yet strictly comparable until Payfinia production data lands.",
    affects: "All Business-segment figures",
  },
  {
    id: "retail-wire-inversion",
    severity: "high",
    title: "Retail wire ($18.57) currently costs more than business wire ($12.00)",
    body: "That ordering is almost certainly backwards — a commercial wire carries callbacks, dual control and higher fraud review than a consumer wire. It falls out of flag #1: the retail figure comes from a v3 processing estimate of $12.00/item of internal labor that was never independently sourced, while the business figure is the AFP published $12.00 all-in. Recommend re-deriving the retail wire labor line from Payfinia or call-report data before this goes to a client.",
    affects: "Retail · Wire",
  },
  {
    id: "internal-unsourced",
    severity: "medium",
    title: "The Internal (FI) segment has no public source",
    body: "No published dataset breaks out a financial institution's own-account cost per item. Every figure in the Internal column is an Estimate placed relative to Retail, and is a calibration target rather than evidence.",
    affects: "All Internal-segment figures",
  },
  {
    id: "check-mix-estimate",
    severity: "medium",
    title: "The check retail/business volume split is an estimate",
    body: "Nacha publishes a B2B share for ACH (23% of count), so the ACH split is cited. No equivalent public split exists for check origination, so the 35/60/5 mix is inferred from Fed Payments Study consumer-use trends. Replace with the FI's own data at intake.",
    affects: "Check · segment mix",
  },
];

// Keith Riddle flagged that high-touch B2B runs well above the AFP median —
// ~$3.00/item instant and ~$6.00/item check. Both sit inside the observed AFP
// distribution (RTP: 13% of firms report $2.51–$5.00; Check: 33% report above
// $4.00). Offered as a selectable band rather than silently overriding the
// published central estimate.
export const BUSINESS_BANDS = {
  "AFP median (default)": {
    note: "AFP 2022 central estimates. Check $2.98 · Wire $12.00 · ACH $0.40 · Instant $1.25 all-in.",
    mult: 1.0,
  },
  "High-touch B2B (Keith)": {
    note: "Check ~$6.00 and instant ~$3.00 per item, as raised in the 2026-07-28 review. Sits at roughly the 75th–80th percentile of the AFP distribution.",
    targets: { "Check": 6.00, "Wire": 18.00, "Same-Day ACH": 2.20, "ACH": 0.65, "Instant": 3.00 },
  },
};

// Editable component fields, tagged by layer.
export const COMP_FIELDS = [
  { key: "network", label: "Network fee", layer: "Network", kind: "$", perSegment: false },
  { key: "provider", label: "Provider fee (Payfinia / TPSP)", layer: "Provider", kind: "$", perSegment: false },
  { key: "processing", label: "Processing / labor", layer: "Internal", kind: "$", perSegment: true },
  { key: "failure_rate", label: "Failure/return rate", layer: "Internal", kind: "%", perSegment: true },
  { key: "cost_per_failure", label: "Cost per failed item", layer: "Internal", kind: "$", perSegment: true },
  { key: "fraud_loss", label: "Fraud loss", layer: "Internal", kind: "$", perSegment: true },
  { key: "fraud_prevention", label: "Fraud prevention", layer: "Internal", kind: "$", perSegment: true },
  { key: "compliance", label: "Compliance (AML)", layer: "Internal", kind: "$", perSegment: true },
  { key: "reconciliation", label: "Reconciliation", layer: "Internal", kind: "$", perSegment: true },
  { key: "liquidity", label: "Liquidity / prefunding", layer: "Internal", kind: "$", perSegment: true },
];

// ---------------------------------------------------------------------
// VOLUME MIX — how outbound volume on each rail splits across segments.
// Keith Riddle: intake should ask for segment counts, not just raw rail counts.
// ---------------------------------------------------------------------
export const SEG_MIX_DEFAULT = {
  "Check":        { Retail: 35, Business: 60, Internal: 5 },
  "Wire":         { Retail: 10, Business: 75, Internal: 15 },
  "Same-Day ACH": { Retail: 55, Business: 40, Internal: 5 },
  "ACH":          { Retail: 74, Business: 23, Internal: 3 },
};

export const SEG_MIX_SRC = {
  "ACH":          { status: "Cited", basis: "Nacha 2025: 8.1B B2B payments of 35.2B total ACH Network payments = 23%", url: U.NACHA_B2B },
  "Same-Day ACH": { status: "Partly cited", basis: "Nacha Q3 2025: $585B of Same-Day value was B2B. Count-based split estimated from that value share", url: U.NACHA_B2B },
  "Wire":         { status: "Partly cited", basis: "Fedwire 2024 average transfer $5.4M implies an overwhelmingly commercial/institutional mix", url: U.FEDWIRE },
  "Check":        { status: "Estimate", basis: "Fed Payments Study shows consumer check use at 7% of payments while business check use persists. Split is an estimate — calibration target", url: U.FRPS },
};

// ---------------------------------------------------------------------
// Substitution appetite — now per segment. Business checks and wires are
// stickier (contractual terms, AP file cycles, supplier onboarding), so the
// realistic instant-migration share is lower than retail at the same appetite.
// ---------------------------------------------------------------------
export const APPETITE = {
  "Conservative": {
    Retail:   { "Check": 18, "Wire": 18, "Same-Day ACH": 12, "ACH": 3 },
    Business: { "Check": 10, "Wire": 12, "Same-Day ACH": 8,  "ACH": 2 },
    Internal: { "Check": 20, "Wire": 15, "Same-Day ACH": 10, "ACH": 3 },
  },
  "Moderate": {
    Retail:   { "Check": 30, "Wire": 35, "Same-Day ACH": 24, "ACH": 6 },
    Business: { "Check": 18, "Wire": 24, "Same-Day ACH": 15, "ACH": 4 },
    Internal: { "Check": 35, "Wire": 30, "Same-Day ACH": 20, "ACH": 5 },
  },
  "Aggressive": {
    Retail:   { "Check": 48, "Wire": 52, "Same-Day ACH": 36, "ACH": 10 },
    Business: { "Check": 28, "Wire": 36, "Same-Day ACH": 22, "ACH": 6 },
    Internal: { "Check": 55, "Wire": 45, "Same-Day ACH": 30, "ACH": 8 },
  },
};

export const SUBST_DEFAULT = APPETITE["Moderate"];

// Volumes are ANNUAL, outbound (originated) counts — what the FI controls.
// customerMix = the segment-count intake Keith asked for.
export const PRESETS = {
  "Small CFI (~$200M)": {
    label: "Small (~$200M assets)",
    "Check": 120000, "Wire": 2000, "Same-Day ACH": 30000, "ACH": 400000,
    oneTime: 60000, annual: 30000,
    customers: { retail: 12000, smb: 700, midmarket: 40 },
  },
  "Mid CFI (~$1B)": {
    label: "Mid (~$1B assets)",
    "Check": 600000, "Wire": 12000, "Same-Day ACH": 150000, "ACH": 2500000,
    oneTime: 150000, annual: 60000,
    customers: { retail: 55000, smb: 3200, midmarket: 220 },
  },
  "Large CFI (~$5B)": {
    label: "Large (~$5B assets)",
    "Check": 3000000, "Wire": 60000, "Same-Day ACH": 800000, "ACH": 14000000,
    oneTime: 350000, annual: 150000,
    customers: { retail: 260000, smb: 15000, midmarket: 1100 },
  },
};

// per cost line: { publisher, supports, url, asOf, status, layer }
export const SRC = {
  "Network fee": { layer: "Network", publisher: "Federal Reserve & The Clearing House fee schedules", supports: "FedNow & RTP $0.045/credit transfer; Fedwire $0.97 gross (~$0.78 discounted); electronic check collection $0.002–$0.107/item", url: U.FEDNOW_FEE, asOf: "2026 schedule", status: "Cited" },
  "Provider fee (Payfinia / TPSP)": { layer: "Provider", publisher: "Third-party service provider pricing (Payfinia to set)", supports: "Hosting + per-transaction send/receive fees the provider charges the FI", url: U.FEDNOW_FEE, asOf: "—", status: "Estimate" },
  "Processing / labor": { layer: "Internal", publisher: "AFP 2022 Payments Cost Benchmarking Survey (business); bank's own staff & systems", supports: "Staff time to originate/handle one item — derive from FTEs × salary × % of time on this rail ÷ volume", url: U.AFP_COST_PDF, asOf: "2022 / current", status: "Partly cited" },
  "Failure & exception": { layer: "Internal", publisher: "Nacha Operating Rules; your processor", supports: "Return rate ~1.5% (Nacha); or enter your own failed-item count", url: U.NACHA, asOf: "2024–2025", status: "Partly cited" },
  "Fraud loss": { layer: "Internal", publisher: "AFP Payments Fraud & Control Survey; or your fraud $ ÷ volume", supports: "2025: 79% of organizations hit by payments fraud; wires targeted at 63%, ACH debits 38%, ACH credits 50%", url: U.AFP, asOf: "2025", status: "Partly cited" },
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
    ["Business cost", "$2.98 best-estimated mean to issue; median range $2.01–$4.00; 33% of firms report above $4.00", "2022", "AFP Payments Cost Benchmarking Survey", U.AFP_COST_PDF],
    ["Fraud", "Checks remain the most-targeted instrument in the AFP fraud survey", "2025", "AFP Payments Fraud Survey", U.AFP],
  ],
  "Wire": [
    ["Volume", "209.9 million Fedwire Funds transfers", "2024", "Fedwire Funds Service Annual Statistics", U.FEDWIRE],
    ["Value", "$1.133 quadrillion; average $5.4 million per transfer", "2024", "Fedwire Annual Statistics", U.FEDWIRE],
    ["Fee", "$0.97 gross (~$0.78 with small-volume discount)", "2026 schedule", "Federal Reserve fee schedule", U.WIRE_FEE],
    ["Business cost", "$12.00/item to initiate (external median $7.00 + internal median $5.00)", "2022", "AFP Payments Cost Benchmarking Survey", U.AFP_COST_PDF],
    ["Fraud", "Wires targeted at 63% — the top BEC avenue", "2025", "AFP Payments Fraud Survey", U.AFP],
  ],
  "Same-Day ACH": [
    ["Volume", "1.4 billion payments", "2025", "Nacha", U.NACHA],
    ["Value", "$3.9 trillion", "2025", "Nacha", U.NACHA],
    ["Growth", "+16.7% volume / +21.4% value YoY", "2025", "Nacha", U.NACHA],
    ["B2B share", "$585 billion of Same-Day value was B2B in Q3 2025, up 15% YoY", "2025", "Nacha", U.NACHA_B2B],
  ],
  "ACH": [
    ["Volume", "35.2 billion payments", "2025", "Nacha", U.NACHA],
    ["Value", "$93.1 trillion", "2025", "Nacha", U.NACHA],
    ["B2B share", "8.1 billion B2B payments — 23% of network count, 69% of Q3 value", "2025", "Nacha", U.NACHA_B2B],
    ["Business cost", "$0.40/item (external $0.25 + internal $0.15); median range $0.26–$0.50", "2022", "AFP Payments Cost Benchmarking Survey", U.AFP_COST_PDF],
  ],
  "Instant": [
    ["FedNow settled (2025)", "8.4 million payments (up from 1.5M in 2024); $853.4B; +460% YoY", "2025", "Federal Reserve — FedNow", U.FEDNOW],
    ["FedNow participants", "1,600 financial institutions, all 50 states", "2025", "Federal Reserve", U.FEDNOW_ORG],
    ["RTP volume (2025)", "~1.2 million payments/day; Q2: 107M txns / $481B", "2025", "The Clearing House", U.RTP],
    ["RTP participants", "1,031 institutions; 94% under $10B assets; 72%+ account reach", "Aug 2025", "The Clearing House", U.RTP_INST],
    ["Pricing", "$0.045 per credit transfer; $0.01 request-for-payment; $25/mo participation", "2026 schedule", "Fed / TCH fee schedules", U.FEDNOW_FEE],
    ["Business cost", "Median band $0.01–$2.50/item; 40% of firms report above $2.50", "2022", "AFP Payments Cost Benchmarking Survey", U.AFP_COST_PDF],
  ],
};
export const RAIL_COLOR = { "Check": "#E76F51", "Wire": "#F4A259", "Same-Day ACH": "#2E5496", "ACH": "#9AA7C7", "Instant": "#2EC4B6" };

// =====================================================================
// shared model logic
// =====================================================================
const clone = (o) => JSON.parse(JSON.stringify(o));

// Build the full editable cost object for a segment: network + provider are
// shared across segments, internal components are segment-specific.
export function buildSegCosts(segDefaults = SEG_DEFAULTS) {
  const out = {};
  SEGMENTS.forEach((seg) => {
    out[seg] = {};
    RAILS.forEach((rail) => {
      out[seg][rail] = {
        network: NETWORK_FEE[rail],
        provider: PROVIDER_FEE[rail],
        ...clone(segDefaults[seg][rail]),
      };
    });
  });
  return out;
}

export const DEFAULT_SEG_COSTS = buildSegCosts();

// Back-compat: the old flat DEFAULTS shape, now the Retail segment.
export const DEFAULTS = DEFAULT_SEG_COSTS.Retail;

export const railTotal = (c) =>
  c.network + c.provider + c.processing + c.failure_rate * c.cost_per_failure +
  c.fraud_loss + c.fraud_prevention + c.compliance + c.reconciliation + c.liquidity;

export const layerTotals = (c) => ({
  network: c.network,
  provider: c.provider,
  internal: c.processing + c.failure_rate * c.cost_per_failure + c.fraud_loss +
            c.fraud_prevention + c.compliance + c.reconciliation + c.liquidity,
});

// Rescale a segment's internal components so the rail's ALL-IN cost hits a
// target (used by the Business band selector and by "I know my all-in number").
export function scaleToTarget(c, target) {
  const lt = layerTotals(c);
  const fixed = lt.network + lt.provider;
  const wantInternal = Math.max(target - fixed, 0);
  if (lt.internal <= 0) return clone(c);
  const k = wantInternal / lt.internal;
  const out = clone(c);
  ["processing", "fraud_loss", "fraud_prevention", "compliance", "reconciliation", "liquidity"].forEach((f) => { out[f] = +(out[f] * k).toFixed(4); });
  out.cost_per_failure = +(out.cost_per_failure * k).toFixed(4);
  return out;
}

export function applyBusinessBand(segCosts, bandName) {
  const band = BUSINESS_BANDS[bandName];
  if (!band || !band.targets) return segCosts;
  const out = clone(segCosts);
  RAILS.forEach((rail) => {
    const t = band.targets[rail];
    if (t != null) out.Business[rail] = scaleToTarget(out.Business[rail], t);
  });
  return out;
}

// effective per-txn cost: a user override (typed all-in number) wins over the
// bottom-up component stack. Empty / invalid override => use the stack.
export const effTotal = (costs, ov, rail) => {
  const o = ov && ov[rail];
  return (o !== undefined && o !== null && o !== "" && !isNaN(+o)) ? +o : railTotal(costs[rail]);
};

// Split a rail's total outbound volume across segments using the mix (%).
export function splitVolume(vol, mix) {
  const out = {};
  SEGMENTS.forEach((seg) => { out[seg] = {}; });
  LEGACY.forEach((rail) => {
    SEGMENTS.forEach((seg) => {
      out[seg][rail] = (vol[rail] || 0) * ((mix[rail]?.[seg] ?? 0) / 100);
    });
  });
  return out;
}

// ---------------------------------------------------------------------
// THE MODULAR ENGINE — Nizar Jamal's ask. Each segment is costed on its own
// and the results are aggregated. Per-segment output is kept so the UI can
// show which customer segment the savings actually come from.
//
//   volBySeg   { Retail: {Check: n, ...}, Business: {...}, Internal: {...} }
//   costsBySeg { Retail: {Check: {...components}, ...}, ... }
//   substBySeg { Retail: {Check: %, ...}, ... }
//   ovBySeg    optional per-segment per-rail all-in overrides
// ---------------------------------------------------------------------
export function runSegmented(volBySeg, costsBySeg, substBySeg, oneTime, annual, disc, horizon, ovBySeg) {
  const segments = {};
  let gross = 0;

  SEGMENTS.forEach((seg) => {
    const costs = costsBySeg[seg];
    const ov = ovBySeg?.[seg];
    const instant = effTotal(costs, ov, "Instant");
    let segGross = 0;

    const rows = LEGACY.map((rail) => {
      const legacy = effTotal(costs, ov, rail);
      const per = legacy - instant;                                  // savings per migrated txn
      const pct = substBySeg?.[seg]?.[rail] ?? 0;
      const migrated = (volBySeg[seg]?.[rail] || 0) * (pct / 100);
      const ann = migrated * per;
      segGross += ann;
      return { segment: seg, rail, legacy, instant, per, migrated, ann, pct };
    });

    gross += segGross;
    segments[seg] = { segment: seg, instant, gross: segGross, rows };
  });

  const net = gross - annual;
  const roi = oneTime ? net / oneTime : 0;
  const payback = net > 0 ? (oneTime / net) * 12 : Infinity;
  const af = disc > 0 ? (1 - Math.pow(1 + disc / 100, -horizon)) / (disc / 100) : horizon;
  const npv = net * af - oneTime;

  // aggregate by rail across segments — the roll-up view
  const rows = LEGACY.map((rail) => {
    let ann = 0, migrated = 0, weighted = 0;
    SEGMENTS.forEach((seg) => {
      const r = segments[seg].rows.find((x) => x.rail === rail);
      ann += r.ann; migrated += r.migrated; weighted += r.legacy * (volBySeg[seg]?.[rail] || 0);
    });
    const totVol = SEGMENTS.reduce((s, seg) => s + (volBySeg[seg]?.[rail] || 0), 0);
    const legacy = totVol > 0 ? weighted / totVol : 0;               // volume-weighted blended cost
    return { rail, legacy, migrated, ann, per: migrated > 0 ? ann / migrated : 0 };
  });

  // blended instant cost, weighted by what actually migrates
  const totMigrated = SEGMENTS.reduce((s, seg) => s + segments[seg].rows.reduce((a, r) => a + r.migrated, 0), 0);
  const instant = totMigrated > 0
    ? SEGMENTS.reduce((s, seg) => s + segments[seg].instant * segments[seg].rows.reduce((a, r) => a + r.migrated, 0), 0) / totMigrated
    : DEFAULT_SEG_COSTS.Retail.Instant ? railTotal(costsBySeg.Retail.Instant) : 0;

  return { instant, gross, net, roi, payback, npv, rows, segments };
}

// Back-compat wrapper: single flat cost table, single volume set. Routes
// everything through the Retail segment so old call sites keep working.
export function runBottomUp(vol, costs, subst, oneTime, annual, disc, horizon, ov) {
  const volBySeg = { Retail: vol, Business: {}, Internal: {} };
  const costsBySeg = { Retail: costs, Business: costs, Internal: costs };
  const substBySeg = { Retail: subst, Business: subst, Internal: subst };
  return runSegmented(volBySeg, costsBySeg, substBySeg, oneTime, annual, disc, horizon, { Retail: ov, Business: ov, Internal: ov });
}

// implied total annual cost to support ALL current volume (the sanity check)
export function impliedTotalCostSeg(volBySeg, costsBySeg, ovBySeg) {
  return SEGMENTS.reduce((s, seg) =>
    s + LEGACY.reduce((t, rail) =>
      t + (volBySeg[seg]?.[rail] || 0) * effTotal(costsBySeg[seg], ovBySeg?.[seg], rail), 0), 0);
}

export function impliedTotalCost(vol, costs, ov) {
  return LEGACY.reduce((s, rail) => s + (vol[rail] || 0) * effTotal(costs, ov, rail), 0);
}

// ---------------------------------------------------------------------
// Mini-calculator helpers — build a component from figures a bank has.
// Nizar Jamal: FTE cost must reflect the SHARE OF TIME on this rail, not
// just headcount x salary / volume.
// ---------------------------------------------------------------------
export const LOADED_SALARY_MULT = 1.30;   // salary + benefits/overhead. FFIEC-style loading.

// fte           number of full-time-equivalent staff
// salary        average base salary per FTE ($/yr)
// pctTime       % of those FTEs' time spent on THIS rail in THIS segment
// items         annual item count for this rail x segment
// loaded        apply the benefits/overhead multiplier
export function laborPerItem({ fte, salary, pctTime, items, loaded = true }) {
  const n = Number(items);
  if (!n || n <= 0) return 0;
  const mult = loaded ? LOADED_SALARY_MULT : 1;
  return (Number(fte) * Number(salary) * mult * (Number(pctTime) / 100)) / n;
}

export function perItem(totalUsd, items) {
  const n = Number(items);
  return !n || n <= 0 ? 0 : Number(totalUsd) / n;
}

// Derive a segment volume mix from the customer counts Keith asked for.
// Weights are relative origination intensity per customer type per rail —
// Estimate, exposed so it can be replaced with call-report data later.
export const ORIGINATION_WEIGHTS = {
  "Check":        { retail: 1.0, smb: 14, midmarket: 90 },
  "Wire":         { retail: 1.0, smb: 22, midmarket: 240 },
  "Same-Day ACH": { retail: 1.0, smb: 10, midmarket: 70 },
  "ACH":          { retail: 1.0, smb: 8,  midmarket: 55 },
};

export function mixFromCustomers({ retail, smb, midmarket }, internalPct = SEG_MIX_DEFAULT) {
  const mix = {};
  LEGACY.forEach((rail) => {
    const w = ORIGINATION_WEIGHTS[rail];
    const r = (Number(retail) || 0) * w.retail;
    const b = (Number(smb) || 0) * w.smb + (Number(midmarket) || 0) * w.midmarket;
    const intPct = internalPct[rail]?.Internal ?? 5;
    const rest = 100 - intPct;
    const tot = r + b;
    mix[rail] = tot > 0
      ? { Retail: +((r / tot) * rest).toFixed(1), Business: +((b / tot) * rest).toFixed(1), Internal: intPct }
      : { ...SEG_MIX_DEFAULT[rail] };
  });
  return mix;
}
