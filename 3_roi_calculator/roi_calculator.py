# =====================================================================
# PAYFINIA — MIGRATION ROI CALCULATOR  (Deliverable 4)
# All-in-one, sourced, client-friendly tool for community-bank conversations.
#
# Run with:   streamlit run roi_calculator.py
#
# GROUNDING PRINCIPLE (project integrity rules):
#   • Every statistic shown is a REAL figure with a named source + link + date.
#   • FedNow and RTP are shown as SEPARATE rails (not lumped as "instant").
#   • Cost lines that are not directly citable are labelled "Estimate".
#   • No fabricated statistics. Logic matches roi_model.py.
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
 .tag-cited{{color:#1B7F4B;font-weight:700;}} .tag-partly{{color:#B8860B;font-weight:700;}} .tag-est{{color:#C0562B;font-weight:700;}}
</style>""", unsafe_allow_html=True)

# ---- source URLs (used throughout) ----
U_FRPS="https://www.federalreserve.gov/paymentsystems/fr-payments-study.htm"
U_AFP="https://www.financialprofessionals.org/training-resources/resources/survey-research-economic-data/details/payments-fraud"
U_NACHA="https://www.nacha.org/content/ach-network-volume-and-value-statistics"
U_FEDWIRE="https://www.frbservices.org/resources/financial-services/wires/volume-value-stats/annual-stats.html"
U_FEDNOW="https://www.frbservices.org/resources/financial-services/fednow/volume-value-stats"
U_FEDNOW_ORG="https://www.frbservices.org/financial-services/fednow/organizations"
U_FEDNOW_FEE="https://www.frbservices.org/resources/fees/fednow-2026"
U_RTP="https://www.theclearinghouse.org/payment-systems/rtp"
U_RTP_INST="https://www.theclearinghouse.org/payment-systems/rtp/institution"
U_FFIEC="https://ithandbook.ffiec.gov/it-booklets/retail-payment-systems/"
U_REGII="https://www.federalreserve.gov/paymentsystems/regii-about.htm"
U_PIX="https://paymentscmi.com/insights/pix-in-brazil-latest-statistics-central-bank/"

# =====================================================================
# COST STACK DEFAULTS  (FedNow & RTP separate; matches roi_model.py logic)
# order: [network, processing, failure_rate, cost_per_failure,
#         fraud_loss, fraud_prevention, compliance, reconciliation, liquidity]
# =====================================================================
COMPONENTS=["Network fee","Processing","Failure rate","Cost per failure",
            "Fraud loss","Fraud prevention","Compliance","Reconciliation","Liquidity"]
RAILS=["Check","Wire","Same-Day ACH","ACH","FedNow","RTP"]
LEGACY=["Check","Wire","Same-Day ACH","ACH"]
DEFAULTS={
 "Check":        [0.03, 2.00, 0.015, 8.00, 0.40, 0.10, 0.03, 0.30, 0.00],
 "Wire":         [0.82, 12.00, 0.010, 25.00, 2.00, 1.00, 2.00, 0.50, 0.00],
 "Same-Day ACH": [0.05, 0.80, 0.015, 6.00, 0.15, 0.10, 0.05, 0.10, 0.00],
 "ACH":          [0.005, 0.15, 0.015, 4.00, 0.05, 0.05, 0.03, 0.05, 0.00],
 "FedNow":       [0.045, 0.10, 0.005, 5.00, 0.25, 0.15, 0.10, 0.05, 0.05],
 "RTP":          [0.045, 0.10, 0.005, 5.00, 0.25, 0.15, 0.10, 0.05, 0.05],
}
SUBST_DEFAULT={"Check":0.25,"Wire":0.30,"Same-Day ACH":0.20,"ACH":0.05}
PRESETS={
 "Small CFI (~$200M)": {"Check":120000,"Wire":2000,"Same-Day ACH":30000,"ACH":400000,"one_time":60000,"annual":30000},
 "Mid CFI (~$1B)":     {"Check":600000,"Wire":12000,"Same-Day ACH":150000,"ACH":2500000,"one_time":150000,"annual":60000},
 "Large CFI (~$5B)":   {"Check":3000000,"Wire":60000,"Same-Day ACH":800000,"ACH":14000000,"one_time":350000,"annual":150000},
}

# per-component source: (publisher, supports-this-data, url, as_of, status)
SRC={
 "Network fee":("Federal Reserve & The Clearing House fee schedules",
   "FedNow & RTP $0.045/credit transfer; Fedwire $0.97 gross (~$0.78 discounted)",U_FEDNOW_FEE,"2025–2026","Cited"),
 "Processing":("Nacha / AFP operational-cost benchmarks","Internal labor & systems per item",U_NACHA,"2024","Estimate"),
 "Failure & exception":("Nacha Operating Rules; LexisNexis","Return rate ~1.5%; avg failed payment $12.10",U_NACHA,"2024–2025","Partly cited"),
 "Fraud loss":("AFP Payments Fraud & Control Survey","Incidence cited (check 58%, ACH 30%, wire 25%); per-item $ estimated",U_AFP,"2025","Partly cited"),
 "Fraud prevention":("AFP survey / fraud-tooling vendors","Real-time screening & monitoring per item",U_AFP,"2025","Estimate"),
 "Compliance":("FFIEC BSA/AML; Fed Regulation II","AML/OFAC screening; debit interchange $0.21+5bps+$0.01",U_REGII,"current (12 CFR 235)","Partly cited"),
 "Reconciliation":("FFIEC / exception-management research","Matching & breaks handling per item",U_FFIEC,"2024","Estimate"),
 "Liquidity":("Federal Reserve FedNow / TCH RTP","Prefunding / liquidity carrying cost (24/7 settlement)",U_FEDNOW,"2025","Estimate"),
}
SUBST_SRC=("Banco Central do Brasil (Pix) & Pay.UK","Migration bounded by Pix (fast) & UK FPS (slow)",U_PIX,"2024","Estimate")

# =====================================================================
# RAIL REFERENCE DATA  — real, cited facts per rail
# rows: (Metric, Value, As of, Publisher, URL)
# =====================================================================
RAIL_FACTS={
 "Check":[
  ("Volume","~3.0 billion commercial checks (Reserve Banks), down 5.4% YoY","2024","Federal Reserve Payments Study",U_FRPS),
  ("Consumer use","7% of consumers paid by check (was 19% in 2020)","2024","Federal Reserve",U_FRPS),
  ("Fraud","58% of organizations targeted — the most of any instrument","2025","AFP Payments Fraud Survey",U_AFP),
  ("Fully-loaded cost","~$3.00 per transaction (model)","2025 est.","Estimate — Deliverable 1",U_NACHA),
 ],
 "Wire":[
  ("Volume","209.9 million Fedwire Funds transfers","2024","Fedwire Funds Service Annual Statistics",U_FEDWIRE),
  ("Value","$1.133 quadrillion; average $5.4 million per transfer","2024","Fedwire Annual Statistics",U_FEDWIRE),
  ("Fee","$0.97 gross (~$0.78 with small-volume discount)","2026 schedule","Federal Reserve fee schedule",U_FEDNOW_FEE),
  ("Fraud","25% of organizations targeted; high value-at-risk","2025","AFP Payments Fraud Survey",U_AFP),
  ("Fully-loaded cost","~$18.57 per transaction (model)","2025 est.","Estimate — Deliverable 1",U_FEDWIRE),
 ],
 "Same-Day ACH":[
  ("Volume","1.4 billion payments","2025","Nacha",U_NACHA),
  ("Value","$3.9 trillion","2025","Nacha",U_NACHA),
  ("Growth","+16.7% volume / +21.4% value YoY","2025","Nacha",U_NACHA),
  ("Fully-loaded cost","~$1.34 per transaction (model)","2025 est.","Estimate — Deliverable 1",U_NACHA),
 ],
 "ACH":[
  ("Volume","35.2 billion payments","2025","Nacha",U_NACHA),
  ("Value","$93.1 trillion","2025","Nacha",U_NACHA),
  ("Growth","+4.9% volume YoY","2025","Nacha",U_NACHA),
  ("Fraud","ACH debit: 30% of organizations targeted","2025","AFP Payments Fraud Survey",U_AFP),
  ("Fully-loaded cost","~$0.40 per transaction (model)","2025 est.","Estimate — Deliverable 1",U_NACHA),
 ],
 "FedNow":[
  ("Payments settled","8.4 million in 2025 (up from 1.5M in 2024)","2025","Federal Reserve — FedNow Volume & Value",U_FEDNOW),
  ("Value","$853.4 billion; average $101,435 per payment","2025","Federal Reserve",U_FEDNOW),
  ("Growth","+460% value year over year","2025","Federal Reserve",U_FEDNOW),
  ("Participants","1,600 financial institutions, all 50 states","2025","Federal Reserve",U_FEDNOW_ORG),
  ("Transaction limit","$10 million (raised from $1M, Nov 2025)","2025","Federal Reserve",U_FEDNOW_FEE),
  ("Pricing","$0.045 / credit transfer; $0.01 / request-for-payment; $25/mo (waived 2025)","2025–2026","Federal Reserve fee schedule",U_FEDNOW_FEE),
 ],
 "RTP":[
  ("Daily volume","~1.2 million payments per day","2025","The Clearing House",U_RTP),
  ("Quarterly","Q2 2025: 107 million transactions, $481 billion","2025","The Clearing House",U_RTP),
  ("Participants","1,031 institutions; 94% hold under $10B in assets","Aug 2025","The Clearing House",U_RTP_INST),
  ("Account reach","72%+ of U.S. demand-deposit accounts","2025","The Clearing House",U_RTP_INST),
  ("Transaction limit","$10 million (raised Feb 2025)","2025","The Clearing House",U_RTP),
  ("Pricing","$0.045 / credit transfer; $0.11 / request-for-payment","2025","The Clearing House",U_RTP),
  ("Live since","November 2017","2025","The Clearing House",U_RTP),
 ],
}
RAIL_COLOR={"Check":RED,"Wire":AMBER,"Same-Day ACH":BLUE,"ACH":"#9AA7C7","FedNow":TEAL,"RTP":"#1B998B"}

def tc(c): return c[0]+c[1]+(c[2]*c[3])+c[4]+c[5]+c[6]+c[7]+c[8]
def money(x): return f"${x:,.0f}"
LINK=lambda url,txt="open ↗": st.column_config.LinkColumn(txt, display_text=txt)

def run_model(volumes, costs, subst, dest, one_time, annual, disc, horizon):
    instant=tc(costs[dest]); rows=[]; gross=0.0
    for rail in LEGACY:
        legacy=tc(costs[rail]); per=legacy-instant
        migrated=volumes[rail]*subst[rail]; ann=migrated*per; gross+=ann
        rows.append({"Rail":rail,"Legacy $/txn":legacy,"Save $/txn":per,"Migrated txns":migrated,"Annual savings":ann})
    net=gross-annual
    roi=net/one_time if one_time else 0
    payback=(one_time/net*12) if net>0 else float("inf")
    af=(1-(1+disc)**(-horizon))/disc; npv=net*af-one_time
    return rows, dict(instant=instant,gross=gross,net=net,roi=roi,payback=payback,npv=npv)

# =====================================================================
# HEADER + SIDEBAR
# =====================================================================
st.title("💸 Migration ROI Calculator")
st.markdown(f"<p style='color:{GREY};margin-top:-8px'>What a community bank saves by moving checks & wires to instant payments. "
            f"<b>FedNow and RTP shown separately. Every number is sourced — open any link to verify.</b></p>", unsafe_allow_html=True)

if "loaded" not in st.session_state:
    st.session_state.loaded=True
    for k,v in PRESETS["Mid CFI (~$1B)"].items(): st.session_state[k]=v
def apply_preset():
    for k,v in PRESETS[st.session_state.preset_sel].items(): st.session_state[k]=v

with st.sidebar:
    st.header("1 · The bank")
    st.selectbox("Pick a size, then adjust ↓", list(PRESETS.keys()), key="preset_sel", index=1, on_change=apply_preset)
    st.number_input("Checks / year", min_value=0, step=1000, key="Check")
    st.number_input("Wires / year", min_value=0, step=100, key="Wire")
    st.number_input("Same-Day ACH / year", min_value=0, step=1000, key="Same-Day ACH")
    st.number_input("Standard ACH / year", min_value=0, step=1000, key="ACH")
    st.markdown("**Cost to enable instant payments**")
    st.number_input("One-time implementation ($)", min_value=0, step=5000, key="one_time")
    st.number_input("Annual fixed cost ($/yr)", min_value=0, step=1000, key="annual")

    st.header("2 · Migrate to")
    dest=st.radio("Destination instant rail", ["FedNow","RTP"], horizontal=True,
                  help="FedNow (Federal Reserve) and RTP (The Clearing House) are the two U.S. instant rails. Costs are near-identical; see the Rail Data tab.")

    st.header("3 · Migration assumptions")
    subst={}
    subst["Check"]=st.slider("% of checks that migrate",0,100,int(SUBST_DEFAULT["Check"]*100))/100
    subst["Wire"]=st.slider("% of wires that migrate",0,100,int(SUBST_DEFAULT["Wire"]*100))/100
    subst["Same-Day ACH"]=st.slider("% of Same-Day ACH that migrates",0,100,int(SUBST_DEFAULT["Same-Day ACH"]*100))/100
    subst["ACH"]=st.slider("% of standard ACH that migrates",0,100,int(SUBST_DEFAULT["ACH"]*100))/100
    st.caption(f"Bounds source: [{SUBST_SRC[0]}]({SUBST_SRC[2]}) ({SUBST_SRC[3]})")
    disc=st.slider("Discount rate (NPV)",0,20,10)/100
    horizon=st.slider("Horizon (years)",1,10,5)

volumes={r:st.session_state[r] for r in LEGACY}
one_time=st.session_state["one_time"]; annual=st.session_state["annual"]

# =====================================================================
# TABS
# =====================================================================
tab1,tab2,tab3=st.tabs(["🧮  ROI Calculator","📊  Rail Data & Sources","⚙️  Cost Assumptions & Sources"])

# --- shared editable cost stack (defined in tab3, read here) ---
if "cost_editor" in st.session_state:
    ed=st.session_state["cost_editor"]
# build costs from defaults, overlay any edits later inside tab3

# ------------------------- TAB 3 (assumptions) -------------------------
with tab3:
    st.subheader("Cost per transaction by rail — edit any number")
    st.caption("Each rail's fully-loaded cost = 8 components (Failure cost = rate × cost per failure). Sources for every line are in the table on the right.")
    cE,cS=st.columns([1.05,1])
    with cE:
        df_default=pd.DataFrame(DEFAULTS, index=COMPONENTS).T
        edited=st.data_editor(df_default, use_container_width=True, key="cost_editor")
        costs={rail:[float(edited.loc[rail,c]) for c in COMPONENTS] for rail in RAILS}
    with cS:
        st.markdown("**📎 Source for each cost line (with the data it supports)**")
        srows=[{"Cost line":k,"Supports":v[1],"As of":v[3],"Status":v[4],"Source":v[2]} for k,v in SRC.items()]
        st.dataframe(pd.DataFrame(srows), use_container_width=True, hide_index=True, height=340,
            column_config={"Source":st.column_config.LinkColumn("Verify",display_text="open ↗")})
        st.markdown(f"<span class='tag-cited'>Cited</span> = direct from source · "
                    f"<span class='tag-partly'>Partly cited</span> = rate cited, $ estimated · "
                    f"<span class='tag-est'>Estimate</span> = calibrate with Payfinia data", unsafe_allow_html=True)
    st.info("FedNow and RTP have near-identical per-transaction cost. They differ mainly on the request-for-payment fee "
            "($0.01 FedNow vs $0.11 RTP) and reach — see the Rail Data tab.")

costs={rail:[float(edited.loc[rail,c]) for c in COMPONENTS] for rail in RAILS}
rows,res=run_model(volumes, costs, subst, dest, one_time, annual, disc, horizon)

# ------------------------- TAB 1 (calculator) -------------------------
with tab1:
    st.subheader(f"Results — {st.session_state.preset_sel.split(' (')[0]}  ·  migrating to {dest}")
    c1,c2,c3,c4=st.columns(4)
    c1.metric("Net annual benefit", money(res["net"]))
    c2.metric("Year-1 ROI", f"{res['roi']*100:,.0f}%")
    c3.metric("Payback", "—" if res["payback"]==float('inf') else f"{res['payback']:.1f} mo")
    c4.metric("5-year NPV", money(res["npv"]))
    if res["net"]<=0:
        st.markdown("<div class='note'>⚠️ At these inputs migration does not pay back. Increase check/wire volume or migration share, or lower the one-time cost.</div>", unsafe_allow_html=True)
    else:
        st.markdown(f"<div class='note'>💡 {dest} costs <b>${res['instant']:.2f}</b>/txn all-in. Savings come from displacing checks (${tc(costs['Check']):.2f}) and wires (${tc(costs['Wire']):.2f}). Standard ACH is already cheaper than instant, so migrating it does not help.</div>", unsafe_allow_html=True)

    L,R=st.columns(2)
    with L:
        st.markdown("**Annual savings by rail**")
        f=go.Figure(go.Bar(x=[r["Annual savings"] for r in rows],y=[r["Rail"] for r in rows],orientation="h",
            marker_color=[RAIL_COLOR[r["Rail"]] for r in rows],
            text=[money(r["Annual savings"]) for r in rows],textposition="outside"))
        f.update_layout(height=300,margin=dict(l=10,r=70,t=10,b=10),plot_bgcolor="white",xaxis_title="$/yr",yaxis_title="")
        st.plotly_chart(f,use_container_width=True)
    with R:
        st.markdown("**Fully-loaded cost per transaction**")
        order=["Wire","Check","Same-Day ACH","FedNow","RTP","ACH"]
        f2=go.Figure(go.Bar(x=[tc(costs[r]) for r in order],y=order,orientation="h",
            marker_color=[RAIL_COLOR[r] for r in order],
            text=[f"${tc(costs[r]):.2f}" for r in order],textposition="outside"))
        f2.update_layout(height=300,margin=dict(l=10,r=60,t=10,b=10),plot_bgcolor="white",xaxis_title="$/txn",yaxis_title="")
        st.plotly_chart(f2,use_container_width=True)

    st.markdown("**Per-rail savings detail**")
    det=pd.DataFrame(rows)
    det["Legacy $/txn"]=det["Legacy $/txn"].map(lambda x:f"${x:,.2f}")
    det["Save $/txn"]=det["Save $/txn"].map(lambda x:f"${x:,.2f}")
    det["Migrated txns"]=det["Migrated txns"].map(lambda x:f"{x:,.0f}")
    det["Annual savings"]=det["Annual savings"].map(money)
    st.dataframe(det,use_container_width=True,hide_index=True)
    st.caption(f"Gross savings {money(res['gross'])} − annual fixed {money(annual)} = net benefit {money(res['net'])}. "
               "Analytical estimate, not a guarantee. All cost inputs are on the Cost Assumptions tab with sources.")

# ------------------------- TAB 2 (rail data) -------------------------
with tab2:
    st.subheader("Rail data — real figures, each with its source")
    st.caption("Open any rail. Every statistic states the number, the year, and links to the publisher. Nothing here is estimated unless labelled.")
    for rail in RAILS:
        with st.expander(f"{'🟢' if rail in ('FedNow','RTP') else '⚪'}  {rail}", expanded=(rail in ("FedNow","RTP"))):
            facts=RAIL_FACTS[rail]
            df=pd.DataFrame([{"Metric":m,"Value / figure":v,"As of":y,"Publisher":p,"Source":u} for (m,v,y,p,u) in facts])
            st.dataframe(df, use_container_width=True, hide_index=True,
                column_config={"Source":st.column_config.LinkColumn("Verify",display_text="open ↗")})
    st.markdown("<div class='note'>FedNow (Federal Reserve) and RTP (The Clearing House) are the two U.S. instant rails — "
                "separate operators, separate networks. A bank can join one or both. Their per-transaction economics are "
                "near-identical; they differ on request-for-payment fees and network reach (shown above).</div>", unsafe_allow_html=True)
