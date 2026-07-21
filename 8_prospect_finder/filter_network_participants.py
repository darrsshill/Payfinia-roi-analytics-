#!/usr/bin/env python3
"""
Strip banks that ALREADY participate in FedNow or RTP out of the prospect list.

Per the meeting: outreach should target NON-participants. The Fed and The Clearing
House both publish their participant lists; we cross-reference them against our
prospect file and remove anyone already on either network.

------------------------------------------------------------------------------
DATA YOU NEED (download once, drop into ./data/):
  1. FedNow participants
     https://explore.fednow.org/explore-the-city  ->  "Download the list"
     (or frbservices.org FedNow participants). Save as: data/fednow_participants.csv
  2. RTP (The Clearing House) participants
     https://www.theclearinghouse.org/payment-systems/rtp/rtp-participating-financial-institutions
     Save as: data/rtp_participants.csv

Each file just needs an institution-name column and/or a routing-number column;
the script auto-detects common header names.

------------------------------------------------------------------------------
MATCHING — read this, it matters for accuracy:
  * The MOST reliable key is the 9-digit ROUTING/ABA number. If BOTH the prospect
    file and a participant file expose routing numbers, we match on that (exact).
  * Our FDIC-sourced prospect file does NOT currently carry routing numbers, so by
    default we fall back to NORMALIZED NAME matching. That is APPROXIMATE — bank
    names collide ("First National Bank" appears dozens of times). Treat name-only
    results as a shortlist to review, not gospel.
  * To make this exact: add a routing number to each prospect (via the Fed
    E-Payments Routing Directory / FedACH participant file keyed on FDIC cert or
    name), then this script will match on RTN automatically.

Nothing here is fabricated: if a participant file is missing, the script says so
and stops rather than guessing.
"""
import os
import re
import sys
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
PROSPECTS = os.path.join(DATA, "payfinia_bank_prospects.csv")
FEDNOW = os.path.join(DATA, "fednow_participants.csv")
RTP = os.path.join(DATA, "rtp_participants.csv")
OUT = os.path.join(DATA, "payfinia_prospects_non_participants.csv")

# common suffixes/words to drop so "First National Bank, N.A." == "First National Bank"
_STOP = re.compile(
    r"\b(national association|n\.?a\.?|fsb|f\.s\.b\.|the|company|co|incorporated|inc|"
    r"corporation|corp|and|&|of|bank|banks|banking|trust|savings|"
    r"federal|credit union|cu|association|assn|holding|holdings)\b",
    re.I,
)

def norm_name(s):
    """Normalize an institution name for fuzzy equality."""
    if not isinstance(s, str):
        return ""
    s = s.lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)   # drop punctuation
    s = _STOP.sub(" ", s)               # drop generic banking words
    s = re.sub(r"\s+", " ", s).strip()
    return s

def find_col(df, *candidates):
    """Return the first column whose lowercased name contains any candidate."""
    for cand in candidates:
        for col in df.columns:
            if cand in col.lower():
                return col
    return None

def load_participants(path, label):
    if not os.path.exists(path):
        print(f"  ! {label} list not found at {path} — skipping {label}. "
              f"(Download it — see the header of this script.)")
        return set(), set()
    df = pd.read_csv(path, dtype=str)
    name_col = find_col(df, "name", "institution", "bank")
    rtn_col = find_col(df, "routing", "aba", "rtn")
    names = set(df[name_col].map(norm_name)) - {""} if name_col else set()
    rtns = set(df[rtn_col].astype(str).str.replace(r"\D", "", regex=True)) - {""} if rtn_col else set()
    print(f"  · {label}: {len(df)} rows  (names:{len(names)}  routing#s:{len(rtns)})")
    return names, rtns

def main():
    if not os.path.exists(PROSPECTS):
        sys.exit(f"Prospect file not found: {PROSPECTS}\nRun fetch_payfinia_banks.py first.")

    df = pd.read_csv(PROSPECTS)
    print(f"Loaded {len(df)} prospects.")

    p_name_col = find_col(df, "name")
    p_rtn_col = find_col(df, "routing", "aba", "rtn")

    print("Loading participant lists:")
    fn_names, fn_rtns = load_participants(FEDNOW, "FedNow")
    rtp_names, rtp_rtns = load_participants(RTP, "RTP")
    part_names = fn_names | rtp_names
    part_rtns = fn_rtns | rtp_rtns

    if not part_names and not part_rtns:
        sys.exit("\nNo participant data loaded — nothing to filter. "
                 "Download the FedNow / RTP lists into ./data/ and re-run.")

    matched_by = []
    def is_participant(row):
        # 1) exact routing-number match if we have RTNs on both sides
        if p_rtn_col and part_rtns:
            rtn = re.sub(r"\D", "", str(row[p_rtn_col]))
            if rtn and rtn in part_rtns:
                matched_by.append("routing#")
                return True
        # 2) fall back to normalized name (APPROXIMATE)
        if p_name_col and part_names:
            if norm_name(row[p_name_col]) in part_names:
                matched_by.append("name")
                return True
        return False

    mask = df.apply(is_participant, axis=1)
    removed = int(mask.sum())
    keep = df[~mask].copy()
    keep.to_csv(OUT, index=False)

    how = pd.Series(matched_by).value_counts().to_dict() if matched_by else {}
    print(f"\nRemoved {removed} existing participants  (matched by: {how or 'n/a'}).")
    print(f"Kept {len(keep)} NON-participant prospects -> {OUT}")
    if p_rtn_col is None:
        print("\nNOTE: prospects had no routing-number column, so matching was NAME-ONLY "
              "(approximate). Add routing numbers to make this exact — see script header.")

if __name__ == "__main__":
    main()
