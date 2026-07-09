"""
=============================================================================
PAYFINIA — MIGRATION ROI MODEL  (Deliverable 2, v2 — detailed cost taxonomy)
=============================================================================
What this does:
    Estimates how much a Community Financial Institution (CFI) saves per year
    by moving payment volume OFF legacy rails (check, wire, Same-Day ACH, ACH)
    ONTO instant rails (FedNow / RTP).

WHAT CHANGED IN v2 (client feedback: "needs more detail; account for failure
cost and the many other costs"):
    Each rail now carries a FULL, itemized cost stack instead of 3 lumped
    numbers. Eight cost components per transaction, every one an adjustable,
    sourced input:
        1. network_fee          - price paid to the rail operator
        2. processing           - internal labor & systems to move the item
        3. failure & exception  - return_rate x cost_per_failed_item
        4. fraud_loss           - expected fraud write-off per item
        5. fraud_prevention     - screening/monitoring tooling per item
        6. compliance           - AML / sanctions screening per item
        7. reconciliation       - matching / breaks handling per item
        8. liquidity            - prefunding / float carrying cost per item
    Plus FIXED costs: one-time implementation & training; annual platform,
    maintenance, and compliance-program costs.

KEY, HONEST FINDING this detail exposes:
    Instant payments are NOT free (~$0.77/txn fully loaded once you include
    real-time fraud screening, APP-scam loss risk, and prefunding). And moving
    STANDARD ACH to instant actually COSTS money, because ACH is already
    cheaper than instant's full cost. The ROI is a CHECK and WIRE story.

Benchmarks / sources are in the SOURCES dict at the bottom and in Deliverable 1.
Run with:  python roi_model.py
=============================================================================
"""

from dataclasses import dataclass
from typing import Dict


# ---------------------------------------------------------------------------
# 1. COST STACK — the 8 per-transaction cost components for each rail (USD)
# ---------------------------------------------------------------------------
# Every value is an assumption you can change. Defaults use conservative,
# public-benchmark midpoints (see SOURCES). "failure_rate" is a share (0-1);
# it is multiplied by "cost_per_failure" to get the expected failure cost.

@dataclass
class CostStack:
    network_fee: float
    processing: float
    failure_rate: float
    cost_per_failure: float
    fraud_loss: float
    fraud_prevention: float
    compliance: float
    reconciliation: float
    liquidity: float

    @property
    def failure_cost(self) -> float:
        """Expected cost of returns/rejects/repairs on one item."""
        return self.failure_rate * self.cost_per_failure

    @property
    def total(self) -> float:
        """Fully-loaded cost to move ONE transaction on this rail."""
        return (self.network_fee + self.processing + self.failure_cost
                + self.fraud_loss + self.fraud_prevention + self.compliance
                + self.reconciliation + self.liquidity)


#                        net    proc   fail%  fail$  frdL   frdP   comp   recon  liq
RAIL_COSTS: Dict[str, CostStack] = {
    "Check":        CostStack(0.03, 2.00, 0.015, 8.00, 0.40, 0.10, 0.03, 0.30, 0.00),
    "Wire":         CostStack(0.82, 12.00, 0.010, 25.00, 2.00, 1.00, 2.00, 0.50, 0.00),
    "Same-Day ACH": CostStack(0.05, 0.80, 0.015, 6.00, 0.15, 0.10, 0.05, 0.10, 0.00),
    "ACH":          CostStack(0.005, 0.15, 0.015, 4.00, 0.05, 0.05, 0.03, 0.05, 0.00),
    "Instant":      CostStack(0.045, 0.10, 0.005, 5.00, 0.25, 0.15, 0.10, 0.05, 0.05),
}

# Share of each legacy rail's volume that migrates to instant (bounded by
# international analogs: Brazil Pix = fast ceiling, UK Faster Payments = slow floor)
SUBSTITUTION_RATES: Dict[str, float] = {
    "Check": 0.25, "Wire": 0.30, "Same-Day ACH": 0.20, "ACH": 0.05,
}

DISCOUNT_RATE = 0.10
HORIZON_YEARS = 5


