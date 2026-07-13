"""
Payfinia Prospect Finder — shared scoring logic.
Turns a bank's public FDIC profile into a migration-ROI 'Priority Score'.
Used by the loader (fetch_payfinia_banks.py), the Streamlit app, and the
React export. Mirrors the Deliverable-2 ROI model.
"""
import pandas as pd

# ROI model constants (must match roi_model.py / the calculator)
RAIL_TOTAL = {"Check": 2.98, "Wire": 18.57, "Same-Day ACH": 1.34, "ACH": 0.40}
INSTANT = 0.77
SUBST = {"Check": 0.25, "Wire": 0.30, "Same-Day ACH": 0.20, "ACH": 0.05}
REF_ASSET_K = 1_000_000                       # $1B reference (in $thousands)
REF_VOL = {"Check": 600_000, "Wire": 12_000, "Same-Day ACH": 150_000, "ACH": 2_500_000}
REF_ONE_TIME, REF_ANNUAL = 150_000, 60_000

def roi_for_asset(asset_k, mult=1.0):
    """Estimated (net annual benefit $, ROI ratio) for a bank of this asset size.
    Volumes are scaled from the $1B reference profile (ESTIMATE — real rail mix
    is the calibration gap). mult scales the migration share (0.5=conservative)."""
    scale = asset_k / REF_ASSET_K
    gross = 0.0
    for rail, vol in REF_VOL.items():
        migrated = vol * scale * min(SUBST[rail] * mult, 1.0)
        gross += migrated * (RAIL_TOTAL[rail] - INSTANT)
    one_time = REF_ONE_TIME * (scale ** 0.6)
    annual = REF_ANNUAL * (scale ** 0.6)
    net = gross - annual
    roi = net / one_time if one_time else 0.0
    return net, roi

def tier_for_asset(asset_k):
    m = asset_k / 1000.0                        # assets in $M
    if m < 250:   return "Micro community"
    if m < 1000:  return "Small community"
    if m < 3000:  return "Mid-size / multi-branch"
    return "Large / regional"

def score_dataframe(df):
    """Add priority columns and rank by $ value. Expects columns:
    name, state, city, asset_k, offices, netinc_k, dep_k."""
    df = df.copy()
    df["est_net_benefit"] = df.asset_k.apply(lambda a: roi_for_asset(a, 1.0)[0])
    df["roi_pct"] = df.asset_k.apply(lambda a: roi_for_asset(a, 1.0)[1] * 100)
    # conservative / aggressive bounds for a range
    df["net_low"] = df.asset_k.apply(lambda a: roi_for_asset(a, 0.5)[0])
    df["net_high"] = df.asset_k.apply(lambda a: roi_for_asset(a, 1.5)[0])
    df["tier"] = df.asset_k.apply(tier_for_asset)
    df["assets_musd"] = (df.asset_k / 1000).round(1)
    df = df.sort_values("est_net_benefit", ascending=False).reset_index(drop=True)
    df.insert(0, "priority_rank", df.index + 1)
    return df
