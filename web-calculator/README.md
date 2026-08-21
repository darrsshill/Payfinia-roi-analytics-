# Payfinia — Migration ROI Calculator (Web App)

An interactive React (Vite) version of the ROI calculator for live community-bank
conversations and easy deployment. FedNow and RTP are shown as separate rails,
and every figure links to its public source.

## Run locally
```bash
npm install
npm run dev        # opens http://localhost:5173
```

## Build
```bash
npm run build      # outputs to dist/
npm run preview    # serve the production build locally
```

## Deploy on Vercel (free) — no separate repo needed
This app lives in a subfolder of the main repo, so tell Vercel where it is:

1. Push the repo to GitHub.
2. vercel.com -> Add New... -> Project -> import your GitHub repo.
3. Set **Root Directory** to `web-calculator`.
4. Framework preset: **Vite** (auto-detected). Build `npm run build`, output `dist`.
5. Deploy. Vercel gives you a live shareable URL.

## Data & sources
All benchmark numbers are real, cited public figures (Federal Reserve, Nacha,
The Clearing House, AFP, FFIEC). Non-citable cost lines are labelled "Estimate".
See `src/data.js` for every value and its source URL. This tool estimates; it is
not a guarantee of savings.
