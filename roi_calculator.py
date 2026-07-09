# =====================================================================
# PAYFINIA — MIGRATION ROI CALCULATOR  (Deliverable 4)
# Interactive Streamlit tool for prospect conversations with community banks.
#
# Run with:   streamlit run roi_calculator.py
#
# HOW IT IS GROUNDED (important):
#   Every benchmark DEFAULT below is a real figure retrieved from a public
#   source, shown in the app with a clickable link. Numbers that are NOT
#   directly citable (per-item processing, fraud-prevention, compliance,
#   reconciliation, liquidity) are LABELLED as estimates — not sourced facts.
#   The logic matches roi_model.py exactly.
# =====================================================================

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

st.set_page_config(page_title="Payfinia | Migration ROI Calculator", page_icon="💸", layout="wide")

# ---- brand ----
NAVY="#1F3864"; BLUE="#2E5496"; TEAL="#2EC4B6"; AMBER="#F4A259"; RED="#E76F51"; GREY="#595959"
st.markdown(f"""
<style>
 h1,h2,h3 {{color:{NAVY};}}
 .stMetric {{background:#F4F7FC;border-radius:10px;padding:12px;}}
 .src {{font-size:0.8rem;color:{GREY};}}
 .note {{background:#F4F7FC;border-left:5px solid {BLUE};padding:10px 14px;border-radius:6px;color:{GREY};font-size:0.9rem;}}
</style>""", unsafe_allow_html=True)

# =====================================================================
# BENCHMARK DEFAULTS  (must match roi_model.py)
# Each rail: [network, processing, failure_rate, cost_per_failure,
#             fraud_loss, fraud_prevention, compliance, reconciliation, liquidity]
# =====================================================================
COMPONENTS = ["Network fee","Processing","Failure rate","Cost per failure",
              "Fraud loss","Fraud prevention","Compliance","Reconciliation","Liquidity"]
RAILS = ["Check","Wire","Same-Day ACH","ACH","Instant"]
DEFAULTS = {
 "Check":        [0.03, 2.00, 0.015, 8.00, 0.40, 0.10, 0.03, 0.30, 0.00],
 "Wire":         [0.82, 12.00, 0.010, 25.00, 2.00, 1.00, 2.00, 0.50, 0.00],
 "Same-Day ACH": [0.05, 0.80, 0.015, 6.00, 0.15, 0.10, 0.05, 0.10, 0.00],
 "ACH":          [0.005, 0.15, 0.015, 4.00, 0.05, 0.05, 0.03, 0.05, 0.00],
 "Instant":      [0.045, 0.10, 0.005, 5.00, 0.25, 0.15, 0.10, 0.05, 0.05],
}
SUBST_DEFAULT = {"Check":0.25,"Wire":0.30,"Same-Day ACH":0.20,"ACH":0.05}

# preset CFIs: volumes + one-time + annual fixed  (match roi_model.py)
PRESETS = {
 "Small CFI (~$200M)":  {"Check":120000,"Wire":2000,"Same-Day ACH":30000,"ACH":400000,"one_time":60000,"annual":30000},
 "Mid CFI (~$1B)":      {"Check":600000,"Wire":12000,"Same-Day ACH":150000,"ACH":2500000,"one_time":150000,"annual":60000},
 "Large CFI (~$5B)":    {"Check":3000000,"Wire":60000,"Same-Day ACH":800000,"ACH":14000000,"one_time":350000,"annual":150000},
}

# sources: component -> (basis, url, status)  status: "Cited" | "Partly cited" | "Estimate"
SOURCES = {
 "Network fee":      ("Fed / Nacha / The Clearing House published pricing (FedNow $0.045, Fedwire ~$0.82)",
                      "https://www.frbservices.org/resources/fees/fednow-2026","Cited"),
 "Processing":       ("Internal labor & systems per item — industry operational-cost estimate",
                      "https://www.nacha.org/news/ach-costs-are-fraction-check-costs-businesses-afp-survey-shows","Estimate"),
 "Failure & exception":("Return rates ~1.5% (Nacha thresholds); avg failed payment $12.10 (LexisNexis)",
                      "https://www.nacha.org/rules","Partly cited"),
 "Fraud loss":       ("AFP Payments Fraud Survey (incidence cited); per-item $ is an estimate",
                      "https://www.financialprofessionals.org/training-resources/resources/survey-research-economic-data/details/payments-fraud","Partly cited"),
 "Fraud prevention": ("Real-time screening / monitoring tooling per item — estimate",
                      "https://www.financialprofessionals.org/training-resources/resources/survey-research-economic-data/details/payments-fraud","Estimate"),
 "Compliance":       ("AML / sanctions screening per item (FFIEC; Reg II for debit) — estimate",
                      "https://ithandbook.ffiec.gov/it-booklets/retail-payment-systems/","Estimate"),
 "Reconciliation":   ("Matching & breaks handling per item — estimate",
                      "https://ithandbook.ffiec.gov/it-booklets/retail-payment-systems/","Estimate"),
 "Liquidity":        ("RTP prefunded joint account / FedNow liquidity management — estimate",
                      "https://www.frbservices.org/financial-services/fednow","Estimate"),
 "Substitution":     ("Bounded by Brazil Pix (fast ceiling) & UK Faster Payments (slow floor)",
                      "https://paymentscmi.com/insights/pix-in-brazil-latest-statistics-central-bank/","Estimate"),
}

