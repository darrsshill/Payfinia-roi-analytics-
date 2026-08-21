# Payfinia — Project Status

**Project:** Money Movement Analytics & Migration ROI
**As of:** July 2026

---

## 1. Snapshot

| Deliverable | Status | Location |
|---|---|---|
| 1 · Public Data Synthesis | Complete | `1_data_synthesis/` (xlsx + docx) |
| 2 · Migration ROI Model | Complete — carries the flat cost model, pending the v4 segment refactor | `2_roi_model/` (Python + live Excel + 5 rail PDFs) |
| 3 · CFI Archetype Analysis (ML) | Complete | `6_archetype_analysis/` |
| 4 · Interactive ROI Calculator | Complete — **v4, modular by customer segment** | `5_web_calculator/` (React) · `3_roi_calculator/` (Streamlit, still flat) |
| Prospect Finder *(extension)* | Complete — deferred, not part of the core scope | `7_prospect_finder/` |
| Production-data calibration | Pending — requires Payfinia production data | — |

All four brief deliverables are built and functional. The React calculator has been refactored so
that Retail, Business and Internal volume are costed independently and aggregated. Remaining work is
production-data calibration, propagating the segment refactor to the Python/Excel/Streamlit twins,
and the deferred API-ingestion work.

> **Two open methodology flags** are carried in `5_web_calculator/src/data.js` (`METHOD_FLAGS`) and
> displayed in the application. Both should be resolved before the calculator is used in a
> customer-facing setting — see `5_web_calculator/CHANGELOG_v4.md` §6.

---

## 2. What is built

**Data synthesis.** Aggregated rail volumes, per-transaction costs, fraud incidence, and
international substitution (Pix, UK FPS) from the Federal Reserve, Nacha, The Clearing House, AFP and
FFIEC. Every figure carries a source and a data-quality rating. The wire figure is set to the exact
Fedwire annual number; debit, credit and Zelle are included.

**ROI model.** Per-rail cost is built from a full taxonomy and grouped into **three layers** —
network fee · provider (Payfinia/TPSP) fee · FI internal cost. Logic: substitution rate →
savings per transaction (legacy − instant) → net benefit, ROI, payback, 5-year NPV. Delivered as a
documented Python module and a live Excel model that reconcile to the dollar. Key finding: instant is
approximately $0.77–0.87 per transaction all-in; **ACH migration is net-negative** — the savings come
from checks and wires.

**Unsupervised ML (archetypes and prospects).** The full **4,089** active U.S. community banks were
pulled live from the FDIC BankFind API, feature-engineered (log assets, log offices, branch density),
standardized, and clustered with **K-means** (silhouette 0.39) into four target segments (A–D), with
PCA used for visualization. Each segment is mapped to an expected ROI range via the ROI model,
producing a ranked prioritization list across all 4,089 banks.

**Interactive calculator.** React (Vite, Vercel-ready) plus a Streamlit twin. Implements the
three-layer cost split, **mini-calculators** that derive per-item costs from figures a bank already
has (staff × salary ÷ volume, fraud $ ÷ volume, and similar), a "Use My Financials" override, a
**sanity check** against call-report totals, a monthly/annual toggle, comma formatting, a single
"Instant Payments" destination, origination framing (ACH-shrinking), and a guided Savings Assistant.

**Repository and documentation.** Organized into seven numbered folders with a hardened
`.gitignore`, a root README with quick-start and reproduce steps, and a README per component.

---

## 3. Key results

- **Mid-size CFI (~$1B assets):** approximately **$300K/year** net benefit, payback in months.
- **Prospect segmentation (4,089 banks):**

| Segment | Banks | Opportunity / yr | Avg ROI |
|---|---|---|---|
| A — Target first | 439 | $551M | 359% |
| B — Strong | 1,128 | $394M | 200% |
| C — Moderate | 1,574 | $159M | 116% |
| D — Low priority | 948 | $20M | 53% |

**Recommendation:** prioritize Segment A (large and regional CFIs) — the highest value and the
highest ROI.

---

## 4. Remaining work

**High priority**

- **Calibrate with Payfinia production data.** The model's estimated inputs — fraud loss per item,
  true processing cost per item, real substitution rates, and each institution's actual rail mix —
  are the single largest accuracy lever and the main open item.
- **Resolve the two high-severity methodology flags:** the measurement-basis mismatch between the
  Retail and Business columns, and the retail wire cost currently exceeding the business wire cost.
  See `5_web_calculator/CHANGELOG_v4.md` §6.
- **Propagate the segment refactor** to `2_roi_model/roi_model.py`, the Excel model and the Streamlit
  twin. These still carry the flat model and no longer agree with the React application.

**Planned enhancements**

- **API-first ingestion (CSV/JSON)** so FDIC/NCUA data can auto-generate ROI reports.
- **Call-report defaults** — pull default cost ranges directly from NCUA/FDIC call-report fields into
  the calculator.
- **Origination logic** — deepen the ACH-shrinking model, specifically the credit-push share that can
  move to instant.
- **Input persistence** — a database layer to store calculator inputs across sessions; design is
  documented in `5_web_calculator/DATABASE_SETUP.md`.
- **Deployment** — publish the React calculator and prospect finder to Vercel for shareable links.

**Polish**

- Apply the calculator's UI treatment to the Prospect Finder and Streamlit applications for
  consistency.
- Align the per-folder READMEs with the root README style.

---

## 5. Suggested sequence

1. Obtain a sample of Payfinia production figures and begin calibration.
2. Resolve the two methodology flags and re-derive the retail wire cost.
3. Propagate the segment refactor to the Python, Excel and Streamlit models.
4. Implement call-report defaults and input persistence.
5. Deploy both React applications.

---

*This is an analytical estimate framework, not a guarantee of savings. All public-source figures are
cited and all estimates are flagged as calibration targets.*
