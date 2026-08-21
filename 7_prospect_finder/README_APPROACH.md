# Payfinia Prospect Finder — how it works & how to run it

**What it does:** ranks every U.S. community bank by the dollars it stands to
save by migrating to instant payments, so the go-to-market team knows **who to
call first.**

---

## The approach (for the Payfinia team)

**Step 1 — Pull the bank universe (real data).**
`fetch_payfinia_banks.py` calls the public **FDIC BankFind API** and pulls every
active community bank ($10M–$10B in assets) — about **4,089 banks** — with their
name, state, city, total assets, deposits, branch offices, and net income.
This is the same official data regulators and analysts use.
Source: https://banks.data.fdic.gov/bankfind-suite/

**Step 2 — Score each bank (Priority Score).**
For every bank the tool runs the Deliverable-2 ROI model on *its own* size to estimate
the **net annual benefit** it would get from migrating (its "Priority Score").
Bigger volume → bigger dollar savings → higher priority.

**Step 3 — Tier & rank.**
Each bank is tagged with a size **tier** (Micro / Small / Mid-size / Large-regional)
and the whole list is sorted high-to-low by dollar value. **The top of the list is
the most important customer.**

**Step 4 — Find your customers.**
The apps let the team filter by state, tier, asset size, and search by name, then
export a "call these first" CSV.

---

## What is real vs. estimated
- **REAL:** every bank's name, state, assets, deposits, offices, income — direct
  from the FDIC API.
- **ESTIMATED:** each bank's exact payment-rail mix (checks vs. wires vs. ACH) —
  FDIC doesn't publish this, so we scale it from asset size. This is the one
  number to calibrate later with Payfinia's real data.
- The Priority Score is an **estimate of opportunity size, not a guarantee.**

---

## How to run

### Refresh the full bank list (all ~4,089, with names)
```bash
pip install -r requirements.txt
python fetch_payfinia_banks.py        # writes data/payfinia_bank_prospects.csv
```
(Run on a machine with internet access to the FDIC API. Ships with 50 real top
prospects so the apps work before you run this.)

### Python app (Streamlit)
```bash
streamlit run prospect_finder_app.py
```

### Web app (React / Vite) — deployable on Vercel
```bash
cd web
npm install
npm run dev        # local
npm run build      # production build in dist/
```
On Vercel, set **Root Directory** to `7_prospect_finder/web`.
Note: after refreshing the CSV, regenerate the web data with
`python -c "import pandas as pd; pd.read_csv('data/payfinia_bank_prospects.csv').to_json('web/src/prospects.json', orient='records')"`.

---

## Files
```
7_prospect_finder/
├── fetch_payfinia_banks.py     # loader — pulls all ~4,089 banks & scores them
├── scoring.py                  # the Priority-Score logic (shared)
├── prospect_finder_app.py      # Streamlit prospect finder
├── data/payfinia_bank_prospects.csv   # scored, ranked prospects (50 real to start)
├── web/                        # React (Vite) prospect finder — deploy to Vercel
├── requirements.txt
└── README_APPROACH.md          # this file
```
