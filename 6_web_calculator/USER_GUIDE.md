# ROI Calculator — First-Time User Guide

A 2-minute guide for a bank looking at the Payfinia instant-payments ROI calculator.

---

## The 30-second version

1. Answer three quick questions in the guided wizard (your name, your size, how many checks & wires you send).
2. See your estimated annual savings, ROI, and payback on one screen.
3. Adjust the numbers live, save the version, and compare different scenarios.

That's the whole tool. Everything below is optional depth.

---

## The guided start (what you see first)

When you open the tool you get a short, TurboTax-style questionnaire — one question at a
time, no jargon:

- **Your name** — just so the result is friendly.
- **Your size** — pick Small / Mid / Large; it pre-fills typical volumes you'll confirm.
- **Checks & wires you send per year** — the payments instant can replace.
- **How much you'd move to instant** — one slider.

Then you land on your **result**: a big savings number, your ROI, payback period, and where
the savings come from. You can change the inputs right there and watch it update.

Your progress **saves automatically in your browser** — refresh or come back tomorrow and it's
still there. Use **Reset** to start clean.

---

## Going deeper — "Advanced view"

Click **Advanced view** (top-right) for the full toolkit. It's organized left-to-right in the
order you'd actually work:

**1 · Cost Assumptions** — what each payment costs you, per transaction.
Every rail's cost is split into three layers:

- **Network** — the rail's own fee (Fed / Nacha / TCH). Small and fixed.
- **Provider** — Payfinia's per-transaction fee. **Only applies to Instant** — Payfinia
  doesn't charge on your existing check/wire/ACH rails.
- **Internal** — your own cost: staff, failures, fraud, compliance, reconciliation.

You have three ways to set these, from easiest to most precise:

- **Cost Builder (left):** don't know your "cost per check"? Enter things you *do* know —
  staff × salary ÷ volume, fraud $ ÷ volume, failed items ÷ total — and click **Apply**.
- **⇊ all button:** copy any single value to every rail at once (e.g. one network fee everywhere).
- **Override total:** if you already know your true all-in cost for a rail, type it into
  **Override total $/txn** and the calculator uses that number directly. Every result updates automatically.

> **Liquidity / pre-funding** defaults to **$0** — most banks have enough excess reserves that
> this isn't a real cost. Set it manually only if it applies to you.

**2 · Use My Financials** — the top-down view. Instead of per-item costs, enter your
**aggregate** numbers (total payments labor $/yr, total fraud losses $/yr, and your own network
fee per rail) and the tool allocates them across rails. Good when you know your totals but not
your per-item breakdown.

**3 · Savings Calculator** — the full result with all inputs exposed: volumes, migration % per
rail, one-time setup cost, annual platform cost, discount rate and horizon. Charts show cost
per transaction by layer and where savings come from, plus a **sanity check** against your books.

**4 · Why Migrate** — the honest case for each rail (Migrate / Consider / Keep), with reasons.
Note it flags **standard ACH as "keep"** — it's already cheaper than instant, so moving it
doesn't pay. That honesty is deliberate.

**5 · Compare Versions** — every scenario you saved, side by side, with per-rail savings and a
chart. Save one with conservative assumptions, one aggressive, and compare A vs. B.

**6 · Rail Data & Sources** — every underlying figure with the year, publisher, and a verify
link (Federal Reserve, Nacha, The Clearing House, AFP).

---

## Good to know

- **Nothing you type leaves your browser.** No account, no server — it's all local.
- **Figures are public-benchmark estimates**, clearly labeled. They're built so Payfinia can
  calibrate them to your real numbers — that's when the estimate becomes exact.
- **Monthly ↔ Annual toggle** on the volume inputs if you think in monthly terms.
