"""
=============================================================================
PAYFINIA PROSPECT FINDER — data loader
Pulls EVERY active U.S. community bank ($10M-$10B assets) from the public
FDIC BankFind API, scores each one by migration-ROI value, ranks them, and
writes data/payfinia_bank_prospects.csv.

Run this to refresh the full universe (~4,089 banks) with real names:
    pip install requests pandas
    python fetch_payfinia_banks.py

Source: FDIC BankFind Suite — https://banks.data.fdic.gov/bankfind-suite/
Note: run this on your own machine (needs outbound internet to the FDIC API).
=============================================================================
"""
import os
import time
import requests
import pandas as pd
from scoring import score_dataframe

BASE = "https://banks.data.fdic.gov/api/institutions"
FILTERS = "ACTIVE:1 AND ASSET:[10000 TO 10000000]"      # community banks: $10M-$10B
FIELDS = "NAME,STALP,CITY,ASSET,OFFICES,NETINC,DEP"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data", "payfinia_bank_prospects.csv")

def pull_all(page=1000):
    rows, offset = [], 0
    while True:
        r = requests.get(BASE, params={
            "filters": FILTERS, "fields": FIELDS,
            "limit": page, "offset": offset, "format": "json",
            "sort_by": "ASSET", "sort_order": "DESC",
        }, timeout=60)
        r.raise_for_status()
        data = r.json().get("data", [])
        if not data:
            break
        rows += [d["data"] for d in data]
        print(f"  pulled {len(rows)} banks...")
        offset += page
        if len(data) < page:
            break
        time.sleep(0.3)                          # be polite to the API
    return rows

def main():
    print("Pulling all active community banks from the FDIC API...")
    raw = pull_all()
    df = pd.DataFrame(raw).rename(columns={
        "NAME": "name", "STALP": "state", "CITY": "city",
        "ASSET": "asset_k", "OFFICES": "offices", "NETINC": "netinc_k", "DEP": "dep_k",
    })
    for c in ["asset_k", "offices", "netinc_k", "dep_k"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=["asset_k"]).fillna({"offices": 1, "netinc_k": 0, "dep_k": 0})
    scored = score_dataframe(df)
    cols = ["priority_rank", "name", "state", "city", "tier", "assets_musd",
            "offices", "est_net_benefit", "net_low", "net_high", "roi_pct"]
    scored[cols].to_csv(OUT, index=False)
    print(f"\nDone. {len(scored)} banks scored & ranked -> {OUT}")
    print(f"Top prospect: {scored.iloc[0]['name']} ({scored.iloc[0]['state']}) "
          f"~${scored.iloc[0]['est_net_benefit']:,.0f}/yr")

if __name__ == "__main__":
    main()
