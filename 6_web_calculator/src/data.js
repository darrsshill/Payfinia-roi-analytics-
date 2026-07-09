// =====================================================================
// Payfinia ROI Calculator — sourced benchmark data
// Every figure below is a real, cited public statistic. FedNow and RTP
// are kept as SEPARATE rails. Logic mirrors roi_model.py.
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
};

// cost stack order: [network, processing, failureRate, costPerFailure,
//                    fraudLoss, fraudPrevention, compliance, reconciliation, liquidity]
export const COMPONENTS = ["Network fee","Processing","Failure rate","Cost per failure",
  "Fraud loss","Fraud prevention","Compliance","Reconciliation","Liquidity"];
export const RAILS = ["Check","Wire","Same-Day ACH","ACH","FedNow","RTP"];
export const LEGACY = ["Check","Wire","Same-Day ACH","ACH"];

export const DEFAULTS = {
  "Check":        [0.03, 2.00, 0.015, 8.00, 0.40, 0.10, 0.03, 0.30, 0.00],
  "Wire":         [0.82, 12.00, 0.010, 25.00, 2.00, 1.00, 2.00, 0.50, 0.00],
  "Same-Day ACH": [0.05, 0.80, 0.015, 6.00, 0.15, 0.10, 0.05, 0.10, 0.00],
  "ACH":          [0.005, 0.15, 0.015, 4.00, 0.05, 0.05, 0.03, 0.05, 0.00],
  "FedNow":       [0.045, 0.10, 0.005, 5.00, 0.25, 0.15, 0.10, 0.05, 0.05],
  "RTP":          [0.045, 0.10, 0.005, 5.00, 0.25, 0.15, 0.10, 0.05, 0.05],
};

export const SUBST_DEFAULT = { "Check":25, "Wire":30, "Same-Day ACH":20, "ACH":5 };

export const PRESETS = {
  "Small CFI (~$200M)": { "Check":120000,"Wire":2000,"Same-Day ACH":30000,"ACH":400000, oneTime:60000, annual:30000 },
  "Mid CFI (~$1B)":     { "Check":600000,"Wire":12000,"Same-Day ACH":150000,"ACH":2500000, oneTime:150000, annual:60000 },
  "Large CFI (~$5B)":   { "Check":3000000,"Wire":60000,"Same-Day ACH":800000,"ACH":14000000, oneTime:350000, annual:150000 },
};

// per cost line: { publisher, supports, url, asOf, status }
export const SRC = {
  "Network fee": { publisher:"Federal Reserve & The Clearing House fee schedules",
    supports:"FedNow & RTP $0.045/credit transfer; Fedwire $0.97 gross (~$0.78 discounted)", url:U.FEDNOW_FEE, asOf:"2025–2026", status:"Cited" },
  "Processing": { publisher:"Nacha / AFP operational-cost benchmarks",
    supports:"Internal labor & systems per item", url:U.NACHA, asOf:"2024", status:"Estimate" },
  "Failure & exception": { publisher:"Nacha Operating Rules; LexisNexis",
    supports:"Return rate ~1.5%; avg failed payment $12.10", url:U.NACHA, asOf:"2024–2025", status:"Partly cited" },
  "Fraud loss": { publisher:"AFP Payments Fraud & Control Survey",
    supports:"Incidence cited (check 58%, ACH 30%, wire 25%); per-item $ estimated", url:U.AFP, asOf:"2025", status:"Partly cited" },
  "Fraud prevention": { publisher:"AFP survey / fraud-tooling vendors",
    supports:"Real-time screening & monitoring per item", url:U.AFP, asOf:"2025", status:"Estimate" },
  "Compliance": { publisher:"FFIEC BSA/AML; Fed Regulation II",
    supports:"AML/OFAC screening; debit interchange $0.21 + 5bps + $0.01", url:U.REGII, asOf:"current (12 CFR 235)", status:"Partly cited" },
  "Reconciliation": { publisher:"FFIEC / exception-management research",
    supports:"Matching & breaks handling per item", url:U.FFIEC, asOf:"2024", status:"Estimate" },
  "Liquidity": { publisher:"Federal Reserve FedNow / TCH RTP",
    supports:"Prefunding / liquidity carrying cost (24/7 settlement)", url:U.FEDNOW, asOf:"2025", status:"Estimate" },
};

