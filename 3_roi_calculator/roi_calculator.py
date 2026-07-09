# =====================================================================
# PAYFINIA — MIGRATION ROI CALCULATOR  (Deliverable 4)
# Interactive Streamlit tool for prospect conversations with community banks.
#
# Run with:   streamlit run roi_calculator.py
#
# GROUNDING PRINCIPLE (per project integrity rules):
#   EVERY benchmark number shown to the client carries a visible source —
#   publisher, as-of date, a clickable link, and a status tag:
#       Cited        = taken directly from the named public source
#       Partly cited = the rate/incidence is cited; the per-item $ is estimated
#       Estimate     = an industry-midpoint estimate, NOT a cited figure
#                      (to be calibrated with Payfinia production data)
#   Logic matches roi_model.py exactly.
# =====================================================================

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

st.set_page_config(page_title="Payfinia | Migration ROI Calculator", page_icon="💸", layout="wide")

NAVY="#1F3864"; BLUE="#2E5496"; TEAL="#2EC4B6"; AMBER="#F4A259"; RED="#E76F51"; GREY="#595959"
st.markdown(f"""
<style>
 h1,h2,h3 {{color:{NAVY};}}
 .stMetric {{background:#F4F7FC;border-radius:10px;padding:12px;}}
 .note {{background:#F4F7FC;border-left:5px solid {BLUE};padding:10px 14px;border-radius:6px;color:{GREY};font-size:0.9rem;}}
 .tag-cited {{color:#1B7F4B;font-weight:700;}}
 .tag-partly {{color:#B8860B;font-weight:700;}}
 .tag-est {{color:#C0562B;font-weight:700;}}
</style>""", unsafe_allow_html=True)

# =====================================================================
# BENCHMARK DEFAULTS  (must match roi_model.py)
# order: [network, processing, failure_rate, cost_per_failure,
#         fraud_loss, fraud_prevention, compliance, reconciliation, liquidity]
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
PRESETS = {
 "Small CFI (~$200M)":  {"Check":120000,"Wire":2000,"Same-Day ACH":30000,"ACH":400000,"one_time":60000,"annual":30000},
 "Mid CFI (~$1B)":      {"Check":600000,"Wire":12000,"Same-Day ACH":150000,"ACH":2500000,"one_time":150000,"annual":60000},
 "Large CFI (~$5B)":    {"Check":3000000,"Wire":60000,"Same-Day ACH":800000,"ACH":14000000,"one_time":350000,"annual":150000},
}

# =====================================================================
# SOURCE for every cost line: (publisher, what it supports, url, as_of, status)
# =====================================================================
SRC = {
 "Network fee": ("Federal Reserve & The Clearing House fee schedules",
   "FedNow & RTP $0.045/txn; Fedwire $0.97 gross (~$0.78 small-volume discounted)",
   "https://www.frbservices.org/resources/fees/fednow-2026", "2025–2026", "Cited"),
 "Processing": ("Nacha / AFP operational-cost benchmarks",
   "Internal labor & systems to move one item",
   "https://www.nacha.org/news/ach-costs-are-fraction-check-costs-businesses-afp-survey-shows", "2024", "Estimate"),
 "Failure & exception": ("Nacha Operating Rules; LexisNexis",
   "Return rate ~1.5% (Nacha thresholds); avg failed payment $12.10 (LexisNexis)",
   "https://www.nacha.org/rules", "2024–2025", "Partly cited"),
 "Fraud loss": ("AFP Payments Fraud & Control Survey",
   "Incidence cited (check 58%, ACH 30%, wire 25%); per-item $ estimated",
   "https://www.financialprofessionals.org/training-resources/resources/survey-research-economic-data/details/payments-fraud", "2025", "Partly cited"),
 "Fraud prevention": ("AFP survey / fraud-tooling vendors",
   "Real-time screening & monitoring cost per item",
   "https://www.financialprofessionals.org/training-resources/resources/survey-research-economic-data/details/payments-fraud", "2025", "Estimate"),
 "Compliance": ("FFIEC BSA/AML; Fed Regulation II",
   "AML/OFAC screening per item; debit interchange cap $0.21 + 5bps + $0.01",
   "https://www.federalreserve.gov/paymentsystems/regii-about.htm", "current (12 CFR 235)", "Partly cited"),
 "Reconciliation": ("FFIEC / exception-management research",
   "Matching & breaks handling per item",
   "https://ithandbook.ffiec.gov/it-booklets/retail-payment-systems/", "2024", "Estimate"),
 "Liquidity": ("Federal Reserve FedNow / TCH RTP",
   "Prefunding / liquidity carrying cost (instant rails settle 24/7)",
   "https://www.frbservices.org/financial-services/fednow", "2025", "Estimate"),
}
SUBST_SRC = ("Banco Central do Brasil (Pix) & Pay.UK (Faster Payments)",
   "Migration share bounded by Pix (fast ceiling) and UK FPS (slow floor)",
   "https://paymentscmi.com/insights/pix-in-brazil-latest-statistics-central-bank/", "2024", "Estimate")
