"""
=============================================================================
PAYFINIA — CFI ARCHETYPE ANALYSIS  (Deliverable 3)
=============================================================================
Goal (from the project brief): characterize Community Financial Institutions
into "archetypes" using an unsupervised ML technique, then map each archetype
to an expected migration-ROI range so Payfinia can TIER its prospect pipeline.

DATA (real): a sample of active U.S. community banks ($10M–$10B in assets)
pulled from the public FDIC BankFind API (banks.data.fdic.gov). Fields:
total assets, deposits, branch offices, and net income. All dollar fields are
in $thousands. See data/fdic_cfi_sample.csv and README.md for the exact query.

APPROACH (unsupervised): standardize engineered features -> K-Means clustering
(k chosen by silhouette score) -> PCA for a 2-D visual -> name the clusters ->
run the Deliverable-2 ROI model on each archetype's representative profile to
attach an expected ROI range.

Run:  python archetype_analysis.py
=============================================================================
"""
import os
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "outputs")
os.makedirs(OUT, exist_ok=True)
NAVY="#1F3864"; BLUE="#2E5496"; TEAL="#2EC4B6"; AMBER="#F4A259"; RED="#E76F51"
PALETTE=[BLUE, TEAL, AMBER, RED, "#8E7CC3", "#1B998B"]

# --------------------------------------------------------------------------
# 1. LOAD real FDIC data
# --------------------------------------------------------------------------
df = pd.read_csv(os.path.join(HERE, "data", "fdic_cfi_sample.csv"))
df = df[(df.asset_k > 0) & (df.offices > 0)].copy()
print(f"Loaded {len(df)} real community banks (FDIC, $10M-$10B assets).")

# --------------------------------------------------------------------------
# 2. FEATURE ENGINEERING
#    Size, network, funding mix, efficiency, profitability — the axes on which
#    community banks actually differ. Logs tame the heavy right-skew of $ sizes.
# --------------------------------------------------------------------------
df["log_assets"]        = np.log10(df.asset_k)
df["log_offices"]       = np.log1p(df.offices)
df["assets_per_office"] = df.asset_k / df.offices
df["log_apo"]           = np.log10(df.assets_per_office)
df["deposit_ratio"]     = df.dep_k / df.asset_k          # how deposit-funded
df["roa"]               = df.netinc_k / df.asset_k        # return on assets

FEATURES = ["log_assets", "log_offices", "log_apo", "deposit_ratio", "roa"]
X = StandardScaler().fit_transform(df[FEATURES].values)

# --------------------------------------------------------------------------
# 3. CHOOSE k BY SILHOUETTE (with elbow inertia for context)
# --------------------------------------------------------------------------
ks = range(2, 8)
inertia, sil = [], []
for k in ks:
    km = KMeans(n_clusters=k, n_init=10, random_state=42).fit(X)
    inertia.append(km.inertia_)
    sil.append(silhouette_score(X, km.labels_))
sil_best = list(ks)[int(np.argmax(sil))]
print("Silhouette by k: " + ", ".join(f"{k}:{s:.3f}" for k, s in zip(ks, sil)))
# The silhouette scores are close across k (~0.20-0.25): community banks vary
# along a size CONTINUUM, not in crisp blobs. We therefore choose k=4 to give
# the go-to-market team four ACTIONABLE ROI tiers, rather than the 2 the raw
# silhouette narrowly favors. This is a documented business-interpretability
# choice, not an artifact of the metric.
best_k = 4
print(f"Silhouette narrowly favors k={sil_best} (continuum). Using k={best_k} for actionable prospect tiering.")

km = KMeans(n_clusters=best_k, n_init=20, random_state=42).fit(X)
df["cluster"] = km.labels_

# --------------------------------------------------------------------------
# 4. PCA (2-D) for visualization
# --------------------------------------------------------------------------
pca = PCA(n_components=2, random_state=42)
coords = pca.fit_transform(X)
df["pc1"], df["pc2"] = coords[:, 0], coords[:, 1]
print(f"PCA explained variance: PC1 {pca.explained_variance_ratio_[0]*100:.0f}%, "
      f"PC2 {pca.explained_variance_ratio_[1]*100:.0f}%")

# --------------------------------------------------------------------------
# 5. NAME THE ARCHETYPES (order clusters by median asset size)
# --------------------------------------------------------------------------
order = df.groupby("cluster").asset_k.median().sort_values().index.tolist()
NAMES_BY_SIZE = {
    3: ["Micro community banks", "Core community banks", "Large community / regional banks"],
    4: ["Micro community banks", "Small single-market banks", "Mid-size multi-branch banks", "Large community / regional banks"],
    5: ["Micro community banks", "Small single-market banks", "Mid-size banks", "Upper-mid multi-branch banks", "Large community / regional banks"],
}
names = NAMES_BY_SIZE.get(best_k, [f"Archetype {i+1}" for i in range(best_k)])
label_map = {cl: names[i] for i, cl in enumerate(order)}
df["archetype"] = df.cluster.map(label_map)

# --------------------------------------------------------------------------
# 6. MAP EACH ARCHETYPE TO AN ROI RANGE (Deliverable-2 model)
#    Volumes are estimated from asset size by scaling our $1B reference profile
#    (an ESTIMATE — real rail mix is the calibration gap). ROI range = running
#    the model at conservative (0.5x) and aggressive (1.5x) migration shares.
# --------------------------------------------------------------------------
RAIL_TOTAL = {"Check": 2.98, "Wire": 18.57, "Same-Day ACH": 1.34, "ACH": 0.40}
INSTANT = 0.77
SUBST = {"Check": 0.25, "Wire": 0.30, "Same-Day ACH": 0.20, "ACH": 0.05}
REF_ASSET = 1_000_000            # $1B reference, in $thousands
REF_VOL = {"Check": 600_000, "Wire": 12_000, "Same-Day ACH": 150_000, "ACH": 2_500_000}
REF_ONE_TIME, REF_ANNUAL = 150_000, 60_000

