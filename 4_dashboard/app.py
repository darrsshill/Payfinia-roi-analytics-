# =====================================================================
# PAYFINIA — Money Movement Analytics
# Data-Story Dashboard (Deliverable 1 companion)
#
# This is a Streamlit app. Streamlit turns a plain Python script into
# an interactive web dashboard. You run it with:  streamlit run app.py
#
# How the file is organized (read top to bottom):
#   1. Imports & page setup
#   2. Custom styling (Payfinia colors)
#   3. The DATA  (all figures from Deliverable 1, with sources)
#   4. The DASHBOARD layout, section by section
# Every chart has a short caption that says what the client should take away.
# =====================================================================

# ---- 1. IMPORTS & PAGE SETUP ----------------------------------------
import streamlit as st              # the dashboard framework
import pandas as pd                 # for holding data in tables
import plotly.express as px         # for nice interactive charts
import plotly.graph_objects as go

st.set_page_config(
    page_title="Payfinia | Money Movement Analytics",
    page_icon="💸",
    layout="wide",                  # use the full browser width
)

# ---- 2. CUSTOM STYLING (Payfinia navy/blue brand) -------------------
NAVY = "#1F3864"
BLUE = "#2E5496"
TEAL = "#2EC4B6"
AMBER = "#F4A259"
RED = "#E76F51"
GREY = "#595959"

# Color each rail consistently across every chart
RAIL_COLORS = {
    "Check": RED, "Wire": AMBER, "Same-Day ACH": "#9AA7C7",
    "ACH": BLUE, "FedNow": TEAL, "RTP": "#1B998B",
}

st.markdown(f"""
<style>
    .main {{ background-color: #FFFFFF; }}
    h1, h2, h3 {{ color: {NAVY}; }}
    .stMetric {{ background-color: #F4F7FC; border-radius: 10px; padding: 14px; }}
    .takeaway {{
        background-color: #F4F7FC; border-left: 5px solid {BLUE};
        padding: 12px 16px; border-radius: 6px; margin: 6px 0 18px 0;
        font-size: 0.95rem; color: {GREY};
    }}
    .rec-card {{
        background-color: #FFFFFF; border: 1px solid #E0E6F0;
        border-radius: 10px; padding: 16px; height: 100%;
    }}
</style>
""", unsafe_allow_html=True)

# ---- 3. THE DATA (from Deliverable 1 — public sources) --------------

# Rail volumes & value (latest full-year public figures)
volume_df = pd.DataFrame({
    "Rail":   ["ACH", "Same-Day ACH", "Check", "Wire", "FedNow", "RTP"],
    "Family": ["Legacy", "Legacy", "Legacy", "Legacy", "Instant", "Instant"],
    "Volume (billions)": [35.2, 1.4, 3.0, 0.205, 0.0109, 0.475],
    "Value ($ trillions)": [93.0, 3.9, 8.5, 1000.0, 0.853, 1.3],  # wire value nominal/very high
})

# Per-transaction fully-loaded cost (we use the midpoint of public ranges)
cost_df = pd.DataFrame({
    "Rail":      ["Check", "Wire", "Same-Day ACH", "ACH", "FedNow", "RTP"],
    "Low ($)":   [3.00, 15.00, 1.00, 0.26, 0.045, 0.045],
    "High ($)":  [20.00, 50.00, 5.00, 0.50, 0.05, 0.05],
})
cost_df["Midpoint ($)"] = (cost_df["Low ($)"] + cost_df["High ($)"]) / 2

# Instant-rail growth (value, year over year)
growth_df = pd.DataFrame({
    "Rail":   ["FedNow", "RTP", "Check (decline)"],
    "YoY Value Growth (%)": [460, 428, -5],
})

# Fraud incidence by rail (share of organizations affected, AFP 2025)
fraud_df = pd.DataFrame({
    "Rail":  ["Check", "ACH debit", "Wire"],
    "Orgs Affected (%)": [58, 30, 25],
})

# International substitution proof
intl_df = pd.DataFrame({
    "Market": ["Brazil — Pix (2021)", "Brazil — Pix (2024)", "UK — Faster Payments (2024)"],
    "Annual Volume (billions)": [9.4, 63.4, 5.09],
})

# ---- 4. DASHBOARD LAYOUT --------------------------------------------

