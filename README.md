# Seckman Football Photos — rolljags.com

Static site + Cloudflare Worker + R2 for sharing season photos. No accounts,
no build step, no admin UI — weeks are uploaded from the command line and the
site reads directly from R2.

## How it's organized

Photos live in R2 under:

```
{year}/week-{NN}_{yyyy-mm-dd}/{level}/IMG_0001.jpg
{year}/week-{NN}_{yyyy-mm-dd}/{level}/thumbs/IMG_0001.jpg
```

`level` is `varsity`, `jv`, or `freshman`. There's no separate config file —
the site parses everything it needs (year, week number, date, team level,
photo count) straight from the folder names, so uploading a new week's
photos with the right folder name is the entire "publishing" step.

## One-time setup

**Prerequisite:** Node.js 22+ (required by Wrangler). Check with `node --version`; if you're on an older version, install a current one from nodejs.org or with a version manager like `nvm`/`volta`.

### 1. Cloudflare R2 bucket

```
wrangler login
wrangler r2 bucket create rolljags-photos
```

### 2. Public access for photos

In the Cloudflare dashboard: **R2 → rolljags-photos → Settings → Public
Access → Enable**, then **Custom Domains → Add** and enter
`photos.rolljags.com`, then **Connect Domain**. This requires `rolljags.com`
to already be on Cloudflare (it will be, since the site itself is deployed
there too). Wait for the domain status to go from Initializing to Active.

This is a **separate subdomain** from the site itself (`rolljags.com`) —
photos are served directly from R2/Cloudflare's CDN with no Worker involved,
which keeps downloads fast and free of egress cost.

### 3. API token for the upload script

In the dashboard: **R2 → Manage API Tokens → Create API Token**, scope it to
**Object Read & Write** on just the `rolljags-photos` bucket, and copy the
Access Key ID and Secret Access Key (shown once).

```
cd scripts
cp .env.example .env
# fill in R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
npm install
```

`R2_ACCOUNT_ID` is your Cloudflare account ID, shown in the dashboard URL or
sidebar. This token is only used by the upload script — it's unrelated to
`wrangler login`.

### 4. Deploy the site

```
npm install
npx wrangler deploy
```

`wrangler.jsonc` already points the Worker at `rolljags.com` and binds the
R2 bucket, so this provisions DNS/TLS and ships the site + API in one step.

Note: bulk zip downloads need **Workers Paid** ($5/mo flat) — the free plan
caps requests at 50 subrequests, and reading 100+ photos out of R2 for one
zip exceeds that. Everything else (storage, photo views, single-photo
downloads) comfortably fits in free-tier limits.

## Uploading a new week

Run once per team level that has photos that week (skip levels with nothing
to upload — their tab just won't appear on the site):

```
cd scripts
node upload-week.mjs --year 2026 --week 3 --date 2026-09-11 \
  --level varsity --dir ~/Photos/wk3-varsity

node upload-week.mjs --year 2026 --week 3 --date 2026-09-11 \
  --level jv --dir ~/Photos/wk3-jv
```

- `--week` is just the number (`3`, not `03` — the script pads it).
- `--date` is the game date, `YYYY-MM-DD`.
- `--dir` is a local folder of `.jpg`/`.jpeg` files (already-exported JPEGs —
  the script doesn't convert HEIC).
- The script generates a thumbnail for each photo and uploads both the
  original (tagged for direct download) and the thumbnail to R2.

That's it — no redeploy needed. The site lists whatever's in R2, live, with
a short cache (~5 minutes) on the home page listing.

## Local development

```
npm install
npx wrangler dev
```

Serves the static site and `/api/*` routes together at `localhost:8787`,
using a local simulated R2 bucket (separate from production data). Seed it
with a test week using:

```
npx wrangler r2 object put rolljags-photos/2026/week-01_2026-09-06/varsity/IMG_0001.jpg \
  --file ./some-photo.jpg --local --content-type image/jpeg
```

(add a matching file under `.../varsity/thumbs/` too). Pass `--remote` to
`wrangler dev` instead if you want to develop against the real bucket.

## Notes

- The "Download all (.zip)" response streams directly from R2 rather than being built in memory, so it scales to 100+ photos without issue — but because it's streamed, browsers won't show a file size or an accurate progress bar during download (the file itself is complete and valid, this is just a missing size hint).

## Project layout

```
public/            Static site (no build step)
worker/            Worker: serves public/ and handles /api/*
scripts/           Local upload script (run from your own machine)
wrangler.jsonc     Worker + R2 binding + custom domain config
```
