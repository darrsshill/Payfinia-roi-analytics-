# Payfinia — Project Status Report

**Project:** Money Movement Analytics & Migration ROI · **Team:** USF FinTech Graduate Project
**As of:** July 2026 · **Repo:** github.com/darrsshill/Payfinia-roi-analytics-

---

## 1. Snapshot

| Brief deliverable | Status | Artifact |
|---|---|---|
| 1 · Public Data Synthesis | ✅ Complete | `1_data_synthesis/` (xlsx + docx) |
| 2 · Migration ROI Model | ✅ Complete | `2_roi_model/` (Python + live Excel + 5 rail PDFs) |
| 3 · CFI Archetype Analysis (ML) | ✅ Complete | `7_archetype_analysis/` + `8_prospect_finder/` |
| 4 · Interactive ROI Calculator | ✅ Complete (v3, wizard + compare + overrides) | `6_web_calculator/` (React) + `3_roi_calculator/` (Streamlit) |
| Production-data calibration | ⏳ Pending (needs Payfinia data) | — |

Overall: **all four brief deliverables built and functional.** Remaining work is calibration,
deployment, and refinements from client feedback — not net-new deliverables.

---

## 2. What's done (technical)

**Data synthesis.** Aggregated rail volumes, per-transaction costs, fraud incidence, and
international substitution (Pix, UK FPS) from Federal Reserve, Nacha, The Clearing House, AFP,
FFIEC. Every figure carries a source + data-quality rating. Wire figure corrected to the exact
Fedwire annual number; debit/credit/Zelle added.

**ROI model.** Per-rail cost built from a full taxonomy, now grouped into **3 layers** —
network fee · provider (Payfinia/TPSP) fee · FI internal cost. Logic: substitution rate →
savings/txn (legacy − instant) → net benefit, ROI, payback, 5-yr NPV. Delivered as a documented
Python module and a live Excel model that reconcile to the dollar. Key finding: instant ≈
$0.77–0.87/txn all-in; **ACH migration is net-negative** — savings come from checks and wires.

**Unsupervised ML (archetypes + prospects).** Pulled the full **4,089** active U.S. community
banks live from the FDIC BankFind API. Feature-engineered (log assets, log offices, branch
density), standardized, and ran **K-means** (silhouette 0.39) into four target segments (A–D),
with PCA for visualization. Each segment is mapped to an expected ROI range via the ROI model.
Output: a ranked "who to call first" list across all 4,089 banks.

**Interactive calculator (v3, client-feedback build).** React (Vite, Vercel-ready) + Streamlit.
Implements the client's requests: 3-layer cost split, **mini-calculators** that derive per-item
costs from figures a bank actually has (staff × salary ÷ volume, fraud $ ÷ volume, etc.),
"Use My Financials" override, a **sanity check** vs. call-report totals, monthly/annual toggle,
comma formatting, single "Instant Payments" destination, origination framing (ACH-shrinking),
and a guided Savings Assistant. Redesigned UI (Space Grotesk/Inter, tabular numerals).

**Repo & docs.** Reorganized into 8 numbered folders, hardened `.gitignore`, professional root
README with quick-start and reproduce steps.

---

## 3. Key results

- **Mid-size CFI (~$1B):** ~**$300K/yr** net benefit, payback in months.
- **Prospect segmentation (4,089 banks):**

| Segment | Banks | Opportunity / yr | Avg ROI |
|---|---|---|---|
| A — Target first | 439 | $551M | 359% |
| B — Strong | 1,128 | $394M | 200% |
| C — Moderate | 1,574 | $159M | 116% |
| D — Low priority | 948 | $20M | 53% |

**Recommendation:** prioritize Segment A (large/regional CFIs) — highest value and ROI.

---

## 4. What's remaining

**High priority**
- **Calibrate with Payfinia production data** — the model's estimated inputs (fraud loss/item,
  true processing cost/item, real substitution rates, and each bank's actual rail mix). This is
  the single biggest accuracy lever and the main open item.
- **Database** — persist customer inputs from the calculator (team: Hamza, on a branch).
- **Deploy** the React calculator and prospect finder to Vercel for live shareable links.

**From client feedback (Justin & Nizar) — partially open**
- Pull default cost ranges directly from NCUA/FDIC **call-report** fields into the calculator.
- Deepen the **origination / ACH-shrinking** logic (credit-push share that can go instant).
- Additional mini-calculators (compliance time, reconciliation time).

**Polish**
- Apply the new premium UI to the Prospect Finder + Streamlit apps for consistency.
- Align the per-folder READMEs with the root style.
- Push latest work to GitHub.

**Course deliverable**
- Final Week-10 readout to Payfinia leadership + USF faculty (deck ready; add live-tool demo).

---

## 5. Next steps (suggested order)
1. Push current repo to GitHub; deploy both React apps to Vercel.
2. Request a sample of Payfinia production numbers to begin calibration.
3. Implement call-report defaults + database persistence (parallel, on branches).
4. Prepare the final readout with a live demo of the calculator + prospect finder.

*This is an analytical estimate framework, not a guarantee of savings; all public-source figures
are cited and all estimates are flagged for calibration.*