# Header
st.markdown(f"<h1 style='margin-bottom:0'>💸 Money Movement Analytics</h1>", unsafe_allow_html=True)
st.markdown(
    f"<p style='color:{GREY}; font-size:1.05rem; margin-top:2px'>"
    "The financial case for moving Community Financial Institutions from legacy rails "
    "to instant payments (FedNow &amp; RTP). All figures from public sources — see footer.</p>",
    unsafe_allow_html=True,
)
st.divider()

# --- Top-line metrics ---
st.subheader("The headline numbers")
m1, m2, m3, m4 = st.columns(4)
m1.metric("FedNow value growth (2025)", "+460%", "year over year")
m2.metric("RTP value growth (2025)", "+428%", "year over year")
m3.metric("Cost to send instant", "$0.045", "vs. $3–$20 a check", delta_color="off")
m4.metric("Orgs hit by check fraud", "58%", "most-targeted rail", delta_color="inverse")
st.markdown(
    "<div class='takeaway'>💡 <b>The story in one line:</b> instant rails are exploding in use, "
    "cost a fraction of checks and wires, and sidestep the most fraud-prone instruments.</div>",
    unsafe_allow_html=True,
)

# --- Section 1: who carries the volume today ---
st.subheader("1. Where the money moves today")
c1, c2 = st.columns([3, 2])
with c1:
    fig = px.bar(
        volume_df.sort_values("Volume (billions)", ascending=True),
        x="Volume (billions)", y="Rail", color="Family", orientation="h",
        color_discrete_map={"Legacy": BLUE, "Instant": TEAL},
        text="Volume (billions)",
    )
    fig.update_traces(texttemplate="%{text:.2f}B", textposition="outside")
    fig.update_layout(height=360, margin=dict(l=10, r=40, t=10, b=10),
                      xaxis_title="Annual transactions (billions)", yaxis_title="",
                      legend_title="", plot_bgcolor="white")
    st.plotly_chart(fig, use_container_width=True)
with c2:
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown(
        "<div class='takeaway'><b>Read this:</b> Legacy rails (blue) still carry almost all volume — "
        "ACH alone is 35 billion payments a year. Instant rails (teal) are tiny <i>today</i>. "
        "That gap is the opportunity: there is enormous legacy volume left to migrate.</div>",
        unsafe_allow_html=True,
    )

# --- Section 2: the cost gap (the core argument) ---
st.subheader("2. The cost gap — why migration pays")
fig2 = go.Figure()
fig2.add_trace(go.Bar(
    x=cost_df["Rail"], y=cost_df["Midpoint ($)"],
    marker_color=[RAIL_COLORS.get(r, BLUE) for r in cost_df["Rail"]],
    text=[f"${v:,.2f}" for v in cost_df["Midpoint ($)"]],
    textposition="outside",
    error_y=dict(type="data", symmetric=False,
                 array=cost_df["High ($)"] - cost_df["Midpoint ($)"],
                 arrayminus=cost_df["Midpoint ($)"] - cost_df["Low ($)"]),
))
fig2.update_layout(
    height=400, margin=dict(l=10, r=10, t=10, b=10),
    yaxis_title="Fully-loaded cost per transaction ($, log scale)",
    yaxis_type="log", plot_bgcolor="white", xaxis_title="",
)
st.plotly_chart(fig2, use_container_width=True)
st.markdown(
    "<div class='takeaway'><b>This is the whole case.</b> A check costs $3–$20 to process and a wire $15–$50, "
    "while an instant payment costs about <b>4.5 cents</b>. (The scale is logarithmic — each gridline is 10× — "
    "because the gap is so large.) Note: standard ACH is already cheap, so moving ACH saves little. "
    "<b>The savings come from killing checks and wires.</b></div>",
    unsafe_allow_html=True,
)

# --- Section 3: momentum ---
st.subheader("3. The momentum is already here")
c3, c4 = st.columns(2)
with c3:
    fig3 = px.bar(growth_df, x="Rail", y="YoY Value Growth (%)",
                  color="YoY Value Growth (%)",
                  color_continuous_scale=["#E76F51", "#F4F7FC", TEAL],
                  text="YoY Value Growth (%)")
    fig3.update_traces(texttemplate="%{text}%", textposition="outside")
    fig3.update_layout(height=340, margin=dict(l=10, r=10, t=10, b=10),
                       coloraxis_showscale=False, plot_bgcolor="white",
                       xaxis_title="", yaxis_title="Value growth, 2025 vs 2024 (%)")
    st.plotly_chart(fig3, use_container_width=True)
