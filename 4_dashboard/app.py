# =====================================================================
# PAYFINIA — Money Movement Analytics · Data-Story Dashboard
# Run with:  streamlit run app.py
# Clean, corporate charts (consistent palette, muted gridlines, value
# labels, no Plotly toolbar). All figures public-source — see footer.
# =====================================================================

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

st.set_page_config(page_title="Payfinia | Money Movement Analytics", page_icon="💸", layout="wide")

# ---- brand palette ----
NAVY="#1F3864"; BLUE="#2E5496"; TEAL="#2EC4B6"; AMBER="#F4A259"; RED="#E76F51"
GREY="#5b6472"; INK="#1c2431"; GRID="#EEF2F7"; FONT="Arial"
RAIL_COLORS={"Check":RED,"Wire":AMBER,"Same-Day ACH":"#9AA7C7","ACH":BLUE,"FedNow":TEAL,"RTP":"#1B998B"}
CHART_CFG={"displayModeBar": False, "responsive": True}

st.markdown(f"""
<style>
 .main {{ background-color:#FFFFFF; }}
 h1,h2,h3 {{ color:{NAVY}; }}
 .stMetric {{ background:#F4F7FC; border-radius:10px; padding:14px; }}
 .takeaway {{ background:#F4F7FC; border-left:5px solid {BLUE}; padding:12px 16px;
   border-radius:6px; margin:6px 0 18px 0; font-size:0.95rem; color:{GREY}; }}
 .rec-card {{ background:#FFFFFF; border:1px solid #E0E6F0; border-radius:10px; padding:16px; height:100%; }}
</style>
""", unsafe_allow_html=True)

# ---- professional chart helpers ----
def style_fig(fig, height=320, xtitle="", ytitle="", hbar=False, legend=False):
    fig.update_layout(
        template="plotly_white", height=height, margin=dict(l=8, r=95, t=8, b=36),
        font=dict(family=FONT, size=13, color=INK),
        xaxis=dict(title=xtitle, showgrid=not hbar, gridcolor=GRID, zeroline=False,
                   tickfont=dict(color=GREY, size=11), title_font=dict(size=12, color=GREY)),
        yaxis=dict(title=ytitle, showgrid=hbar, gridcolor=GRID, zeroline=False,
                   tickfont=dict(color=INK, size=13), title_font=dict(size=12, color=GREY),
                   autorange="reversed" if hbar else None),
        showlegend=legend, legend=dict(orientation="h", y=1.12, x=0, font=dict(size=12, color=GREY)),
        plot_bgcolor="white", paper_bgcolor="white", bargap=0.34,
    )
    fig.update_traces(textfont=dict(family=FONT, size=13, color=NAVY), cliponaxis=False)
    return fig

# ---- DATA (Deliverable 1) ----
volume_df = pd.DataFrame({
    "Rail": ["ACH","Same-Day ACH","Check","Wire","FedNow","RTP"],
    "Family": ["Legacy","Legacy","Legacy","Legacy","Instant","Instant"],
    "Volume (billions)": [35.2,1.4,3.0,0.205,0.0084,0.44],
})
cost_df = pd.DataFrame({
    "Rail": ["Wire","Check","Same-Day ACH","Instant","ACH"],
    "Cost ($)": [18.57,2.98,1.34,0.77,0.40],
})
growth_df = pd.DataFrame({
    "Rail": ["FedNow","RTP","Check"],
    "Growth (%)": [460,428,-5],
})
fraud_df = pd.DataFrame({"Rail": ["Check","ACH debit","Wire"], "Orgs Affected (%)": [58,30,25]})
intl_df = pd.DataFrame({
    "Market": ["Brazil Pix (2021)","Brazil Pix (2024)","UK Faster Payments (2024)"],
    "Annual Volume (billions)": [9.4,63.4,5.09],
})

# ---- HEADER ----
st.markdown("<h1 style='margin-bottom:0'>💸 Money Movement Analytics</h1>", unsafe_allow_html=True)
st.markdown(f"<p style='color:{GREY}; font-size:1.05rem; margin-top:2px'>The financial case for moving community banks "
            "from legacy rails to instant payments (FedNow &amp; RTP). All figures from public sources — see footer.</p>",
            unsafe_allow_html=True)
st.divider()

st.subheader("The headline numbers")
m1,m2,m3,m4 = st.columns(4)
m1.metric("FedNow value growth (2025)", "+460%", "year over year")
m2.metric("RTP value growth (2025)", "+428%", "year over year")
m3.metric("Cost to send instant", "$0.045", "vs. $3–$18 a check/wire", delta_color="off")
m4.metric("Orgs hit by check fraud", "58%", "most-targeted rail", delta_color="inverse")
st.markdown("<div class='takeaway'>💡 <b>The story in one line:</b> instant rails are growing fast, cost a fraction of "
            "checks and wires, and sidestep the most fraud-prone instruments.</div>", unsafe_allow_html=True)

# ---- 1. VOLUME ----
st.subheader("1. Where the money moves today")
c1,c2 = st.columns([3,2])
with c1:
    d = volume_df.sort_values("Volume (billions)")
    fig = px.bar(d, x="Volume (billions)", y="Rail", color="Family", orientation="h",
                 color_discrete_map={"Legacy": BLUE, "Instant": TEAL}, text="Volume (billions)")
    fig.update_traces(texttemplate="%{text:.2f}B", textposition="outside")
    style_fig(fig, height=360, xtitle="Annual transactions (billions)", hbar=True, legend=True)
    st.plotly_chart(fig, use_container_width=True, config=CHART_CFG)
with c2:
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("<div class='takeaway'><b>Read this:</b> legacy rails (blue) still carry almost all volume — "
        "ACH alone is 35 billion payments a year. Instant rails (teal) are small <i>today</i>. That gap is the "
        "opportunity: enormous legacy volume is still available to migrate.</div>", unsafe_allow_html=True)