def roi_for_asset(asset_k, mult=1.0):
    scale = asset_k / REF_ASSET
    gross = 0.0
    for rail, vol in REF_VOL.items():
        migrated = vol * scale * min(SUBST[rail] * mult, 1.0)
        gross += migrated * (RAIL_TOTAL[rail] - INSTANT)
    one_time = REF_ONE_TIME * (scale ** 0.6)      # setup scales sublinearly
    annual = REF_ANNUAL * (scale ** 0.6)
    net = gross - annual
    roi = net / one_time if one_time else 0
    return net, roi

rows = []
for cl in order:
    sub = df[df.cluster == cl]
    med_asset = sub.asset_k.median()
    net_c, roi_c = roi_for_asset(med_asset, 0.5)   # conservative
    net_b, roi_b = roi_for_asset(med_asset, 1.0)   # base
    net_a, roi_a = roi_for_asset(med_asset, 1.5)   # aggressive
    rows.append({
        "Archetype": label_map[cl],
        "Institutions (n)": len(sub),
        "Median assets ($M)": round(med_asset / 1000, 1),
        "Median offices": int(sub.offices.median()),
        "Median ROA (%)": round(sub.roa.median() * 100, 2),
        "Est. net benefit / yr ($)": f"${net_b:,.0f}",
        "Expected ROI range": f"{roi_c*100:,.0f}% – {roi_a*100:,.0f}%",
    })
summary = pd.DataFrame(rows)
summary.to_csv(os.path.join(OUT, "archetype_roi_summary.csv"), index=False)

print("\n" + "=" * 78)
print("CFI ARCHETYPES -> EXPECTED MIGRATION ROI")
print("=" * 78)
print(summary.to_string(index=False))

# --------------------------------------------------------------------------
# 7. CHARTS
# --------------------------------------------------------------------------
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.edgecolor": "#cccccc"})

# (a) silhouette + elbow
fig, ax = plt.subplots(1, 2, figsize=(10, 3.6))
ax[0].plot(list(ks), inertia, "o-", color=BLUE); ax[0].set_title("Elbow (inertia)")
ax[0].set_xlabel("k clusters"); ax[0].set_ylabel("inertia")
ax[1].plot(list(ks), sil, "o-", color=TEAL); ax[1].axvline(best_k, ls="--", color=AMBER)
ax[1].set_title(f"Silhouette (chosen k={best_k})"); ax[1].set_xlabel("k clusters"); ax[1].set_ylabel("score")
for a in ax: a.grid(alpha=.25)
plt.tight_layout(); plt.savefig(os.path.join(OUT, "01_choose_k.png"), dpi=140); plt.close()

# (b) PCA scatter by archetype
plt.figure(figsize=(7.5, 5.2))
for i, cl in enumerate(order):
    s = df[df.cluster == cl]
    plt.scatter(s.pc1, s.pc2, s=26, alpha=.75, color=PALETTE[i % len(PALETTE)], label=label_map[cl], edgecolors="white", linewidths=.4)
plt.xlabel(f"PC1 ({pca.explained_variance_ratio_[0]*100:.0f}% var)")
plt.ylabel(f"PC2 ({pca.explained_variance_ratio_[1]*100:.0f}% var)")
plt.title("CFI archetypes (K-Means clusters in PCA space)", color=NAVY, fontweight="bold")
plt.legend(fontsize=8, frameon=False); plt.grid(alpha=.2)
plt.tight_layout(); plt.savefig(os.path.join(OUT, "02_pca_clusters.png"), dpi=140); plt.close()

# (c) archetype profile: median assets & offices
fig, ax = plt.subplots(1, 2, figsize=(11, 3.8))
names_o = [label_map[cl] for cl in order]
med_assets = [df[df.cluster == cl].asset_k.median() / 1000 for cl in order]
med_off = [df[df.cluster == cl].offices.median() for cl in order]
ax[0].barh(names_o, med_assets, color=[PALETTE[i % len(PALETTE)] for i in range(len(order))])
ax[0].set_title("Median assets ($M)"); ax[0].invert_yaxis()
ax[1].barh(names_o, med_off, color=[PALETTE[i % len(PALETTE)] for i in range(len(order))])
ax[1].set_title("Median branch offices"); ax[1].invert_yaxis()
for a in ax: a.grid(alpha=.2, axis="x")
plt.tight_layout(); plt.savefig(os.path.join(OUT, "03_archetype_profiles.png"), dpi=140); plt.close()

# (d) archetype -> ROI (base-case net benefit)
plt.figure(figsize=(8.5, 4))
nets = [roi_for_asset(df[df.cluster == cl].asset_k.median(), 1.0)[0] for cl in order]
plt.barh(names_o, nets, color=[PALETTE[i % len(PALETTE)] for i in range(len(order))])
plt.gca().invert_yaxis(); plt.xlabel("Estimated net annual benefit ($)")
plt.title("Expected migration benefit by archetype (base case)", color=NAVY, fontweight="bold")
plt.grid(alpha=.2, axis="x")
plt.tight_layout(); plt.savefig(os.path.join(OUT, "04_archetype_roi.png"), dpi=140); plt.close()

print(f"\nSaved 4 charts + summary CSV to: {OUT}")
print("NOTE: rail-mix volumes are estimated from asset size (calibration gap); "
      "asset, deposits, offices, net income are REAL FDIC data.")
