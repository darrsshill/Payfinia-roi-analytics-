# v4 — Segmented cost model

This release restructures the calculator around per-segment costing and addresses the review items
raised against v3.

---

## 1 · The calculator is now modular by customer segment

**Requirement:** restructure the calculator so that cost components for different segments (Retail,
Business, Internal) are calculated independently and then aggregated.

**Rationale:** flat costs understate business payments. A flat $0.82 for instant is closer to ~$3.00
for B2B, and business check processing may run considerably higher than the retail figure of $2.83.

### What changed

`src/data.js` was restructured from one flat cost table into three:

| Layer | Varies by segment? | Why |
|---|---|---|
| **Network fee** | No | The Fed and TCH charge the FI the same per-item fee regardless of end customer. |
| **Provider fee** (Payfinia/TPSP) | No | This is Payfinia's price to the FI, not to the end customer. |
| **FI internal cost** | **Yes** | This is the layer that actually differs by segment — and the reason the flat model was wrong. |

`runSegmented()` costs Retail, Business and Internal independently, then aggregates. Per-segment
results are retained so the UI can show *which customer segment the savings come from*.
`runBottomUp()` is kept as a backwards-compatible wrapper.

### Where the Business numbers come from

Anchored to the **AFP 2022 Payments Cost Benchmarking Survey** (n=347 treasury professionals), the
only public dataset that benchmarks payment cost per item segmented by B2B type:

| Rail | Business all-in | AFP basis |
|---|---|---|
| Check | **$2.98** | Best-estimated mean to issue; median range $2.01–$4.00; 33% of firms report above $4.00 |
| Wire | **$12.00** | Initiating: external median $7.00 + internal median $5.00; total median range $10.01–$15.00 |
| ACH | **$0.40** | External $0.25 + internal $0.15; median range $0.26–$0.50 |
| Instant | **$1.25** | RTP initiate/receive median band $0.01–$2.50, midpoint used; 40% of firms report >$2.50 |
| Same-Day ACH | $1.37 | **Derived** — AFP does not break it out. Business ACH internal × the retail Same-Day/ACH ratio (3.3×) |

Component splits within each rail are our own allocation; **the totals are sourced** and are asserted
in the test suite so they cannot drift silently.

### High-touch B2B band

Review feedback proposed a $6.00 check and a $3.00 instant for high-touch B2B. These sit at roughly
the **75th–80th percentile** of the AFP distribution — inside the observed data, but above the
published central estimate. Rather than silently overriding a sourced figure, they are offered as a
selectable band on the Cost Assumptions tab (`BUSINESS_BANDS`), which rescales the Business column to
those targets.

### Volume mix

Rail volume is split across segments via `SEG_MIX_DEFAULT`, sourced where possible:

- **ACH — Cited.** Nacha 2025: 8.1B B2B payments of 35.2B total = 23%.
- **Same-Day ACH — Partly cited.** Nacha Q3 2025: $585B of Same-Day value was B2B.
- **Wire — Partly cited.** Fedwire 2024 average transfer of $5.4M implies an overwhelmingly commercial mix.
- **Check — Estimate.** No public split exists; inferred from Fed Payments Study consumer-use trends.

---

## 2 · Persistent control panel

**Requirement:** users who make input errors were forced to clear session state or restart the entire
flow, because the wizard lacked a mechanism to return to previous choices.

`src/ControlPanel.jsx` is a new always-mounted left-hand panel, present in **both** the simple client
view and the advanced analyst view. Every value the wizard collects is editable there — identity,
preset, volumes, customer counts, segment mix, appetite, per-segment migration rates, and the finance
assumptions. It collapses to a floating button. A mistyped input is no longer a dead end.

---

## 3 · FTE time allocation

**Requirement:** the v3 model used basic headcounts and labor costs but did not reflect the fraction
of time staff spend on a specific payment rail — for example Same-Day ACH versus instant payments —
which is essential to a true ROI figure.

The processing/labor and reconciliation mini-calculators now compute:

```
(FTE × salary × overhead multiplier × % of time on this rail × segment) ÷ items
```