# ---- 2. COST GAP ----
st.subheader("2. The cost gap — why migration pays")
fig2 = go.Figure(go.Bar(
    x=cost_df["Cost ($)"], y=cost_df["Rail"], orientation="h",
    marker_color=[RAIL_COLORS.get(r, BLUE) if r != "Instant" else TEAL for r in cost_df["Rail"]],
    text=[f"${v:,.2f}" for v in cost_df["Cost ($)"]], textposition="outside",
))
style_fig(fig2, height=340, xtitle="Fully-loaded cost per transaction ($, log scale)", hbar=True)
fig2.update_layout(xaxis_type="log")
st.plotly_chart(fig2, use_container_width=True, config=CHART_CFG)
st.markdown("<div class='takeaway'><b>This is the whole case.</b> A wire costs ~$18.57 and a check ~$2.98 to process, "
    "while an instant payment costs ~$0.77 all-in. (Log scale — each gridline is 10× — because the gap is so large.) "
    "Standard ACH is already cheap, so moving it saves little. <b>The savings come from checks and wires.</b></div>",
    unsafe_allow_html=True)

# ---- 3. MOMENTUM ----
st.subheader("3. The momentum is already here")
c3,c4 = st.columns(2)
with c3:
    fig3 = go.Figure(go.Bar(
        x=growth_df["Rail"], y=growth_df["Growth (%)"],
        marker_color=[TEAL, "#1B998B", RED],
        text=[f"{v:+d}%" for v in growth_df["Growth (%)"]], textposition="outside",
    ))
    style_fig(fig3, height=340, ytitle="Value growth, 2025 vs 2024 (%)")
    st.plotly_chart(fig3, use_container_width=True, config=CHART_CFG)
with c4:
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("<div class='takeaway'><b>Read this:</b> in a single year, FedNow value grew 460% and RTP 428%, while "
        "checks keep shrinking ~5% a year. Adoption is compounding now — a bank that waits cedes the instant-payments "
        "relationship to a competitor.</div>", unsafe_allow_html=True)

# ---- 4. FRAUD ----
st.subheader("4. Legacy rails carry the most fraud")
c5,c6 = st.columns([2,3])
with c5:
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("<div class='takeaway'><b>Read this:</b> checks are the most-targeted instrument — 58% of organizations "
        "faced check fraud in 2025. Displacing checks cuts cost <i>and</i> exposure. (Instant payments are irrevocable, "
        "so they need strong pre-send verification — a controls shift, not a free lunch.)</div>", unsafe_allow_html=True)
with c6:
    d = fraud_df.sort_values("Orgs Affected (%)")
    fig4 = go.Figure(go.Bar(
        x=d["Orgs Affected (%)"], y=d["Rail"], orientation="h",
        marker_color=[RED, AMBER, "#9AA7C7"],
        text=[f"{v}%" for v in d["Orgs Affected (%)"]], textposition="outside",
    ))
    style_fig(fig4, height=300, xtitle="% of organizations reporting fraud (2025)", hbar=True)
    st.plotly_chart(fig4, use_container_width=True, config=CHART_CFG)

# ---- 5. INTERNATIONAL ----
st.subheader("5. It already happened abroad")
fig5 = go.Figure(go.Bar(
    x=intl_df["Market"], y=intl_df["Annual Volume (billions)"],
    marker_color=[BLUE, TEAL, NAVY],
    text=[f"{v}B" for v in intl_df["Annual Volume (billions)"]], textposition="outside",
))
style_fig(fig5, height=340, ytitle="Annual instant-payment volume (billions)")
st.plotly_chart(fig5, use_container_width=True, config=CHART_CFG)
st.markdown("<div class='takeaway'><b>Read this:</b> Brazil's Pix went from 9.4B to 63.4B transactions in three years and "
    "pushed checks to near-zero. The UK's Faster Payments shows the same shift at a steadier pace. These bracket how fast "
    "U.S. migration could go — fast ceiling (Pix), gradual floor (UK).</div>", unsafe_allow_html=True)

# ---- 6. RECOMMENDATION ----
st.subheader("6. So — what should a bank do?")
r1,r2,r3 = st.columns(3)
with r1:
    st.markdown(f"<div class='rec-card'><h3 style='color:{TEAL}'>✅ Move to instant</h3>"
        "<b>Checks &amp; wires →</b> FedNow / RTP.<br><br>Biggest cost savings and fraud reduction. "
        "This is where the ROI lives.</div>", unsafe_allow_html=True)
with r2:
    st.markdown(f"<div class='rec-card'><h3 style='color:{BLUE}'>↔️ Keep for now</h3>"
        "<b>Standard ACH →</b> stays.<br><br>Already cheap and efficient for batch/recurring payments. "
        "Migrating it saves little — low priority.</div>", unsafe_allow_html=True)
with r3:
    st.markdown(f"<div class='rec-card'><h3 style='color:{AMBER}'>🎯 Prioritize by mix</h3>"
        "<b>Target high check/wire volume.</b><br><br>A bank's ROI depends on its rail mix. More checks and wires "
        "= larger migration payoff.</div>", unsafe_allow_html=True)

st.divider()
st.caption("Sources: Nacha ACH Network Statistics (2025) · Federal Reserve FedNow Volume & Value · The Clearing House RTP "
    "statistics · Federal Reserve Payments Study · AFP Payments Fraud & Control Survey (2025) · Banco Central do Brasil / Pix "
    "· Pay.UK Annual Statistics 2024. Figures public-source, most-recent-available as of the 2025–2026 research pass. "
    "Cost figures from the Deliverable 2 model; calibrate against Payfinia production data downstream.")
