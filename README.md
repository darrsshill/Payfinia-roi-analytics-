# Payfinia — Money Movement Analytics & Migration ROI

Quantifying the financial return for a community financial institution (CFI) of
migrating transaction volume from legacy rails (checks, wires, Same-Day ACH) to
instant payment rails (**FedNow** and **RTP**).

> USF FinTech Graduate Project · built on publicly available data, designed to be
> calibrated against Payfinia production data in a later phase.

---

## The question

*"If a CFI moves volume from checks and wires onto instant rails, what is the
financial return?"* This repo replaces the anecdotal answer with a transparent,
sourced, and adjustable model — plus an interactive calculator for prospect
conversations.

---

## Repository structure

```
.
├── 1_data_synthesis/        # Deliverable 1 — the sourced data base
│   ├── Payfinia_Deliverable1_Public_Data_Synthesis.xlsx   (rail volumes, costs, fraud, global adoption)
│   └── Payfinia_Deliverable1_Public_Data_Synthesis.docx   (written synthesis + data-quality assessment)
│
├── 2_roi_model/             # Deliverable 2 — the migration ROI model
│   ├── roi_model.py                                        (documented Python model — canonical logic)
│   ├── Payfinia_Deliverable2_Migration_ROI_Model.xlsx     (live Excel model, mirrors the Python)
│   └── rail_unit_economics/                                (one PDF per rail: 8-component cost stack)
│
├── 3_roi_calculator/        # Deliverable 4 — interactive Streamlit calculator
│   ├── roi_calculator.py
│   └── requirements.txt
│
├── 4_dashboard/             # Data-story Streamlit dashboard (the "why")
│   ├── app.py
│   ├── requirements.txt
│   └── HOW_TO_RUN_DASHBOARD.md
│
├── 5_presentation/          # Client readout deck
│   ├── Payfinia_Client_Presentation.pptx
│   └── Payfinia_Client_Presentation.pdf
│
├── requirements.txt         # Python deps for the apps
├── .gitignore
└── README.md
```

---

## How to run the interactive tools

Both the calculator and the dashboard are [Streamlit](https://streamlit.io) apps.

```bash
# from the repo root
pip install -r requirements.txt

# the ROI calculator (Deliverable 4)
streamlit run 3_roi_calculator/roi_calculator.py

# the data-story dashboard
streamlit run 4_dashboard/app.py
```

Run the Python model directly to print results for the three example CFIs:

```bash
python 2_roi_model/roi_model.py
```

---

## How the model works

Each rail's **fully-loaded cost per transaction** is built from 8 components:
network fee · processing/labor · failure & exception · fraud loss · fraud
prevention · compliance · reconciliation · liquidity. The model then applies a
**substitution rate** (share of each legacy rail that migrates), computes the
**savings per migrated transaction** (legacy cost − instant cost), and rolls that
into **net annual benefit, ROI, payback, and 5-year NPV**.

**Key findings**
- Savings come from displacing **checks (~$3/txn)** and **wires (~$18.57/txn)**, not ACH.
- Instant payments are **not free** (~$0.77/txn fully loaded).
- Migrating standard **ACH loses money** — it is already cheaper than instant.

---

## Data sources & integrity

Every benchmark traces to a public source (Federal Reserve, Nacha, The Clearing
House, AFP Payments Fraud Survey, FFIEC, Banco Central do Brasil, Pay.UK).
Sources with links are listed on the "Sources" tabs of the workbooks and in the
calculator's sources panel.

Cost lines that are **not directly citable** (per-item processing, fraud
prevention, compliance, reconciliation, liquidity) are **labelled as estimates**,
not presented as sourced facts. All figures are conservative public-benchmark
midpoints and are **illustrative until calibrated with Payfinia production data**.

*This is an analytical estimate, not a guarantee of savings.*