export const SUBST_SRC = { publisher:"Banco Central do Brasil (Pix) & Pay.UK", url:U.PIX, asOf:"2024" };

// per-rail reference facts: [metric, value, asOf, publisher, url]
export const RAIL_FACTS = {
  "Check": [
    ["Volume","~3.0 billion commercial checks (Reserve Banks), down 5.4% YoY","2024","Federal Reserve Payments Study",U.FRPS],
    ["Consumer use","7% of consumers paid by check (was 19% in 2020)","2024","Federal Reserve",U.FRPS],
    ["Fraud","58% of organizations targeted — the most of any instrument","2025","AFP Payments Fraud Survey",U.AFP],
    ["Fully-loaded cost","~$3.00 per transaction (model)","2025 est.","Estimate — Deliverable 1",U.NACHA],
  ],
  "Wire": [
    ["Volume","209.9 million Fedwire Funds transfers","2024","Fedwire Funds Service Annual Statistics",U.FEDWIRE],
    ["Value","$1.133 quadrillion; average $5.4 million per transfer","2024","Fedwire Annual Statistics",U.FEDWIRE],
    ["Fee","$0.97 gross (~$0.78 with small-volume discount)","2026 schedule","Federal Reserve fee schedule",U.FEDNOW_FEE],
    ["Fraud","25% of organizations targeted; high value-at-risk","2025","AFP Payments Fraud Survey",U.AFP],
    ["Fully-loaded cost","~$18.57 per transaction (model)","2025 est.","Estimate — Deliverable 1",U.FEDWIRE],
  ],
  "Same-Day ACH": [
    ["Volume","1.4 billion payments","2025","Nacha",U.NACHA],
    ["Value","$3.9 trillion","2025","Nacha",U.NACHA],
    ["Growth","+16.7% volume / +21.4% value YoY","2025","Nacha",U.NACHA],
    ["Fully-loaded cost","~$1.34 per transaction (model)","2025 est.","Estimate — Deliverable 1",U.NACHA],
  ],
  "ACH": [
    ["Volume","35.2 billion payments","2025","Nacha",U.NACHA],
    ["Value","$93.1 trillion","2025","Nacha",U.NACHA],
    ["Growth","+4.9% volume YoY","2025","Nacha",U.NACHA],
    ["Fraud","ACH debit: 30% of organizations targeted","2025","AFP Payments Fraud Survey",U.AFP],
    ["Fully-loaded cost","~$0.40 per transaction (model)","2025 est.","Estimate — Deliverable 1",U.NACHA],
  ],
  "FedNow": [
    ["Payments settled","8.4 million in 2025 (up from 1.5M in 2024)","2025","Federal Reserve — FedNow Volume & Value",U.FEDNOW],
    ["Value","$853.4 billion; average $101,435 per payment","2025","Federal Reserve",U.FEDNOW],
    ["Growth","+460% value year over year","2025","Federal Reserve",U.FEDNOW],
    ["Participants","1,600 financial institutions, all 50 states","2025","Federal Reserve",U.FEDNOW_ORG],
    ["Transaction limit","$10 million (raised from $1M, Nov 2025)","2025","Federal Reserve",U.FEDNOW_FEE],
    ["Pricing","$0.045 / credit transfer; $0.01 / request-for-payment; $25/mo (waived 2025)","2025–2026","Federal Reserve fee schedule",U.FEDNOW_FEE],
  ],
  "RTP": [
    ["Daily volume","~1.2 million payments per day","2025","The Clearing House",U.RTP],
    ["Quarterly","Q2 2025: 107 million transactions, $481 billion","2025","The Clearing House",U.RTP],
    ["Participants","1,031 institutions; 94% hold under $10B in assets","Aug 2025","The Clearing House",U.RTP_INST],
    ["Account reach","72%+ of U.S. demand-deposit accounts","2025","The Clearing House",U.RTP_INST],
    ["Transaction limit","$10 million (raised Feb 2025)","2025","The Clearing House",U.RTP],
    ["Pricing","$0.045 / credit transfer; $0.11 / request-for-payment","2025","The Clearing House",U.RTP],
    ["Live since","November 2017","2025","The Clearing House",U.RTP],
  ],
};

export const RAIL_COLOR = {
  "Check":"#E76F51","Wire":"#F4A259","Same-Day ACH":"#2E5496","ACH":"#9AA7C7","FedNow":"#2EC4B6","RTP":"#1B998B",
};
