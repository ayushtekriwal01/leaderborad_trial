# MCC Creator Cohort Leaderboard

Hourly-refreshed public leaderboard: **n8n → Metabase → Vercel (processing + validation + hosting)**.

All processing/validation lives in the Vercel app, so n8n needs only native
HTTP Request nodes — no Code nodes. The live dataset is only replaced when
every validation check passes; failed runs leave the previous dataset live, and
the frontend also caches the last board in localStorage so a page refresh can
never go blank.

## 1. Metabase card

Create (or reuse) a saved question that returns one row per creator with at
least: `creator_id`, `instagram_handle`, `lifetime_nmv`, `orders`, `gmv`,
`region`, `state`. Column names are flexible — `dim__creator_id`,
`dim__end_user_lifetime_nmv`, `dim__creator_latest_instagram_handle`,
`dim__creator_region`, `dim__creator_state`, `total__orders`, `total__gmv`
are all recognized (see `ALIASES` in `lib/process.js`).

Include `<₹15K` creators or not — the pipeline excludes them either way.

Create an API key: **Admin settings → Authentication → API keys**. Note the
card ID from the question URL (`/question/194085-...` → `194085`).

Keep the card to only the needed columns: the publish payload must stay under
Vercel's ~4.5 MB request-body limit (roughly 25–30K creators at these columns).

## 2. Deploy to Vercel

1. Import this repo at vercel.com/new (framework: Next.js) and deploy.
2. Project → **Storage → Create → Blob** → connect to project (auto-adds `BLOB_READ_WRITE_TOKEN`).
3. Project → **Settings → Environment Variables**: add `PUBLISH_TOKEN` = a long random secret (`openssl rand -hex 32`).
4. Redeploy so env vars take effect.

Public URLs (stable, no Meesho login needed):

| Cohort | URL |
|---|---|
| ₹15K–₹1L | `https://<app>.vercel.app/l/c1` |
| ₹1L–₹3L | `https://<app>.vercel.app/l/c2` |
| ₹3L–₹7L | `https://<app>.vercel.app/l/c3` |
| ₹7L+ | `https://<app>.vercel.app/l/c4` |

Smoke-test before wiring n8n:

```bash
APP_URL=https://<app>.vercel.app PUBLISH_TOKEN=<secret> npm run seed
```

Then open `/l/c2`, switch tabs, and search `@creator_25`.

## 3. n8n

Import `n8n/creator-leaderboard-workflow.json` and set these environment
variables (or paste values directly into the two HTTP Request nodes):

| Variable | Value |
|---|---|
| `METABASE_URL` | `https://metabase.<internal-domain>` (no trailing slash) |
| `METABASE_CARD_ID` | e.g. `194085` |
| `METABASE_API_KEY` | the Metabase API key |
| `LEADERBOARD_APP_URL` | `https://<app>.vercel.app` |
| `LEADERBOARD_PUBLISH_TOKEN` | same secret as Vercel's `PUBLISH_TOKEN` |

Run once manually, check the publish node returns `published: true`, then
activate. A rejected publish (validation failure) fails the run via the
**Stop and Error** node, so normal n8n error alerting fires while the public
board keeps serving the last good dataset.

## Guarantees mapped to the spec

- **Cohorts**: `<15K` excluded everywhere; boundaries at exactly ₹1L/₹3L/₹7L go to the higher cohort; one creator = one cohort.
- **Ranks**: Overall = full eligible universe; National = within cohort; Regional = cohort + region. Tie-break: NMV desc → orders desc → creator_id asc.
- **Display**: National tab shows National + Overall rank; regional tabs promote the regional rank to the primary column.
- **Validation before publish**: duplicate creator IDs / handles / ranks, cohort exclusivity, sequential ranks, top-N caps, region/cohort membership, <15K leakage — any failure → HTTP 422, dataset not published.
- **Failure handling / refresh**: `current.json` only changes on a validated publish; `previous.json` keeps a backup; server keeps an in-memory fallback; browser keeps a localStorage fallback. "Last updated" = last successful publish, not last attempted run.
- **Search**: works across the complete eligible universe and says explicitly when a creator is ranked but outside the displayed Top 100/Top 50.

## Local dev

```bash
npm install
BLOB_READ_WRITE_TOKEN=<token> PUBLISH_TOKEN=dev npm run dev
PUBLISH_TOKEN=dev npm run seed   # in another terminal
```