VOL_SRC = ("Federal Reserve Payments Study; Nacha; rail-operator statistics",
   "Illustrative annual volumes scaled by asset size — replace with the bank's real numbers",
   "https://www.federalreserve.gov/paymentsystems/fr-payments-study.htm", "2024–2025", "Estimate")

# map the 9 raw components to their source key
COMP_TO_SRC = {"Network fee":"Network fee","Processing":"Processing",
 "Failure rate":"Failure & exception","Cost per failure":"Failure & exception",
 "Fraud loss":"Fraud loss","Fraud prevention":"Fraud prevention","Compliance":"Compliance",
 "Reconciliation":"Reconciliation","Liquidity":"Liquidity"}

def tag(status):
    cls={"Cited":"tag-cited","Partly cited":"tag-partly","Estimate":"tag-est"}[status]
    return f"<span class='{cls}'>{status}</span>"

# =====================================================================
# MODEL (identical logic to roi_model.py)
# =====================================================================
def total_cost(c):
    return c[0]+c[1]+(c[2]*c[3])+c[4]+c[5]+c[6]+c[7]+c[8]

def run_model(volumes, costs, subst, one_time, annual, disc, horizon):
    instant = total_cost(costs["Instant"]); rows=[]; gross=0.0
    for rail in ["Check","Wire","Same-Day ACH","ACH"]:
        legacy=total_cost(costs[rail]); per=legacy-instant
        migrated=volumes[rail]*subst[rail]; annual_sav=migrated*per; gross+=annual_sav
        rows.append({"Rail":rail,"Legacy $/txn":legacy,"Save $/txn":per,
                     "Migrated txns":migrated,"Annual savings":annual_sav})
    net=gross-annual
    roi=net/one_time if one_time else 0
    payback=(one_time/net*12) if net>0 else float("inf")
    af=(1-(1+disc)**(-horizon))/disc
    npv=net*af-one_time
    return rows, dict(instant=instant,gross=gross,net=net,roi=roi,payback=payback,npv=npv)

def money(x): return f"${x:,.0f}"

# =====================================================================
# HEADER
# =====================================================================
st.title("💸 Migration ROI Calculator")
st.markdown(f"<p style='color:{GREY};font-size:1.05rem;margin-top:-8px'>Estimate what a community financial institution saves by moving checks & wires to instant payments (FedNow / RTP). "
            f"<b>Every number below has a source you can open live.</b></p>", unsafe_allow_html=True)

# =====================================================================
# SIDEBAR
# =====================================================================
if "loaded_preset" not in st.session_state:
    st.session_state.loaded_preset = "Mid CFI (~$1B)"
    for k,v in PRESETS["Mid CFI (~$1B)"].items(): st.session_state[k]=v
def apply_preset():
    for k,v in PRESETS[st.session_state.preset_sel].items(): st.session_state[k]=v