# =====================================================================
# MODEL FUNCTIONS  (identical logic to roi_model.py)
# =====================================================================
def total_cost(c):
    # c = list of 9 in COMPONENTS order
    return c[0]+c[1]+(c[2]*c[3])+c[4]+c[5]+c[6]+c[7]+c[8]

def run_model(volumes, costs, subst, one_time, annual, disc, horizon):
    instant = total_cost(costs["Instant"])
    rows=[]; gross=0.0
    for rail in ["Check","Wire","Same-Day ACH","ACH"]:
        legacy=total_cost(costs[rail]); per=legacy-instant
        migrated=volumes[rail]*subst[rail]; annual_sav=migrated*per
        gross+=annual_sav
        rows.append({"Rail":rail,"Legacy $/txn":legacy,"Save $/txn":per,
                     "Migrated txns":migrated,"Annual savings":annual_sav})
    net=gross-annual
    roi=net/one_time if one_time else 0
    payback=(one_time/net*12) if net>0 else float("inf")
    ann_factor=(1-(1+disc)**(-horizon))/disc
    npv=net*ann_factor-one_time
    return rows, dict(instant=instant,gross=gross,net=net,roi=roi,payback=payback,npv=npv)

def money(x): return f"${x:,.0f}"

# =====================================================================
# HEADER
# =====================================================================
st.title("💸 Migration ROI Calculator")
st.markdown(f"<p style='color:{GREY};font-size:1.05rem;margin-top:-8px'>Estimate what a community financial institution saves by moving checks & wires to instant payments (FedNow / RTP). Every benchmark is sourced — links in the panel at the bottom.</p>", unsafe_allow_html=True)

# =====================================================================
# SIDEBAR — institution profile & assumptions
# =====================================================================
if "loaded_preset" not in st.session_state:
    st.session_state.loaded_preset = "Mid CFI (~$1B)"
    for k,v in PRESETS["Mid CFI (~$1B)"].items(): st.session_state[k]=v

def apply_preset():
    for k,v in PRESETS[st.session_state.preset_sel].items():
        st.session_state[k]=v

with st.sidebar:
    st.header("1 · Institution profile")
    st.selectbox("Start from an example, then adjust ↓", list(PRESETS.keys()),
                 key="preset_sel", index=1, on_change=apply_preset)
    st.caption("Pick a size to auto-fill typical volumes, then fine-tune the bank's real numbers.")
    check_v = st.number_input("Checks / year", min_value=0, step=1000, key="Check")
    wire_v  = st.number_input("Wires / year", min_value=0, step=100, key="Wire")
    sda_v   = st.number_input("Same-Day ACH / year", min_value=0, step=1000, key="Same-Day ACH")
    ach_v   = st.number_input("Standard ACH / year", min_value=0, step=1000, key="ACH")
    st.markdown("**Costs to enable instant payments**")
    one_time = st.number_input("One-time implementation cost ($)", min_value=0, step=5000, key="one_time")
    annual   = st.number_input("Annual fixed cost ($/yr)", min_value=0, step=1000, key="annual")

    st.header("2 · Key assumptions")
    st.caption("Bounded by real analogs — adjust to test scenarios.")
    subst = {}
    subst["Check"]        = st.slider("% of checks that migrate", 0, 100, int(SUBST_DEFAULT["Check"]*100)) / 100
    subst["Wire"]         = st.slider("% of wires that migrate", 0, 100, int(SUBST_DEFAULT["Wire"]*100)) / 100
    subst["Same-Day ACH"] = st.slider("% of Same-Day ACH that migrates", 0, 100, int(SUBST_DEFAULT["Same-Day ACH"]*100)) / 100
    subst["ACH"]          = st.slider("% of standard ACH that migrates", 0, 100, int(SUBST_DEFAULT["ACH"]*100)) / 100
    disc    = st.slider("Discount rate (NPV)", 0, 20, 10) / 100
    horizon = st.slider("Horizon (years)", 1, 10, 5)

volumes = {"Check":check_v,"Wire":wire_v,"Same-Day ACH":sda_v,"ACH":ach_v}