# ---------------------------------------------------------------------------
# 2. CFI PROFILES — three illustrative institutions (replace with real data)
# ---------------------------------------------------------------------------

@dataclass
class CFIProfile:
    name: str
    assets: str
    members: int
    annual_volume: Dict[str, float]
    one_time_cost: float      # implementation + training (one-time)
    annual_fixed_cost: float  # platform + maintenance + compliance program (per year)


CFI_PROFILES = [
    CFIProfile("Small CFI", "$200M", 15_000,
               {"Check": 120_000, "Wire": 2_000, "Same-Day ACH": 30_000, "ACH": 400_000},
               one_time_cost=60_000, annual_fixed_cost=30_000),
    CFIProfile("Mid CFI", "$1B", 75_000,
               {"Check": 600_000, "Wire": 12_000, "Same-Day ACH": 150_000, "ACH": 2_500_000},
               one_time_cost=150_000, annual_fixed_cost=60_000),
    CFIProfile("Large CFI", "$5B", 350_000,
               {"Check": 3_000_000, "Wire": 60_000, "Same-Day ACH": 800_000, "ACH": 14_000_000},
               one_time_cost=350_000, annual_fixed_cost=150_000),
]


# ---------------------------------------------------------------------------
# 3. THE MODEL
# ---------------------------------------------------------------------------

def model_cfi(cfi: CFIProfile, substitution=None, rail_costs=None) -> dict:
    substitution = substitution or SUBSTITUTION_RATES
    rail_costs = rail_costs or RAIL_COSTS
    instant_cost = rail_costs["Instant"].total

    by_rail, gross = {}, 0.0
    for rail, volume in cfi.annual_volume.items():
        migrated = volume * substitution[rail]
        per_txn = rail_costs[rail].total - instant_cost     # can be NEGATIVE for ACH
        annual = migrated * per_txn
        by_rail[rail] = {"migrated_volume": migrated,
                         "legacy_cost": rail_costs[rail].total,
                         "savings_per_txn": per_txn,
                         "annual_savings": annual}
        gross += annual

    net = gross - cfi.annual_fixed_cost
    roi = net / cfi.one_time_cost if cfi.one_time_cost else float("inf")
    payback = cfi.one_time_cost / net if net > 0 else float("inf")
    annuity = (1 - (1 + DISCOUNT_RATE) ** (-HORIZON_YEARS)) / DISCOUNT_RATE
    npv = net * annuity - cfi.one_time_cost

    return {"name": cfi.name, "assets": cfi.assets, "members": cfi.members,
            "by_rail": by_rail, "instant_cost": instant_cost,
            "gross_annual_savings": gross, "annual_fixed_cost": cfi.annual_fixed_cost,
            "net_annual_benefit": net, "one_time_cost": cfi.one_time_cost,
            "roi_year1": roi, "payback_years": payback, "npv_5yr": npv}


# ---------------------------------------------------------------------------
# 4. SENSITIVITY
# ---------------------------------------------------------------------------

def sensitivity_substitution(cfi, multipliers=(0.5, 0.75, 1.0, 1.25, 1.5)):
    out = []
    for m in multipliers:
        scaled = {k: min(v * m, 1.0) for k, v in SUBSTITUTION_RATES.items()}
        r = model_cfi(cfi, substitution=scaled)
        out.append((m, r["net_annual_benefit"], r["roi_year1"]))
    return out


def sensitivity_instant_cost(cfi, instant_totals=(0.50, 0.77, 1.00, 1.50, 2.00)):
    """Vary instant's fully-loaded cost (its fraud/liquidity load is uncertain)."""
    out = []
    base = RAIL_COSTS["Instant"]
    for t in instant_totals:
        costs = dict(RAIL_COSTS)
        # bump 'processing' so the Instant total equals t (keep other lines fixed)
        delta = t - base.total
        costs["Instant"] = CostStack(base.network_fee, base.processing + delta,
                                     base.failure_rate, base.cost_per_failure,
                                     base.fraud_loss, base.fraud_prevention,
                                     base.compliance, base.reconciliation, base.liquidity)
        r = model_cfi(cfi, rail_costs=costs)
        out.append((t, r["net_annual_benefit"], r["roi_year1"]))
    return out