with st.sidebar:
    st.header("1 · Institution profile")
    st.selectbox("Start from an example, then adjust ↓", list(PRESETS.keys()),
                 key="preset_sel", index=1, on_change=apply_preset)
    st.number_input("Checks / year", min_value=0, step=1000, key="Check")
    st.number_input("Wires / year", min_value=0, step=100, key="Wire")
    st.number_input("Same-Day ACH / year", min_value=0, step=1000, key="Same-Day ACH")
    st.number_input("Standard ACH / year", min_value=0, step=1000, key="ACH")
    st.caption(f"Volumes: {VOL_SRC[4]} · [{VOL_SRC[0]}]({VOL_SRC[2]}) ({VOL_SRC[3]})")
    st.markdown("**Costs to enable instant payments**")
    st.number_input("One-time implementation ($)", min_value=0, step=5000, key="one_time")
    st.number_input("Annual fixed cost ($/yr)", min_value=0, step=1000, key="annual")

    st.header("2 · Migration assumptions")
    subst={}
    subst["Check"]=st.slider("% of checks that migrate",0,100,int(SUBST_DEFAULT["Check"]*100))/100
    subst["Wire"]=st.slider("% of wires that migrate",0,100,int(SUBST_DEFAULT["Wire"]*100))/100
    subst["Same-Day ACH"]=st.slider("% of Same-Day ACH that migrates",0,100,int(SUBST_DEFAULT["Same-Day ACH"]*100))/100
    subst["ACH"]=st.slider("% of standard ACH that migrates",0,100,int(SUBST_DEFAULT["ACH"]*100))/100
    st.caption(f"Source: [{SUBST_SRC[0]}]({SUBST_SRC[2]}) ({SUBST_SRC[3]}) — {SUBST_SRC[4]}")
    disc=st.slider("Discount rate (NPV)",0,20,10)/100
    horizon=st.slider("Horizon (years)",1,10,5)

volumes={"Check":st.session_state["Check"],"Wire":st.session_state["Wire"],
         "Same-Day ACH":st.session_state["Same-Day ACH"],"ACH":st.session_state["ACH"]}
one_time=st.session_state["one_time"]; annual=st.session_state["annual"]

# =====================================================================
# EDITABLE COST STACK  (always visible)
# =====================================================================
st.subheader("Benchmark cost stack — edit any number, every one is sourced")
colE,colS = st.columns([1.05,1])
with colE:
    st.markdown("**Cost per transaction by rail** (editable)")
    df_default = pd.DataFrame(DEFAULTS, index=COMPONENTS).T
    edited = st.data_editor(df_default, use_container_width=True, key="cost_editor")
    costs = {rail:[float(edited.loc[rail,c]) for c in COMPONENTS] for rail in RAILS}
    st.caption("Rows = rails · columns = 8 cost components (Failure cost = rate × cost per failure).")
with colS:
    st.markdown("**📎 Source supporting each number**")
    src_rows=[{"Cost line":k,"Publisher":v[0],"As of":v[3],"Status":v[4],"Source":v[2]}
              for k,v in SRC.items()]
    st.dataframe(pd.DataFrame(src_rows), use_container_width=True, hide_index=True, height=320,
        column_config={"Source":st.column_config.LinkColumn("Verify", display_text="open ↗")})
    st.markdown(f"<span class='tag-cited'>Cited</span> = direct from source · "
                f"<span class='tag-partly'>Partly cited</span> = rate cited, $ estimated · "
                f"<span class='tag-est'>Estimate</span> = calibrate with Payfinia data", unsafe_allow_html=True)

# =====================================================================
# RUN MODEL
# =====================================================================
rows, res = run_model(volumes, costs, subst, one_time, annual, disc, horizon)

