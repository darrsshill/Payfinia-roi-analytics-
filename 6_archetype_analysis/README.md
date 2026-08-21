# Deliverable 3 — CFI Archetype Analysis (unsupervised ML)

Groups U.S. community banks into archetypes and maps each to an expected
migration-ROI range, so Payfinia can tier its prospect pipeline.

## Run
```bash
pip install -r requirements.txt
python archetype_analysis.py     # writes charts + summary to outputs/
```

## Data (REAL)
`data/fdic_cfi_sample.csv` — 400 active U.S. community banks ($10M–$10B assets)
pulled from the public FDIC BankFind API. Fields (all $ in thousands):
total assets, deposits, branch offices, net income.

API query used:
`https://banks.data.fdic.gov/api/institutions?filters=ACTIVE:1 AND ASSET:[10000 TO 10000000]&fields=ASSET,DEP,OFFICES,NETINC&limit=400`

## Method
1. **Feature engineering** — log assets, log offices, assets-per-office, deposit
   ratio, ROA (the axes on which community banks actually differ).
2. **StandardScaler** — standardize features so no one axis dominates.
3. **K-Means** — k chosen with reference to silhouette + elbow. Scores are close
   across k (~0.20–0.25): CFIs vary along a **size continuum**, so we pick **k=4**
   for four actionable tiers (documented business choice, not a metric artifact).
4. **PCA (2-D)** — visualize the clusters (PC1 ≈ 41% variance = size/scale).
5. **Archetype → ROI** — run the Deliverable-2 model on each archetype's
   representative profile at conservative/base/aggressive migration shares.

## Findings (this sample)
| Archetype | n | Median assets | Expected ROI range |
|---|---|---|---|
| Micro community banks | 139 | $139M | 16% – 127% |
| Small single-market banks | 43 | $228M | 28% – 163% |
| Mid-size multi-branch banks | 152 | $284M | 34% – 181% |
| Large community / regional banks | 66 | $1.35B | 98% – 373% |

## Honest caveats
- **Rail-mix volumes are estimated from asset size** (FDIC has no payment-rail
  detail) — the main calibration gap. Asset/deposit/office/income are REAL.
- Credit unions (NCUA) are not in the FDIC feed; add the NCUA call-report extract
  to extend coverage.
- Clusters are size-driven tiers, not crisply separated segments — expected for a
  population that varies continuously.
