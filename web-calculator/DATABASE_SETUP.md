# Connecting the Calculator to a Database

**Goal:** move saved scenarios (and, later, every calculation a bank runs) from the
browser into a real database, so they persist across devices and Payfinia can see
what prospects are modeling.

This guide uses **Supabase** — a managed PostgreSQL database with a JavaScript client
you call straight from React. It has a free tier, needs no separate backend server,
and deploys cleanly alongside the Vercel app.

---

## Why Supabase (and not the alternatives)

| Option | What it is | Verdict for us |
|---|---|---|
| **Supabase** ✅ | Hosted Postgres + auto REST API + JS client + auth | **Recommended.** Real SQL database, no backend to build, free tier, 30-min setup. |
| Firebase | Google's NoSQL document store | Fine, but NoSQL is a worse fit for tabular ROI data, and querying is clunkier. |
| Bare Postgres (Neon/RDS) | Just a database | You'd have to build and host an API server yourself. More work, more to break. |
| Vercel KV / Postgres | Vercel's own stores | Good, but Supabase's client + auth is friendlier for a beginner. |

The app is already written so **only one file changes** — `src/scenarios.js`. The UI calls
`loadScenarios()`, `addScenario()`, `removeScenario()`; today those touch localStorage,
after this they touch Supabase. Nothing else in the app needs to know.

---

## Step 1 — Create the project (5 min)

1. Go to **supabase.com** → sign up (free) → **New project**.
2. Pick a name (`payfinia-roi`), a strong database password, and a region near your users.
3. Wait ~2 minutes for it to provision.

## Step 2 — Create the table (5 min)

In the Supabase dashboard → **SQL Editor** → **New query** → paste and **Run**:

```sql
create table scenarios (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  bank_name   text,
  mig         numeric,
  -- inputs (to reload) and result (to display), stored as JSON
  inputs      jsonb not null,
  result      jsonb not null,
  -- who saved it (fill this in once you add login; nullable for now)
  owner       uuid
);

-- turn on row-level security so people only see their own rows later
alter table scenarios enable row level security;

-- for the MVP (no login yet) allow anonymous read/write.
-- TIGHTEN THIS before real customer data goes in (see Step 6).
create policy "anon full access (MVP only)" on scenarios
  for all using (true) with check (true);
```

## Step 3 — Get your keys

Dashboard → **Project Settings → API**. Copy:

- **Project URL** (looks like `https://abcd1234.supabase.co`)
- **anon public key** (a long string — this is safe to ship in a frontend)

> Never put the **service_role** key in the frontend — that one bypasses security.

## Step 4 — Add them to the app

Create `web-calculator/.env` (Vite reads variables prefixed with `VITE_`):

```
VITE_SUPABASE_URL=https://abcd1234.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Add `.env` to `.gitignore` (don't commit keys). In **Vercel → Project → Settings →
Environment Variables**, add the same two so the deployed site has them.

Install the client:

```bash
cd web-calculator
npm install @supabase/supabase-js
```

## Step 5 — Swap `scenarios.js` to Supabase

Because the UI already goes through this one module, this is the whole change. The
functions become **async** (they talk to the network), so the UI calls them with
`await` — see Step 5b.

```js
// src/scenarios.js  (Supabase version)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function loadScenarios() {
  const { data, error } = await supabase
    .from("scenarios").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  // map DB rows back to the shape the UI expects
  return data.map((r) => ({
    id: r.id, name: r.name, savedAt: r.created_at, bankName: r.bank_name, mig: r.mig,
    ...r.inputs, result: r.result,
  }));
}

export async function addScenario(sc) {
  const { inputs, result } = splitSnapshot(sc);
  const { error } = await supabase.from("scenarios").insert({
    name: sc.name, bank_name: sc.bankName, mig: sc.mig, inputs, result,
  });
  if (error) console.error(error);
  return await loadScenarios();
}

export async function removeScenario(id) {
  const { error } = await supabase.from("scenarios").delete().eq("id", id);
  if (error) console.error(error);
  return await loadScenarios();
}

// keep makeScenario() from the current file unchanged
function splitSnapshot(sc) {
  const { vol, costs, subst, oneTime, annual, disc, horizon } = sc;
  return { inputs: { vol, costs, subst, oneTime, annual, disc, horizon }, result: sc.result };
}
```

### Step 5b — the one UI tweak (async)

In `App.jsx`, the scenario handlers become async because the DB is remote:

```js
const [scenarios, setScenarios] = useState([]);

// load once on mount
useEffect(() => { loadScenarios().then(setScenarios); }, []);

async function saveScenario(name) {
  const r = runBottomUp(vol, costs, subst, oneTime, annual, disc, horizon);
  const sc = makeScenario(name, { bankName, mig, vol: clone(vol), costs: clone(costs),
    subst: clone(subst), oneTime, annual, disc, horizon, result: r });
  setScenarios(await addScenario(sc));
}
async function deleteScenario(id) { setScenarios(await removeScenario(id)); }
```

That's it — the Compare view, the client result list, everything else keeps working.

## Step 6 — Before real customer data (important)

The MVP policy in Step 2 lets **anyone** read/write. That's fine for a demo, **not** for
real bank data. Before that point:

1. Add **Supabase Auth** (email magic-link is easiest) so each user has an `owner` id.
2. Replace the open policy with owner-scoped rules:

```sql
drop policy "anon full access (MVP only)" on scenarios;

create policy "owners read their rows"   on scenarios for select using (auth.uid() = owner);
create policy "owners insert their rows" on scenarios for insert with check (auth.uid() = owner);
create policy "owners delete their rows" on scenarios for delete using (auth.uid() = owner);
```

3. Set `owner: (await supabase.auth.getUser()).data.user.id` when inserting.

---

## What this buys you

- **Persistence across devices** — a saved scenario opens on any laptop or phone, not just the browser it was created in.
- **Shareable** — with auth + a shared link, colleagues can view the same version.
- **Visibility for Payfinia** — every scenario a prospect saves is a warm lead sitting in one table you can query.

## Effort / cost

- Setup: ~30 minutes. Code change: one file + one small `App.jsx` tweak.
- Cost: **$0** on Supabase's free tier (plenty for a pilot); paid tiers start ~$25/mo when you outgrow it.

## Rollback

If anything breaks, restore the current `src/scenarios.js` (localStorage version) from git
and the app instantly works offline again — no data lost that wasn't already in the browser.
