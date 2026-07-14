# Payfinia — Money Movement Analytics & Migration ROI

**Quantifying the financial return for a community financial institution (CFI) of migrating
transaction volume from legacy rails (checks, wires, Same-Day ACH) to instant payment
rails (FedNow & RTP) — and identifying which institutions to target first.**

> USF FinTech Graduate Project for Payfinia. Built entirely on publicly available data,
> designed to be calibrated against Payfinia production data in a downstream phase.

---

## Table of contents
1. [What this project delivers](#1-what-this-project-delivers)
2. [Quick start](#2-quick-start)
3. [Repository structure](#3-repository-structure)
4. [Component guide (how to run each piece)](#4-component-guide)
5. [Key findings](#5-key-findings)
6. [Data sources & research integrity](#6-data-sources--research-integrity)
7. [Reproduce everything end-to-end](#7-reproduce-everything-end-to-end)
8. [Tech stack](#8-tech-stack)
9. [Disclaimer & calibration](#9-disclaimer--calibration)

---

## 1. What this project delivers

The project answers one question a CFI asks about instant payments —
*"If I move volume off checks and wires onto FedNow/RTP, what is the return?"* — and turns it
into decision-ready tools, mapped to the four deliverables in the project brief:

| # | Deliverable | What it is | Folder |
|---|-------------|------------|--------|
| 1 | **Public Data Synthesis** | Sourced reference base of rail volumes, costs, fraud & global adoption | `1_data_synthesis/` |
| 2 | **Migration ROI Model** | Full-cost model (Python + live Excel) quantifying migration savings | `2_roi_model/` |
| 3 | **CFI Archetype Analysis** | Unsupervised ML (K-means) grouping banks into types mapped to ROI ranges | `7_archetype_analysis/` |
| 4 | **Interactive ROI Calculator** | Client-facing web + Streamlit calculators with a guided assistant | `3_roi_calculator/`, `6_web_calculator/` |
| + | **Prospect Finder** *(extension)* | Ranks all ~4,089 U.S. community banks into target segments | `8_prospect_finder/` |
| + | **Data-story Dashboard & Deck** | The "why instant payments win" narrative for stakeholders | `4_dashboard/`, `5_presentation/` |

Every figure is sourced. Numbers that cannot be directly cited are labelled **Estimate** and
flagged as calibration targets — nothing is fabricated.

---

## 2. Quick start

**Prerequisites:** Python 3.9+ and (for the web apps) Node.js 18+.

```bash
# clone
git clone https://github.com/darrsshill/Payfinia-roi-analytics-.git
cd Payfinia-roi-analytics-

# --- Interactive ROI calculator (React, recommended) ---
cd 6_web_calculator && npm install && npm run dev        # http://localhost:5173

# --- ROI calculator (Streamlit) ---
cd 3_roi_calculator && pip install -r requirements.txt && streamlit run roi_calculator.py

# --- Prospect Finder: pull all banks, segment, run ---
cd 8_prospect_finder && pip install -r requirements.txt
python fetch_payfinia_banks.py      # pulls ~4,089 banks from the FDIC API
python cluster_prospects.py         # K-means segments + refreshes web data
streamlit run prospect_finder_app.py

# --- ROI model (prints results for 3 example CFIs) ---
python 2_roi_model/roi_model.py

# --- CFI archetype analysis (ML + charts) ---
cd 7_archetype_analysis && pip install -r requirements.txt && python archetype_analysis.py
```

---

## 3. Repository structure

```
Payfinia-ROI-Analytics/
├── README.md                     ← you are here
├── requirements.txt              ← Python deps (analysis + apps)
├── .gitignore
│
├── 1_data_synthesis/             # Deliverable 1 — the sourced data base
│   ├── Payfinia_Deliverable1_Public_Data_Synthesis.xlsx   (rail volumes, costs, fraud, global adoption; quality-rated)
│   └── Payfinia_Deliverable1_Public_Data_Synthesis.docx   (written synthesis + data-quality assessment)
│
├── 2_roi_model/                  # Deliverable 2 — the migration ROI model
│   ├── roi_model.py                                        (documented Python model — canonical logic)
│   ├── Payfinia_Deliverable2_Migration_ROI_Model.xlsx     (live Excel model; edit inputs, results recalc)
│   └── rail_unit_economics/                                (one PDF per rail: 8-component cost stack)
│
├── 3_roi_calculator/             # Deliverable 4 — Streamlit calculator
│   ├── roi_calculator.py
│   └── requirements.txt
│
├── 4_dashboard/                  # Data-story dashboard (the "why")
│   ├── app.py · requirements.txt · HOW_TO_RUN_DASHBOARD.md
│
├── 5_presentation/               # Client readout
│   ├── Payfinia_Client_Presentation.pptx / .pdf
│
├── 6_web_calculator/             # Deliverable 4 — React (Vite) calculator, deploy to Vercel
│   ├── src/ (App.jsx, ChatAssistant.jsx, data.js, styles.css) · package.json · vercel.json
│
├── 7_archetype_analysis/         # Deliverable 3 — unsupervised ML (K-means)
│   ├── archetype_analysis.py · data/fdic_cfi_sample.csv · outputs/ (charts + summary)
│
└── 8_prospect_finder/            # Prospect ranking — all ~4,089 banks segmented
    ├── fetch_payfinia_banks.py   (FDIC API loader)
    ├── scoring.py                (priority-score logic)
    ├── cluster_prospects.py      (K-means target segments)
    ├── prospect_finder_app.py    (Streamlit)
    ├── data/payfinia_bank_prospects.csv
    └── web/                      (React finder — deploy to Vercel)
```

---

## 4. Component guide

### 1 · Data Synthesis (`1_data_synthesis/`)
The reference base every model input traces back to. Open the `.xlsx` — six tabs cover rail
volumes/value, per-transaction costs, fraud & operational benchmarks, international
substitution (Pix, UK FPS), and a full sources + data-quality methodology. The `.docx` is the
written version for a non-technical reviewer. No code to run.

### 2 · ROI Model (`2_roi_model/`)
The engine. Each rail's cost is built from **8 components** (network, processing, failure &
exception, fraud loss, fraud prevention, compliance, reconciliation, liquidity). The model
applies a substitution rate, computes savings per migrated transaction, and rolls up to net
benefit, ROI, payback, and 5-year NPV.
- `python roi_model.py` prints results for Small / Mid / Large example CFIs.
- The `.xlsx` is the same logic with live formulas (blue = inputs) so it recalculates as you edit.
- `rail_unit_economics/` has a one-page cost breakdown PDF for each rail.

### 3 · Interactive Calculator — React (`6_web_calculator/`) *(primary, deployable)*
Client-facing tool. `npm install && npm run dev`. Features: 3-layer cost model
(network · provider/Payfinia · FI internal), mini-calculators that derive per-item costs from
figures a bank actually has, "Use My Financials" mode, a sanity check vs. call-report totals,
monthly/annual toggle, and a guided **Savings Assistant** chat. **Deploy to Vercel:** set
Root Directory to `6_web_calculator`, framework Vite.

### 3b · Interactive Calculator — Streamlit (`3_roi_calculator/`)
Same model in Streamlit for quick internal use. `streamlit run roi_calculator.py`.

### 4 · Data-story Dashboard (`4_dashboard/`)
The visual argument for instant payments (volumes, cost gap, momentum, fraud, international).
`streamlit run app.py`.

### 5 · Presentation (`5_presentation/`)
20-slide client readout (`.pptx` editable, `.pdf` to share).

### 7 · CFI Archetype Analysis (`7_archetype_analysis/`)
The unsupervised ML piece. `python archetype_analysis.py` pulls FDIC data, engineers features,
runs K-means (k chosen with silhouette + elbow), visualizes clusters with PCA, and maps each
archetype to an expected ROI range. Outputs charts + `archetype_roi_summary.csv`.

### 8 · Prospect Finder (`8_prospect_finder/`)
Turns the analysis into a "call these first" tool across **all ~4,089** community banks.
- `fetch_payfinia_banks.py` — pulls the full universe from the FDIC API (with names).
- `cluster_prospects.py` — K-means into four target **segments (A→D)** and refreshes web data.
- `prospect_finder_app.py` (Streamlit) and `web/` (React) — filter by segment/state, ranked list, CSV export.

---

## 5. Key findings

**The migration case (ROI model):** savings come from displacing **checks (~$3/txn)** and
**wires (~$19/txn)** — an instant payment costs ~$0.77–0.87 all-in. Standard ACH is already
cheaper than instant, so migrating it does not pay. A mid-size (~$1B) CFI nets roughly
**$300K/year** with payback in months.

**Who to target (Prospect Finder, K-means on 4,089 banks, silhouette 0.39):**

| Segment | Banks | Total opportunity / yr | Avg ROI |
|---------|-------|------------------------|---------|
| **A — Target first** | 439 | **$551M** | 359% |
| B — Strong | 1,128 | $394M | 200% |
| C — Moderate | 1,574 | $159M | 116% |
| D — Low priority | 948 | $20M | 53% |

**Takeaway:** prioritize Segment A (large/regional banks) — highest value *and* highest ROI.

---

## 6. Data sources & research integrity

All figures are public and cited. Primary sources:
Federal Reserve (Payments Study, FedNow stats, Fedwire stats, Regulation II) · Nacha (ACH) ·
The Clearing House (RTP) · AFP Payments Fraud & Control Survey · FFIEC · FDIC BankFind API ·
Banco Central do Brasil (Pix) · Pay.UK. Full source lists with links are on the "Sources" tabs
of the workbooks and inside the apps.

**Integrity rule applied throughout:** real, verifiable figures only. Cost lines that are not
directly citable (per-item processing, fraud prevention, compliance, reconciliation, liquidity;
and each bank's exact rail mix) are labelled **Estimate** — grounded in benchmark midpoints and
flagged as the numbers to calibrate with Payfinia production data. Nothing is fabricated.

---

## 7. Reproduce everything end-to-end

```bash
# 1. ROI model results
python 2_roi_model/roi_model.py

# 2. Archetype analysis (ML + charts)
cd 7_archetype_analysis && pip install -r requirements.txt && python archetype_analysis.py && cd ..

# 3. Prospect universe + segmentation
cd 8_prospect_finder && pip install -r requirements.txt
python fetch_payfinia_banks.py     # live FDIC pull (~4,089 banks)
python cluster_prospects.py        # K-means segments + writes web/src/prospects.json
cd ..

# 4. Run the client tools
cd 6_web_calculator && npm install && npm run dev        # calculator
# (new terminal)
cd 8_prospect_finder/web && npm install && npm run dev   # prospect finder
```

---

## 8. Tech stack

**Analysis / models:** Python · pandas · NumPy · scikit-learn (K-means, PCA, StandardScaler) ·
matplotlib · openpyxl.
**Apps:** Streamlit + Plotly (internal) · React + Vite + Recharts (client-facing, Vercel-deployable).
**Data:** FDIC BankFind public API + published regulator/industry statistics.

---

## 9. Disclaimer & calibration

These tools produce **analytical estimates, not guarantees of savings**. Bank characteristics
(assets, deposits, offices, income) are real FDIC data; per-transaction economics use
conservative public-benchmark midpoints. The model is built so Payfinia can calibrate it
against internal production data — fraud loss per item, true processing cost per item, real
substitution rates, and actual rail mix — without re-architecting anything.

*USF FinTech Graduate Project · Prepared for Payfinia · 2025–2026.*
