# v4 — Client feedback build (meeting 2026-07-28)

Implements the items raised by **Keith Riddle**, **Nizar Jamal** and **Kiran Garimella** in the
Project Meeting – Money Movement Analytics (Project #3) review.

---

## 1 · The calculator is now modular by customer segment

**Ask (Nizar Jamal, decision "Aligned"):** *"restructure the calculator into a modular format where
cost components for different segments (Retail, Business, Internal) can be calculated independently
and then aggregated."*

**Ask (Keith Riddle):** flat costs are wrong — a flat $0.82 for instant is closer to ~$3.00 for B2B,
and check processing may run ~$6.00 rather than $2.83.

### What changed

`src/data.js` was restructured from one flat cost table into three:

| Layer | Varies by segment? | Why |
|---|---|---|
| **Network fee** | No | The Fed and TCH charge the FI the same per-item fee regardless of end customer. |
| **Provider fee** (Payfinia/TPSP) | No | Payfinia's price to the FI, not to the end customer. |
| **FI internal cost** | **Yes** | This is the layer that actually differs — and the reason the flat model was wrong. |

`runSegmented()` costs Retail, Business and Internal independently, then aggregates. Per-segment
results are retained so the UI can show *which customer segment the savings come from*.
`runBottomUp()` is kept as a back-compat wrapper.

### Where the Business numbers come from

Anchored to the **AFP 2022 Payments Cost Benchmarking Survey** (n=347 treasury professionals),
which is the only public dataset that benchmarks payment cost per item *segmented by B2B type*:

| Rail | Business all-in | AFP basis |
|---|---|---|
| Check | **$2.98** | Best-estimated mean to issue; median range $2.01–$4.00; 33% of firms report above $4.00 |
| Wire | **$12.00** | Initiating: external median $7.00 + internal median $5.00; total median range $10.01–$15.00 |
| ACH | **$0.40** | External $0.25 + internal $0.15; median range $0.26–$0.50 |
| Instant | **$1.25** | RTP initiate/receive median band $0.01–$2.50, midpoint used; 40% of firms report >$2.50 |
| Same-Day ACH | $1.37 | **Derived** — AFP does not break it out. Business ACH internal × the retail Same-Day/ACH ratio (3.3×) |

Component splits within each rail are our allocation; **the totals are sourced** and are asserted in
the test suite so they cannot drift silently.

### Keith's high-touch B2B band

Keith's $6.00 check and $3.00 instant sit at roughly the **75th–80th percentile** of the AFP
distribution — inside the observed data, but above the published central estimate. Rather than
silently overriding a sourced figure, they're offered as a selectable band on the Cost Assumptions
tab (`BUSINESS_BANDS`), which rescales the Business column to those targets.

### Volume mix

Rail volume is split across segments via `SEG_MIX_DEFAULT`, sourced where possible:

- **ACH — Cited.** Nacha 2025: 8.1B B2B payments of 35.2B total = 23%.
- **Same-Day ACH — Partly cited.** Nacha Q3 2025: $585B of Same-Day value was B2B.
- **Wire — Partly cited.** Fedwire 2024 average transfer $5.4M implies an overwhelmingly commercial mix.
- **Check — Estimate.** No public split exists; inferred from Fed Payments Study consumer-use trends.

---

## 2 · Persistent control panel

**Ask (Nizar Jamal):** *"users who make input errors are currently forced to clear session tokens or
restart the entire flow because the initial wizard lacks a mechanism to return to previous choices."*

`src/ControlPanel.jsx` is a new always-mounted left-hand panel, present in **both** the simple client
view and the advanced analyst view. Every value the wizard collects is editable there — identity,
preset, volumes, customer counts, segment mix, appetite, per-segment migration rates, and the finance
assumptions. Collapsible to a floating button. **A mistyped input is no longer a dead end.**

---

## 3 · FTE time allocation

**Ask (Nizar Jamal):** *"the current model uses basic counts and labor costs but fails to adequately
reflect the fraction of time spent on specific payment rails — such as same-day ACH versus instant
payments — which is essential for calculating true ROI."*

The processing/labor and reconciliation mini-calculators now compute:

```
(FTE × salary × overhead multiplier × % of time on this rail × segment) ÷ items
```

`% of time` is a new required input with a slider, and the overhead multiplier (×1.30, toggleable)
converts base salary to fully-loaded cost. The formula is printed under the result so the number is
auditable. Item counts auto-populate from the selected segment × rail volume rather than the total.

---

## 4 · Segment-based intake

**Ask (Keith Riddle):** *"asking for segmentation details like the number of retail users, SMBs, and
mid-market customers served, rather than just raw check and wire counts."*

The wizard gained a step collecting **retail members / small business / mid-market** counts, with a
live preview of the resulting volume split per rail. `mixFromCustomers()` converts counts to a mix
using relative origination intensity per customer type — those weights are an **Estimate** and are
labelled as such in the UI.

The migration step was also reworked: instead of one blanket percentage, an appetite level
(Conservative / Moderate / Aggressive) applies **different rates per segment**, because business
volume migrates more slowly than retail at the same appetite (contract terms, AP file cycles,
supplier onboarding).

---

## 5 · Font size

**Ask (Kiran Garimella):** increase the font size within the application.

Base body copy 15 → 16px with every utility size lifted proportionally (nothing now falls below
~13px), plus an **A / A / A** text-size control in the header that scales the whole shell up to 1.22×.
The preference persists with the rest of the session state.

---

## 6 · Open methodology flags — deliberately visible

Nizar's action item was to *"review the cost components of the application in detail to ensure they
are meaningful."* Two problems surfaced during this work that should **not** be quietly resolved by
the implementer. They're exported as `METHOD_FLAGS` and rendered as a banner above the calculator:

| Severity | Flag |
|---|---|
| **High** | **Business and Retail are measured on different bases.** AFP measures what a *corporation* spends to make a payment. The Retail column measures what the *FI* spends to process one. The segment structure is right; the levels are not strictly comparable until production data lands. |
| **High** | **Retail wire ($18.57) currently costs more than business wire ($12.00)** — almost certainly backwards. Falls out of the flag above: the retail figure rests on a v3 processing estimate of $12.00/item of internal labor that was never independently sourced. **Needs re-deriving before this goes to a client.** |
| Medium | The Internal (FI) segment has no public source — every figure is an Estimate. |
| Medium | The check retail/business volume split is an estimate; the ACH one is cited. |

---

## 7 · Tests

Two suites, both run by `npm test`:

- **`src/model.checks.mjs`** (79 assertions) — verifies the AFP anchors, that network/provider fees
  are identical across segments, that layers sum to totals, that the volume split conserves volume,
  **that the modular engine reproduces the pre-refactor flat model exactly on a control scenario**,
  that segment grosses sum to total gross, that the "ACH migration is net-negative" finding from
  Deliverable 1 survives the refactor, that Keith's band hits its targets, and that the FTE
  time-allocation maths is correct.
- **`src/render.test.jsx`** (9 tests, vitest + jsdom) — renders the app from a clean slate, every
  advanced tab, the Cost Assumptions tab for each segment, both new components, and confirms a stale
  v1 localStorage payload doesn't crash the new schema.

```bash
npm test          # both
npm run test:model
npm run test:render
```

---

## Files

| File | Change |
|---|---|
| `src/data.js` | Rewritten — segment cost tables, sourcing metadata, method flags, modular engine, mini-calc helpers |
| `src/ControlPanel.jsx` | **New** — persistent input panel |
| `src/SegmentBreakdown.jsx` | **New** — per-segment results |
| `src/App.jsx` | Segment-aware state, method-flag banner, segment-scoped Cost Assumptions, text-size control |
| `src/Wizard.jsx` | Customer-count intake step, per-segment appetite step |
| `src/ClientResult.jsx` | Consumes the segmented result instead of recomputing flat |
| `src/styles.css` | Readability pass + panel, segment, flag and wizard styles |
| `src/model.checks.mjs` | **New** |
| `src/render.test.jsx` | **New** |

## Not done (deferred at the meeting)

- **Prospect Finder integration** — explicitly shelved; refine the calculator first.
- **API-first ingestion (CSV/JSON)** — Nizar raised it; not yet built.
- **Call-report defaults** — pull NCUA/FDIC fields into the calculator directly.
- **Database persistence** — Hamza, on a branch.
- Streamlit twin (`3_roi_calculator/`) and `2_roi_model/roi_model.py` still carry the **flat** model
  and now disagree with the React app. They need the same refactor.
