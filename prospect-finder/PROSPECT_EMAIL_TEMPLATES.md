# Prospect Outreach Email Templates

Templated emails for Payfinia sales, keyed to the **segment** each bank falls into from the
Prospect Finder. Every `{{placeholder}}` maps to a column in
`data/payfinia_bank_prospects.csv` — merge them in.

**Golden rules**
- Lead with *their* number (from the Finder), not a generic pitch.
- Keep it to three beats: the problem → their specific figure → one clear ask.
- Frame the estimate honestly ("our model estimates", "points to roughly"), never "you will save $X."
- One CTA. Short emails get replies.

Merge fields: `{{name}}` (bank), `{{state}}`, `{{est_net_benefit}}` (annual $), `{{roi_pct}}`,
`{{offices}}`, `{{segment}}`.

---

## Segment A — "Target first" (large / regional, highest value)
**Lead with the dollars. Value speaks for itself.**

**Subject:** ~{{est_net_benefit}}/year in {{name}}'s outbound payments

Hi {{first_name}},

Community banks the size of {{name}} typically send a lot of checks and wires each year — and
each one costs far more to process than most teams expect (~$3 a check, ~$19 a wire, versus
under a dollar for an instant payment).

We ran {{name}}'s public FDIC profile through our migration model, and moving a portion of your
outbound checks and wires to instant payments points to roughly **{{est_net_benefit}}/year**,
with payback in well under a year.

With {{offices}} branches, the bigger win may actually be operational: our **Payment Control
Module** pushes payment data-entry to the end customer, cutting the labor and wire-fraud liability
your team carries today.

Worth a 20-minute call to walk through the numbers for your actual volumes? I can do {{day}} or {{day}}.

Best,
{{sender}} · Payfinia

---

## Segment B — "Strong" (solid mid-size)
**Lead with ROI and fast payback.**

**Subject:** A quick ROI look for {{name}}

Hi {{first_name}},

Most of what a bank like {{name}} spends on payments isn't the network fee — it's the staff time
and fraud exposure on checks and wires. Shifting some of that to instant payments tends to pay
back fast: our model puts {{name}} at roughly **{{roi_pct}}% first-year ROI**.

We built a short interactive calculator where you plug in your own numbers and see the result
live, every figure sourced to the Fed, Nacha and FDIC:

👉 {{calculator_link}}

Happy to walk you through it — 20 minutes next week?

Best,
{{sender}} · Payfinia

---

## Segment C — "Moderate"
**Lower-key; lead with the tool, let them self-qualify.**

**Subject:** See what instant payments could save {{name}}

Hi {{first_name}},

Quick one — we put together a calculator that estimates what a bank could save by moving some of
its outbound checks and wires to instant payments (FedNow / RTP). It uses only public data and
shows every source.

Takes about two minutes with your own numbers: {{calculator_link}}

If it looks worthwhile for {{name}}, I'd be glad to talk through the details.

Best,
{{sender}} · Payfinia

---

## Segment D — "Low priority"
**Usually skip cold outreach.** If you do reach out, it's relationship-building, not ROI —
the savings often don't clear the setup cost, and an honest email respects that. Prefer a
newsletter/nurture track over a direct pitch.

---

## Follow-up (any segment, no reply after ~5 business days)

**Subject:** Re: {{name}} — instant payments

Hi {{first_name}}, floating this back up. Even a rough version of your check and wire volumes is
enough for me to show you a tailored number in a few minutes. Worth a short call? If the timing's
off, just let me know and I'll check back next quarter.

Best,
{{sender}}

---

## Personalization checklist before sending
- [ ] `{{est_net_benefit}}` pulled from the Finder for *this* bank (not a placeholder).
- [ ] Segment matches the template used.
- [ ] Real sender name, real calculator link, two concrete day options.
- [ ] Estimate framed as an estimate.
- [ ] The bank is **not** already a FedNow/RTP participant (see `filter_network_participants.py`).