# =====================================================================
# RESULTS
# =====================================================================
st.subheader(f"Results — {st.session_state.preset_sel.split(' (')[0]}")
c1,c2,c3,c4=st.columns(4)
c1.metric("Net annual benefit", money(res["net"]))
c2.metric("Year-1 ROI", f"{res['roi']*100:,.0f}%")
c3.metric("Payback", "—" if res["payback"]==float('inf') else f"{res['payback']:.1f} mo")
c4.metric("5-year NPV", money(res["npv"]))
if res["net"]<=0:
    st.markdown("<div class='note'>⚠️ At these inputs migration does not pay back. Increase check/wire volume or migration share, or lower the one-time cost.</div>", unsafe_allow_html=True)
else:
    st.markdown(f"<div class='note'>💡 Instant costs <b>${res['instant']:.2f}</b>/txn all-in. Savings come from displacing checks (${total_cost(costs['Check']):.2f}) and wires (${total_cost(costs['Wire']):.2f}). Standard ACH is already cheaper than instant, so migrating it does not help.</div>", unsafe_allow_html=True)

left,right=st.columns(2)
with left:
    st.markdown("**Annual savings by rail**")
    fig=go.Figure(go.Bar(x=[r["Annual savings"] for r in rows],y=[r["Rail"] for r in rows],
        orientation="h",marker_color=[RED,AMBER,BLUE,"#9AA7C7"],
        text=[money(r["Annual savings"]) for r in rows],textposition="outside"))
    fig.update_layout(height=300,margin=dict(l=10,r=70,t=10,b=10),plot_bgcolor="white",xaxis_title="$/yr",yaxis_title="")
    st.plotly_chart(fig,use_container_width=True)
with right:
    st.markdown("**Fully-loaded cost per transaction**")
    order=["Wire","Check","Same-Day ACH","Instant","ACH"]
    fig2=go.Figure(go.Bar(x=[total_cost(costs[r]) for r in order],y=order,orientation="h",
        marker_color=[AMBER,RED,BLUE,TEAL,"#9AA7C7"],
        text=[f"${total_cost(costs[r]):.2f}" for r in order],textposition="outside"))
    fig2.update_layout(height=300,margin=dict(l=10,r=60,t=10,b=10),plot_bgcolor="white",xaxis_title="$/txn",yaxis_title="")
    st.plotly_chart(fig2,use_container_width=True)

# =====================================================================
# PER-RAIL BREAKDOWN WITH SOURCE FOR EACH LINE
# =====================================================================
st.subheader("Per-rail cost breakdown — with a source on every line")
st.caption("Open a rail to see each cost component, its value, and the source backing it.")
for rail in RAILS:
    c=costs[rail]; tot=total_cost(c)
    with st.expander(f"🔎 {rail} — ${tot:,.2f} per transaction"):
        disp=[]
        pairs=[("Network fee",c[0]),("Processing",c[1]),
               ("Failure & exception",c[2]*c[3]),("Fraud loss",c[4]),
               ("Fraud prevention",c[5]),("Compliance",c[6]),
               ("Reconciliation",c[7]),("Liquidity",c[8])]
        for name,val in pairs:
            s=SRC[name]
            disp.append({"Component":name,"$ / txn":f"${val:,.3f}","Publisher":s[0],
                         "As of":s[3],"Status":s[4],"Source":s[2]})
        st.dataframe(pd.DataFrame(disp),use_container_width=True,hide_index=True,
            column_config={"Source":st.column_config.LinkColumn("Verify",display_text="open ↗")})

# =====================================================================
# RESULT DETAIL
# =====================================================================
st.markdown("**Per-rail savings detail**")
det=pd.DataFrame(rows)
det["Legacy $/txn"]=det["Legacy $/txn"].map(lambda x:f"${x:,.2f}")
det["Save $/txn"]=det["Save $/txn"].map(lambda x:f"${x:,.2f}")
det["Migrated txns"]=det["Migrated txns"].map(lambda x:f"{x:,.0f}")
det["Annual savings"]=det["Annual savings"].map(money)
st.dataframe(det,use_container_width=True,hide_index=True)
st.caption(f"Gross savings {money(res['gross'])} − annual fixed {money(annual)} = net benefit {money(res['net'])}. "
           "This is an analytical estimate, not a guarantee of savings.")
