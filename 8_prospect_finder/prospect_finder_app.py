# =====================================================================
# PAYFINIA — PROSPECT FINDER  (Streamlit)
# Ranks real U.S. community banks by their migration-ROI value so the
# go-to-market team can see WHO to call first.
#
# Run:  pip install -r requirements.txt
#       python fetch_payfinia_banks.py   # (optional) pull all ~4,089 banks
#       streamlit run prospect_finder_app.py
# Data: FDIC BankFind API (real). Ships with 50 real top prospects; the
# loader upgrades to the full universe.
# =====================================================================
import os
import pandas as pd
import streamlit as st
import plotly.graph_objects as go

st.set_page_config(page_title="Payfinia | Prospect Finder", page_icon="🎯", layout="wide")
NAVY="#1F3864"; BLUE="#2E5496"; TEAL="#2EC4B6"; AMBER="#F4A259"; GREY="#5b6472"; GRID="#EEF2F7"; INK="#1c2431"; FONT="Arial"
TIER_COLOR = {"Micro community":"#9AA7C7","Small community":BLUE,"Mid-size / multi-branch":AMBER,"Large / regional":TEAL}

st.markdown(f"<style>h1,h2,h3{{color:{NAVY};}} .stMetric{{background:#F4F7FC;border-radius:10px;padding:12px;}}</style>", unsafe_allow_html=True)

HERE = os.path.dirname(os.path.abspath(__file__))
df = pd.read_csv(os.path.join(HERE, "data", "payfinia_bank_prospects.csv"))

st.title("🎯 Payfinia Prospect Finder")
st.markdown(f"<p style='color:{GREY};margin-top:-8px'>Every U.S. community bank, ranked by the dollars it stands to save "
            "by migrating to instant payments. <b>Top of the list = call first.</b> Data: FDIC BankFind (real).</p>",
            unsafe_allow_html=True)

# ---- filters ----
with st.sidebar:
    st.header("Filter prospects")
    states = sorted(df.state.dropna().unique().tolist())
    sel_states = st.multiselect("State", states, default=[])
    tiers = df.tier.unique().tolist()
    sel_tiers = st.multiselect("Bank type (tier)", tiers, default=tiers)
    amin, amax = int(df.assets_musd.min()), int(df.assets_musd.max())
    a_lo, a_hi = st.slider("Assets ($M)", amin, amax, (amin, amax))
    min_benefit = st.number_input("Min. estimated benefit ($/yr)", value=0, step=50000)
    search = st.text_input("Search bank name")

f = df.copy()
if sel_states: f = f[f.state.isin(sel_states)]
f = f[f.tier.isin(sel_tiers)]
f = f[(f.assets_musd >= a_lo) & (f.assets_musd <= a_hi)]
f = f[f.est_net_benefit >= min_benefit]
if search: f = f[f.name.str.contains(search, case=False, na=False)]
f = f.sort_values("est_net_benefit", ascending=False).reset_index(drop=True)

# ---- headline metrics ----
c1, c2, c3, c4 = st.columns(4)
c1.metric("Prospects shown", f"{len(f):,}")
c2.metric("Total opportunity / yr", f"${f.est_net_benefit.sum():,.0f}")
c3.metric("Top prospect", f["name"].iloc[0] if len(f) else "—")
c4.metric("Avg ROI", f"{f.roi_pct.mean():.0f}%" if len(f) else "—")

# ---- top-15 chart ----
st.subheader("Top prospects by estimated annual value")
top = f.head(15).iloc[::-1]
fig = go.Figure(go.Bar(
    x=top.est_net_benefit, y=top.name + " (" + top.state + ")", orientation="h",
    marker_color=[TIER_COLOR.get(t, BLUE) for t in top.tier],
    text=[f"${v:,.0f}" for v in top.est_net_benefit], textposition="outside", cliponaxis=False,
    textfont=dict(family=FONT, size=12, color=NAVY)))
fig.update_layout(template="plotly_white", height=440, margin=dict(l=8, r=110, t=8, b=30),
    font=dict(family=FONT, color=INK),
    xaxis=dict(title="Estimated net benefit ($/yr)", showgrid=True, gridcolor=GRID, zeroline=False,
               tickfont=dict(color=GREY, size=11)),
    yaxis=dict(title="", tickfont=dict(size=12, color=INK)),
    showlegend=False, plot_bgcolor="white", paper_bgcolor="white", bargap=0.3)
st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

# ---- ranked table ----
st.subheader("Ranked prospect list")
show = f[["priority_rank","name","state","city","tier","assets_musd","offices","est_net_benefit","roi_pct"]].copy()
show.columns = ["Rank","Bank","State","City","Type","Assets ($M)","Offices","Est. benefit / yr","ROI %"]
show["Est. benefit / yr"] = show["Est. benefit / yr"].map(lambda x: f"${x:,.0f}")
show["ROI %"] = show["ROI %"].map(lambda x: f"{x:.0f}%")
st.dataframe(show, use_container_width=True, hide_index=True, height=460)

st.download_button("⬇️ Download this list (CSV)", f.to_csv(index=False).encode("utf-8"),
                   "payfinia_prospects_filtered.csv", "text/csv")

st.caption("Bank facts (assets, deposits, offices, income) are REAL FDIC data. Estimated benefit uses the Deliverable-2 "
           "ROI model with rail-mix volumes scaled from asset size (the calibration gap). Ships with 50 real top prospects; "
           "run fetch_payfinia_banks.py to load all ~4,089. This is an estimate, not a guarantee.")