`% of time` is a new required input with a slider, and the overhead multiplier (×1.30, toggleable)
converts base salary to fully-loaded cost. The formula is printed under the result so the number is
auditable. Item counts auto-populate from the selected segment × rail volume rather than from the
total.

---

## 4 · Segment-based intake

**Requirement:** collect segmentation details — the number of retail users, small businesses and
mid-market customers served — rather than only raw check and wire counts.

The wizard gained a step collecting **retail members / small business / mid-market** counts, with a
live preview of the resulting volume split per rail. `mixFromCustomers()` converts counts to a mix
using relative origination intensity per customer type; those weights are an **Estimate** and are
labelled as such in the UI.

The migration step was also reworked: instead of one blanket percentage, an appetite level
(Conservative / Moderate / Aggressive) applies **different rates per segment**, because business
volume migrates more slowly than retail at the same appetite — contract terms, AP file cycles and
supplier onboarding all slow it down.

---

## 5 · Readability

**Requirement:** increase the font size within the application.

Base body copy moved from 15px to 16px with every utility size lifted proportionally (nothing now
falls below ~13px), plus an **A / A / A** text-size control in the header that scales the whole shell
up to 1.22×. The preference persists with the rest of the session state.

---

## 6 · Open methodology flags — deliberately visible

Two problems surfaced during this work that should not be quietly resolved by the implementer. They
are exported as `METHOD_FLAGS` and rendered as a banner above the calculator:

| Severity | Flag |
|---|---|
| **High** | **Business and Retail are measured on different bases.** AFP measures what a *corporation* spends to make a payment. The Retail column measures what the *FI* spends to process one. The segment structure is correct; the levels are not strictly comparable until production data lands. |
| **High** | **Retail wire ($18.57) currently costs more than business wire ($12.00)**, which is almost certainly backwards. This follows from the flag above: the retail figure rests on a v3 processing estimate of $12.00/item of internal labor that was never independently sourced. It needs re-deriving before customer-facing use. |
| Medium | The Internal (FI) segment has no public source — every figure is an Estimate. |
| Medium | The check retail/business volume split is an estimate; the ACH split is cited. |

---

## 7 · Tests

Two suites, both run by `npm test`:

- **`src/model.checks.mjs`** (79 assertions) — verifies the AFP anchors; that network and provider
  fees are identical across segments; that layers sum to totals; that the volume split conserves
  volume; that the modular engine reproduces the pre-refactor flat model exactly on a control
  scenario; that segment gross figures sum to total gross; that the "ACH migration is net-negative"
  finding from Deliverable 1 survives the refactor; that the high-touch band hits its targets; and
  that the FTE time-allocation arithmetic is correct.
- **`src/render.test.jsx`** (9 tests, vitest + jsdom) — renders the app from a clean slate, every
  advanced tab, the Cost Assumptions tab for each segment, both new components, and confirms that a
  stale v1 localStorage payload does not crash the new schema.

```bash
npm test          # both
npm run test:model
npm run test:render
```

---

## Files changed

| File | Change |
|---|---|
| `src/data.js` | Rewritten — segment cost tables, sourcing metadata, method flags, modular engine, mini-calc helpers |
| `src/ControlPanel.jsx` | **New** — persistent input panel |
| `src/SegmentBreakdown.jsx` | **New** — per-segment results |
| `src/App.jsx` | Segment-aware state, method-flag banner, segment-scoped Cost Assumptions, text-size control |
| `src/Wizard.jsx` | Customer-count intake step, per-segment appetite step |
| `src/ClientResult.jsx` | Consumes the segmented result instead of recomputing flat |
| `src/styles.css` | Readability pass, plus panel, segment, flag and wizard styles |
| `src/model.checks.mjs` | **New** |
| `src/render.test.jsx` | **New** |

## Deferred

- **Prospect Finder integration** — deferred in favour of refining the calculator first.
- **API-first ingestion (CSV/JSON)** — not yet built.
- **Call-report defaults** — pull NCUA/FDIC fields into the calculator directly.
- **Database persistence** — design documented in `DATABASE_SETUP.md`, not yet implemented.
- **Streamlit twin** (`3_roi_calculator/`) and `2_roi_model/roi_model.py` still carry the **flat**
  model and no longer agree with the React application. They need the same refactor.