# ---------------------------------------------------------------------------
# 5. SOURCES (documented benchmarks for each cost line)
# ---------------------------------------------------------------------------
SOURCES = {
    "network_fee": "Fed/Nacha/TCH published pricing (Deliverable 1); Fedwire ~$0.82, FedNow/RTP $0.045",
    "processing": "Industry operational-cost estimates by rail (Deliverable 1)",
    "failure": "Nacha return thresholds (overall <15%, admin <3%, unauth <0.5%); typical overall ~1.5%; "
               "return fees $2-$5; avg failed B2B payment $12.10 (LexisNexis)",
    "fraud_loss": "AFP Payments Fraud Survey; 2024 losses: check ~$24B, ACH ~$11B, APP ~$12.5B",
    "fraud_prevention": "Real-time screening/monitoring tooling cost (industry)",
    "compliance": "AML/sanctions (OFAC) screening per item; wires require mandatory screening",
    "reconciliation": "Exception-management / reconciliation cost research",
    "liquidity": "RTP prefunded joint account at FRBNY; FedNow liquidity management (frbservices.org)",
}


# ---------------------------------------------------------------------------
# 6. REPORT
# ---------------------------------------------------------------------------

def _m(x): return f"${x:,.0f}"

def print_report():
    print("=" * 74)
    print("PAYFINIA — MIGRATION ROI MODEL v2  |  detailed cost taxonomy")
    print("=" * 74)
    print("\nFully-loaded cost per transaction (8-part stack):")
    print(f"  {'Rail':<14}{'TOTAL':>8}  = net+proc+fail+frdL+frdP+comp+recon+liq")
    for rail, c in RAIL_COSTS.items():
        print(f"  {rail:<14}{c.total:>8.3f}  = {c.network_fee:.3f}+{c.processing:.2f}"
              f"+{c.failure_cost:.3f}+{c.fraud_loss:.2f}+{c.fraud_prevention:.2f}"
              f"+{c.compliance:.2f}+{c.reconciliation:.2f}+{c.liquidity:.2f}")

    for cfi in CFI_PROFILES:
        r = model_cfi(cfi)
        print("\n" + "-" * 74)
        print(f"{r['name']}  ({r['assets']} assets, {r['members']:,} members)   "
              f"instant cost/txn = ${r['instant_cost']:.3f}")
        print("-" * 74)
        for rail, d in r["by_rail"].items():
            flag = "  <-- costs more!" if d["savings_per_txn"] < 0 else ""
            print(f"  {rail:<14} migrate {d['migrated_volume']:>11,.0f} x "
                  f"${d['savings_per_txn']:>6.2f} = {_m(d['annual_savings']):>12}/yr{flag}")
        print(f"  GROSS annual savings : {_m(r['gross_annual_savings'])}")
        print(f"  Less annual fixed    : {_m(r['annual_fixed_cost'])}")
        print(f"  NET annual benefit   : {_m(r['net_annual_benefit'])}")
        print(f"  One-time cost        : {_m(r['one_time_cost'])}")
        print(f"  Year-1 ROI           : {r['roi_year1']*100:,.0f}%")
        print(f"  Payback (months)     : {r['payback_years']*12:,.1f}")
        print(f"  5-year NPV (@10%)    : {_m(r['npv_5yr'])}")

    print("\n" + "=" * 74)
    print("SENSITIVITY — Mid CFI: substitution multiplier")
    for m, net, roi in sensitivity_substitution(CFI_PROFILES[1]):
        print(f"  x{m:<4} net {_m(net):>12}  ROI {roi*100:,.0f}%")
    print("SENSITIVITY — Mid CFI: instant fully-loaded cost")
    for t, net, roi in sensitivity_instant_cost(CFI_PROFILES[1]):
        print(f"  instant ${t:<5} net {_m(net):>12}  ROI {roi*100:,.0f}%")


if __name__ == "__main__":
    print_report()