with c4:
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown(
        "<div class='takeaway'><b>Read this:</b> in a single year, FedNow value grew 460% and RTP 428%, "
        "while checks keep shrinking ~5% a year. This is not a maybe — adoption is compounding now. "
        "A CFI that waits cedes the instant-payments relationship to a competitor.</div>",
        unsafe_allow_html=True,
    )

# --- Section 4: fraud ---
st.subheader("4. Legacy rails carry the most fraud")
c5, c6 = st.columns([2, 3])
with c5:
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown(
        "<div class='takeaway'><b>Read this:</b> checks are the most-targeted instrument — "
        "58% of organizations faced check fraud in 2025. Displacing checks doesn't just cut cost, "
        "it cuts exposure. (Instant payments are irrevocable, so they need strong pre-send "
        "verification — a controls shift, not a free lunch.)</div>",
        unsafe_allow_html=True,
    )
with c6:
    fig4 = px.bar(fraud_df.sort_values("Orgs Affected (%)"),
                  x="Orgs Affected (%)", y="Rail", orientation="h",
                  color="Orgs Affected (%)",
                  color_continuous_scale=["#F4F7FC", RED], text="Orgs Affected (%)")
    fig4.update_traces(texttemplate="%{text}%", textposition="outside")
    fig4.update_layout(height=300, margin=dict(l=10, r=30, t=10, b=10),
                       coloraxis_showscale=False, plot_bgcolor="white",
                       xaxis_title="% of organizations reporting fraud (2025)", yaxis_title="")
    st.plotly_chart(fig4, use_container_width=True)

# --- Section 5: international proof ---
st.subheader("5. It already happened abroad")
fig5 = px.bar(intl_df, x="Market", y="Annual Volume (billions)",
              color="Market",
              color_discrete_sequence=[BLUE, TEAL, NAVY], text="Annual Volume (billions)")
fig5.update_traces(texttemplate="%{text}B", textposition="outside")
fig5.update_layout(height=340, margin=dict(l=10, r=10, t=10, b=10),
                   showlegend=False, plot_bgcolor="white",
                   xaxis_title="", yaxis_title="Annual instant-payment volume (billions)")
st.plotly_chart(fig5, use_container_width=True)
st.markdown(
    "<div class='takeaway'><b>Read this:</b> Brazil's Pix went from 9.4B to 63.4B transactions in three years "
    "and pushed checks to near-zero. The UK's Faster Payments shows the same shift at a steadier pace. "
    "These bracket how fast U.S. migration could go — fast ceiling (Pix), gradual floor (UK).</div>",
    unsafe_allow_html=True,
)

# --- Section 6: the recommendation ---
st.subheader("6. So — what should a CFI use?")
r1, r2, r3 = st.columns(3)
with r1:
    st.markdown(
        f"<div class='rec-card'><h3 style='color:{TEAL}'>✅ Move to instant</h3>"
        "<b>Checks &amp; wires →</b> FedNow / RTP.<br><br>"
        "Biggest cost savings ($3–$50 → $0.045) and the biggest fraud reduction. "
        "This is where the ROI lives.</div>",
        unsafe_allow_html=True,
    )
with r2:
    st.markdown(
        f"<div class='rec-card'><h3 style='color:{BLUE}'>↔️ Keep for now</h3>"
        "<b>Standard ACH →</b> stays.<br><br>"
        "Already cheap ($0.26–$0.50) and efficient for batch/recurring payments. "
        "Migrating it saves little — low priority.</div>",
        unsafe_allow_html=True,
    )
with r3:
    st.markdown(
        f"<div class='rec-card'><h3 style='color:{AMBER}'>🎯 Prioritize by mix</h3>"
        "<b>Target high check/wire volume.</b><br><br>"
        "A CFI's ROI depends on its rail mix. The more checks and wires it sends, "
        "the larger the migration payoff.</div>",
        unsafe_allow_html=True,
    )

# --- Footer / sources ---
st.divider()
st.caption(
    "Sources: Nacha ACH Network Statistics (2025) · Federal Reserve FedNow Volume & Value · "
    "The Clearing House RTP statistics · Federal Reserve Payments Study · "
    "AFP Payments Fraud & Control Survey (2025) · Banco Central do Brasil / Pix · Pay.UK Annual Statistics 2024. "
    "Figures are public-source and most-recent-available as of June 2026. "
    "Cost figures use midpoints of published ranges; calibrate against Payfinia production data downstream."
)