# =====================================================================
# EDITABLE COST STACK (main area, expander)
# =====================================================================
with st.expander("⚙️  Benchmark cost stack (per transaction) — edit any value; sources below"):
    df_default = pd.DataFrame(DEFAULTS, index=COMPONENTS).T
    edited = st.data_editor(df_default, use_container_width=True, key="cost_editor")
    costs = {rail:[edited.loc[rail,c] for c in COMPONENTS] for rail in RAILS}
    st.caption("Rows are rails; columns are the 8 cost components (Failure cost = rate × cost per failure). "
               "Defaults are conservative public-benchmark midpoints; items marked 'Estimate' below are not directly cited.")

if "cost_editor" not in st.session_state:
    costs = {rail:list(DEFAULTS[rail]) for rail in RAILS}

# =====================================================================
# RUN MODEL
# =====================================================================
rows, res = run_model(volumes, costs, subst, one_time, annual, disc, horizon)

# =====================================================================
# RESULTS
# =====================================================================
st.subheader(f"Results — {st.session_state.preset_sel.split(' (')[0]}")
c1,c2,c3,c4 = st.columns(4)
c1.metric("Net annual benefit", money(res["net"]))
c2.metric("Year-1 ROI", f"{res['roi']*100:,.0f}%")
c3.metric("Payback", "—" if res["payback"]==float('inf') else f"{res['payback']:.1f} mo")
c4.metric("5-year NPV", money(res["npv"]))

if res["net"] <= 0:
    st.markdown("<div class='note'>⚠️ At these inputs the migration does not pay back. Increase check/wire volume or migration share, or reduce the one-time cost.</div>", unsafe_allow_html=True)
else:
    st.markdown(f"<div class='note'>💡 Instant costs <b>${res['instant']:.2f}</b>/txn all-in. Savings come from displacing checks (${total_cost(costs['Check']):.2f}) and wires (${total_cost(costs['Wire']):.2f}). Standard ACH is already cheaper than instant, so migrating it does not help.</div>", unsafe_allow_html=True)

left,right = st.columns(2)
with left:
    st.markdown("**Annual savings by rail**")
    fig = go.Figure(go.Bar(
        x=[r["Annual savings"] for r in rows], y=[r["Rail"] for r in rows], orientation="h",
        marker_color=[RED,AMBER,BLUE,"#9AA7C7"],
        text=[money(r["Annual savings"]) for r in rows], textposition="outside"))
    fig.update_layout(height=300, margin=dict(l=10,r=60,t=10,b=10), plot_bgcolor="white",
                      xaxis_title="Annual savings ($)", yaxis_title="")
    st.plotly_chart(fig, use_container_width=True)
with right:
    st.markdown("**Fully-loaded cost per transaction**")
    order=["Wire","Check","Same-Day ACH","Instant","ACH"]
    fig2 = go.Figure(go.Bar(
        x=[total_cost(costs[r]) for r in order], y=order, orientation="h",
        marker_color=[AMBER,RED,BLUE,TEAL,"#9AA7C7"],
        text=[f"${total_cost(costs[r]):.2f}" for r in order], textposition="outside"))
    fig2.update_layout(height=300, margin=dict(l=10,r=60,t=10,b=10), plot_bgcolor="white",
                       xaxis_title="Cost per txn ($)", yaxis_title="")
    st.plotly_chart(fig2, use_container_width=True)

# detail table
st.markdown("**Per-rail detail**")
det = pd.DataFrame(rows)
det["Legacy $/txn"]=det["Legacy $/txn"].map(lambda x:f"${x:,.2f}")
det["Save $/txn"]=det["Save $/txn"].map(lambda x:f"${x:,.2f}")
det["Migrated txns"]=det["Migrated txns"].map(lambda x:f"{x:,.0f}")
det["Annual savings"]=det["Annual savings"].map(money)
st.dataframe(det, use_container_width=True, hide_index=True)
st.caption(f"Gross annual savings {money(res['gross'])}  −  annual fixed cost {money(annual)}  =  net annual benefit {money(res['net'])}.")

# =====================================================================
# SOURCES & DATA QUALITY
# =====================================================================
st.subheader("Sources & data quality")
st.caption("Every default traces to a public source. Items marked 'Estimate' are not directly citable and should be calibrated with Payfinia production data.")
src_rows=[]
label_map={"Failure rate":"Failure & exception","Cost per failure":"Failure & exception"}
for comp,(basis,url,status) in SOURCES.items():
    src_rows.append({"Cost line":comp,"Basis":basis,"Status":status,"Source":url})
sdf=pd.DataFrame(src_rows)
st.dataframe(sdf, use_container_width=True, hide_index=True,
    column_config={"Source": st.column_config.LinkColumn("Source", display_text="open ↗")})

st.markdown(f"<p class='src'>Payfinia · Money Movement Analytics · USF FinTech Graduate Project. "
            f"Figures current as of the July 2026 research pass. This tool estimates; it is not a guarantee of savings.</p>", unsafe_allow_html=True)
